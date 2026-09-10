/**
 * Modération — routes réservées au rôle ADMIN.
 *
 * Deux principes gouvernent ce fichier :
 *
 *   1. Un administrateur ne voit que ce qui sert à décider. Les projections sont
 *      explicites et n'incluent JAMAIS les données de santé (poids, sommeil, repas,
 *      performances) ni les programmes : aucune décision de modération ne s'appuie
 *      dessus, donc les exposer serait une collecte sans finalité.
 *
 *   2. Toute décision et toute consultation de contenu signalé laissent une trace.
 *      Pouvoir démontrer qui a décidé quoi, et qui a lu quoi, est une obligation
 *      (article 5.2) autant qu'une protection pour les administrateurs eux-mêmes.
 */

import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

/** Délai laissé à la personne pour contester avant suppression effective. */
const DELAI_SUPPRESSION_JOURS = 30;

/** Identité et statut — jamais de données métier ni de santé. */
const PROJECTION_MODERATION = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  createdAt: true,
  status: true,
  suspendedAt: true,
  suspendedUntil: true,
  suspensionReason: true,
  scheduledDeletionAt: true,
};

/** Écrit la trace d'une décision. Appelé dans la même transaction que la décision. */
const consignerAction = (tx, { moderatorId, target, type, reason, metadata }) =>
  tx.moderationAction.create({
    data: {
      moderatorId,
      targetId: target.id,
      // Conservé en clair : quand le compte sera supprimé, targetId deviendra null
      // et cette valeur restera le seul repère permettant de justifier l'action.
      targetLabel: target.email,
      type,
      reason,
      metadata: metadata || undefined,
    },
  });

/** Journalise une consultation de contenu signalé. */
const consignerAcces = (moderatorId, reportId, scope) =>
  prisma.moderationAccessLog.create({ data: { moderatorId, reportId, scope } });

/** Informe la personne de la décision qui la concerne. */
const notifier = (tx, userId, title, body, data) =>
  tx.notification.create({ data: { userId, type: 'MODERATION', title, body, data } });

// ─── Signalements ────────────────────────────────────────────────────────────

/** GET /api/admin/reports — file de modération. */
export const listReports = async (req, res) => {
  try {
    const { status } = req.query;

    const reports = await prisma.report.findMany({
      where: status ? { status } : {},
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        reason: true,
        context: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        reported: { select: { id: true, email: true, firstName: true, lastName: true, status: true } },
        reporter: { select: { id: true, email: true } },
      },
    });

    return sendSuccess(res, reports);
  } catch (error) {
    console.error('listReports error:', error);
    return sendError(res, 'Échec de la récupération des signalements', 500);
  }
};

/**
 * GET /api/admin/reports/:id — détail d'un signalement.
 *
 * C'est ici que se joue l'arbitrage le plus sensible du dispositif : l'administrateur
 * accède au fil de conversation signalé. Trois garde-fous l'encadrent :
 *
 *   - l'accès n'est possible que tant que le signalement est ouvert ;
 *   - chaque consultation écrit une ModerationAccessLog ;
 *   - une fois le signalement clos, le contenu n'est plus renvoyé.
 *
 * Lire une correspondance privée reste une atteinte réelle. Ces garde-fous ne la
 * suppriment pas : ils la bornent dans le temps et la rendent redevable.
 */
export const getReport = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await prisma.report.findUnique({
      where: { id },
      select: {
        id: true, reason: true, description: true, context: true, messageId: true,
        status: true, resolution: true, createdAt: true, reviewedAt: true,
        reported: { select: PROJECTION_MODERATION },
        reporter: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!report) return sendError(res, 'Signalement introuvable', 404);

    const ouvert = report.status === 'PENDING' || report.status === 'REVIEWING';
    let conversation = null;

    if (ouvert && report.context === 'CONVERSATION' && report.messageId) {
      const message = await prisma.message.findUnique({
        where: { id: report.messageId },
        select: { coachId: true, clientId: true },
      });

      if (message) {
        conversation = await prisma.message.findMany({
          where: { coachId: message.coachId, clientId: message.clientId },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, content: true, type: true, isSentByCoach: true, createdAt: true,
          },
        });
      }
    }

    // La trace est écrite avant de répondre : si l'écriture échoue, l'accès échoue.
    await consignerAcces(
      req.user.id,
      report.id,
      conversation ? 'CONVERSATION' : 'REPORT_DETAIL'
    );

    return sendSuccess(res, {
      ...report,
      conversation,
      conversationAccess: ouvert
        ? 'Consultation journalisée. Le contenu ne sera plus accessible une fois le signalement clos.'
        : 'Signalement clos : le contenu signalé n\'est plus consultable.',
    });
  } catch (error) {
    console.error('getReport error:', error);
    return sendError(res, 'Échec de la récupération du signalement', 500);
  }
};

