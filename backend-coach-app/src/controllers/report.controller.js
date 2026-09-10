import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import { resolveProfiles } from '../utils/authorization.js';

const MOTIFS = ['HARASSMENT', 'SPAM', 'INAPPROPRIATE_CONTENT', 'FAKE_PROFILE', 'OTHER'];
const CONTEXTES = ['PROFILE', 'CONVERSATION'];

/**
 * POST /api/reports — signaler un utilisateur.
 *
 * Deux points d'entrée dans l'application : la fiche d'un profil, et une conversation.
 * Le second permet de désigner un message précis, ce qui évite à l'administrateur
 * d'avoir à chercher ce qui pose problème dans un fil entier.
 */
export const createReport = async (req, res) => {
  try {
    const { reportedUserId, reason, description, context, messageId } = req.body;
    const reporterId = req.user.id;

    if (!reportedUserId || !reason || !context) {
      return sendError(res, 'Utilisateur signalé, motif et contexte sont requis', 400);
    }
    if (!MOTIFS.includes(reason)) {
      return sendError(res, `Motif invalide. Valeurs acceptées : ${MOTIFS.join(', ')}`, 400);
    }
    if (!CONTEXTES.includes(context)) {
      return sendError(res, `Contexte invalide. Valeurs acceptées : ${CONTEXTES.join(', ')}`, 400);
    }
    if (reportedUserId === reporterId) {
      return sendError(res, 'Vous ne pouvez pas vous signaler vous-même', 400);
    }

    const signale = await prisma.user.findUnique({
      where: { id: reportedUserId },
      select: { id: true, role: true },
    });
    if (!signale) return sendError(res, 'Utilisateur introuvable', 404);

    // Signaler un administrateur ouvrirait la porte au harcèlement de la modération
    // et n'aurait aucun destinataire : ce sont eux qui traitent les signalements.
    if (signale.role === 'ADMIN') {
      return sendError(res, "Un compte d'administration ne peut pas être signalé", 400);
    }

    // Un message ne peut être joint que si le signalant a réellement accès à la
    // conversation qui le contient. Sans ce contrôle, n'importe qui pourrait faire
    // remonter à la modération le message privé de deux inconnus.
    if (messageId) {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { id: true, coachId: true, clientId: true },
      });
      if (!message) return sendError(res, 'Message introuvable', 404);

      const { coachProfile, clientProfile } = await resolveProfiles(reporterId);
      const participe =
        (coachProfile && coachProfile.id === message.coachId) ||
        (clientProfile && clientProfile.id === message.clientId);

      if (!participe) {
        return sendError(res, "Ce message n'appartient pas à l'une de vos conversations", 403);
      }
    }

    // Empiler les signalements en attente contre la même personne n'apporte rien à la
    // modération et permettrait de saturer la file. On enrichit plutôt l'existant.
    const enAttente = await prisma.report.findFirst({
      where: {
        reporterId,
        reportedId: reportedUserId,
        status: { in: ['PENDING', 'REVIEWING'] },
      },
    });
    if (enAttente) {
      return sendError(
        res,
        'Vous avez déjà un signalement en cours de traitement sur cette personne',
        409
      );
    }

    const report = await prisma.report.create({
      data: {
        reporterId,
        reportedId: reportedUserId,
        reason,
        description: description || null,
        context,
        messageId: messageId || null,
      },
      select: { id: true, reason: true, context: true, status: true, createdAt: true },
    });

    return sendSuccess(res, report, 'Signalement transmis à la modération', 201);
  } catch (error) {
    console.error('createReport error:', error);
    return sendError(res, 'Échec de la création du signalement', 500);
  }
};

/**
 * GET /api/reports/mine — suivi de ses propres signalements.
 *
 * Le signalant a le droit de savoir ce qu'est devenu son signalement, mais pas
 * d'apprendre quelle sanction a été prise : ce serait une donnée personnelle
 * concernant un tiers. On renvoie donc le statut, pas la décision.
 */
export const getMyReports = async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
      where: { reporterId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        reason: true,
        context: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
      },
    });
    return sendSuccess(res, reports);
  } catch (error) {
    console.error('getMyReports error:', error);
    return sendError(res, 'Échec de la récupération des signalements', 500);
  }
};