/** PUT /api/admin/reports/:id/dismiss — classer sans suite. */
export const dismissReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) return sendError(res, 'Un motif de classement est obligatoire', 400);

    const report = await prisma.report.findUnique({
      where: { id },
      select: { id: true, status: true, reported: { select: { id: true, email: true } } },
    });
    if (!report) return sendError(res, 'Signalement introuvable', 404);
    if (report.status === 'DISMISSED' || report.status === 'ACTIONED') {
      return sendError(res, 'Ce signalement est déjà traité', 409);
    }

    await prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id },
        data: { status: 'DISMISSED', resolution: reason, reviewedAt: new Date() },
      });
      await consignerAction(tx, {
        moderatorId: req.user.id,
        target: report.reported,
        type: 'DISMISS_REPORT',
        reason,
        metadata: { reportId: id },
      });
    });

    return sendSuccess(res, null, 'Signalement classé sans suite');
  } catch (error) {
    console.error('dismissReport error:', error);
    return sendError(res, 'Échec du classement', 500);
  }
};

// ─── Fiche utilisateur ───────────────────────────────────────────────────────

/** GET /api/admin/users/:id — fiche de modération. */
export const getUserFile = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: PROJECTION_MODERATION,
    });
    if (!user) return sendError(res, 'Utilisateur introuvable', 404);

    const [signalements, sanctions, recours] = await Promise.all([
      prisma.report.findMany({
        where: { reportedId: id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, reason: true, status: true, createdAt: true },
      }),
      prisma.moderationAction.findMany({
        where: { targetId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, type: true, reason: true, createdAt: true,
          moderator: { select: { email: true } },
        },
      }),
      prisma.appeal.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, createdAt: true },
      }),
    ]);

    await consignerAcces(req.user.id, null, 'USER_FILE');

    return sendSuccess(res, { user, signalements, sanctions, recours });
  } catch (error) {
    console.error('getUserFile error:', error);
    return sendError(res, 'Échec de la récupération de la fiche', 500);
  }
};

// ─── Sanctions ───────────────────────────────────────────────────────────────

/** Refuse d'agir sur un administrateur : la modération ne se retourne pas contre elle-même. */
const verifierCible = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, status: true },
  });
  if (!user) return { erreur: ['Utilisateur introuvable', 404] };
  if (user.role === 'ADMIN') {
    return { erreur: ["Un compte d'administration ne peut pas être sanctionné par cette voie", 403] };
  }
  return { user };
};

/** POST /api/admin/users/:id/suspend */
export const suspendUser = async (req, res) => {
  try {
    const { reason, days, reportId } = req.body;
    if (!reason) return sendError(res, 'Un motif est obligatoire', 400);

    const { user, erreur } = await verifierCible(req.params.id);
    if (erreur) return sendError(res, erreur[0], erreur[1]);

    // Une suspension sans terme reste possible, mais elle doit être un choix explicite :
    // on ne la produit pas par simple omission du paramètre.
    const until = days ? new Date(Date.now() + Number(days) * 86400000) : null;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          status: 'SUSPENDED',
          suspendedAt: new Date(),
          suspendedUntil: until,
          suspensionReason: reason,
        },
      });
      await consignerAction(tx, {
        moderatorId: req.user.id, target: user, type: 'SUSPEND', reason,
        metadata: { days: days || null, reportId: reportId || null },
      });
      await notifier(tx, user.id, 'Compte suspendu',
        until
          ? `Votre compte est suspendu jusqu'au ${until.toLocaleDateString('fr-FR')}. Motif : ${reason}. Vous pouvez contester cette décision.`
          : `Votre compte est suspendu. Motif : ${reason}. Vous pouvez contester cette décision.`,
        { reason, until, appealEndpoint: '/api/appeals' });

      if (reportId) {
        await tx.report.update({
          where: { id: reportId },
          data: { status: 'ACTIONED', resolution: reason, reviewedAt: new Date() },
        });
      }
    });

    return sendSuccess(res, { until }, 'Compte suspendu');
  } catch (error) {
    console.error('suspendUser error:', error);
    return sendError(res, 'Échec de la suspension', 500);
  }
};

/** POST /api/admin/users/:id/unsuspend */
export const unsuspendUser = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return sendError(res, 'Un motif est obligatoire', 400);

    const { user, erreur } = await verifierCible(req.params.id);
    if (erreur) return sendError(res, erreur[0], erreur[1]);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          status: 'ACTIVE',
          suspendedAt: null, suspendedUntil: null, suspensionReason: null,
          scheduledDeletionAt: null,
        },
      });
      await consignerAction(tx, {
        moderatorId: req.user.id, target: user, type: 'UNSUSPEND', reason,
      });
      await notifier(tx, user.id, 'Compte rétabli',
        `Votre compte est de nouveau actif. ${reason}`, { reason });
    });

    return sendSuccess(res, null, 'Compte rétabli');
  } catch (error) {
    console.error('unsuspendUser error:', error);
    return sendError(res, 'Échec du rétablissement', 500);
  }
};

/**
 * POST /api/admin/users/:id/schedule-deletion
 *
 * La suppression n'est jamais immédiate : elle est programmée, annoncée, et
 * suspendue par tout recours. C'est ce qui la rend proportionnée — une suppression
 * instantanée priverait la personne de toute possibilité de se défendre, et de
 * récupérer ses données.
 */
export const scheduleDeletion = async (req, res) => {
  try {
    const { reason, reportId } = req.body;
    if (!reason) return sendError(res, 'Un motif est obligatoire', 400);

    const { user, erreur } = await verifierCible(req.params.id);
    if (erreur) return sendError(res, erreur[0], erreur[1]);

    const date = new Date(Date.now() + DELAI_SUPPRESSION_JOURS * 86400000);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          status: 'PENDING_DELETION',
          suspendedAt: new Date(),
          suspensionReason: reason,
          scheduledDeletionAt: date,
        },
      });
      await consignerAction(tx, {
        moderatorId: req.user.id, target: user, type: 'SCHEDULE_DELETION', reason,
        metadata: { scheduledDeletionAt: date, reportId: reportId || null },
      });
      await notifier(tx, user.id, 'Suppression de compte programmée',
        `Votre compte sera supprimé le ${date.toLocaleDateString('fr-FR')}. Motif : ${reason}. `
        + `Vous pouvez contester cette décision, et exporter vos données d'ici là.`,
        { reason, scheduledDeletionAt: date, exportEndpoint: '/api/auth/me/export' });

      if (reportId) {
        await tx.report.update({
          where: { id: reportId },
          data: { status: 'ACTIONED', resolution: reason, reviewedAt: new Date() },
        });
      }
    });

    return sendSuccess(res, { scheduledDeletionAt: date }, 'Suppression programmée');
  } catch (error) {
    console.error('scheduleDeletion error:', error);
    return sendError(res, 'Échec de la programmation', 500);
  }
};

/** POST /api/admin/users/:id/cancel-deletion */
export const cancelDeletion = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return sendError(res, 'Un motif est obligatoire', 400);

    const { user, erreur } = await verifierCible(req.params.id);
    if (erreur) return sendError(res, erreur[0], erreur[1]);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          status: 'ACTIVE',
          scheduledDeletionAt: null, suspendedAt: null, suspensionReason: null,
        },
      });
      await consignerAction(tx, {
        moderatorId: req.user.id, target: user, type: 'CANCEL_DELETION', reason,
      });
      await notifier(tx, user.id, 'Suppression annulée',
        `La suppression de votre compte est annulée. ${reason}`, { reason });
    });

    return sendSuccess(res, null, 'Suppression annulée');
  } catch (error) {
    console.error('cancelDeletion error:', error);
    return sendError(res, "Échec de l'annulation", 500);
  }
};

// ─── Recours ─────────────────────────────────────────────────────────────────

/** GET /api/admin/appeals */
export const listAppeals = async (req, res) => {
  try {
    const { status } = req.query;
    const appeals = await prisma.appeal.findMany({
      where: status ? { status } : {},
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
      select: {
        id: true, message: true, status: true, createdAt: true, reviewedAt: true, decision: true,
        user: { select: PROJECTION_MODERATION },
      },
    });
    return sendSuccess(res, appeals);
  } catch (error) {
    console.error('listAppeals error:', error);
    return sendError(res, 'Échec de la récupération des recours', 500);
  }
};

/**
 * PUT /api/admin/appeals/:id — statuer sur un recours.
 *
 * Accepter un recours rétablit le compte : la décision de modération est annulée,
 * pas seulement commentée. C'est ce qui distingue une voie de recours réelle d'une
 * boîte à réclamations.
 */
export const reviewAppeal = async (req, res) => {
  try {
    const { id } = req.params;
    const { accept, decision } = req.body;

    if (typeof accept !== 'boolean') return sendError(res, 'Le champ accept (booléen) est requis', 400);
    if (!decision) return sendError(res, 'Un motif de décision est obligatoire', 400);

    const appeal = await prisma.appeal.findUnique({
      where: { id },
      select: { id: true, status: true, user: { select: { id: true, email: true } } },
    });
    if (!appeal) return sendError(res, 'Recours introuvable', 404);
    if (appeal.status !== 'PENDING') return sendError(res, 'Ce recours est déjà traité', 409);

    await prisma.$transaction(async (tx) => {
      await tx.appeal.update({
        where: { id },
        data: {
          status: accept ? 'ACCEPTED' : 'REJECTED',
          decision,
          reviewedById: req.user.id,
          reviewedAt: new Date(),
        },
      });

      if (accept) {
        await tx.user.update({
          where: { id: appeal.user.id },
          data: {
            status: 'ACTIVE',
            suspendedAt: null, suspendedUntil: null, suspensionReason: null,
            scheduledDeletionAt: null,
          },
        });
        await consignerAction(tx, {
          moderatorId: req.user.id, target: appeal.user, type: 'UNSUSPEND',
          reason: `Recours accepté : ${decision}`,
        });
      }

      await notifier(tx, appeal.user.id,
        accept ? 'Recours accepté' : 'Recours rejeté',
        decision, { appealId: id });
    });

    return sendSuccess(res, null, accept ? 'Recours accepté, compte rétabli' : 'Recours rejeté');
  } catch (error) {
    console.error('reviewAppeal error:', error);
    return sendError(res, 'Échec du traitement du recours', 500);
  }
};
