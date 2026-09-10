/**
 * Tâches planifiées de modération.
 *
 * Deux traitements distincts, tous deux imposés par le RGPD :
 *
 *   - l'exécution des suppressions programmées, après le délai de recours ;
 *   - la purge des données de modération devenues inutiles (limitation de la
 *     conservation, article 5.1.e) — un journal gardé indéfiniment n'est plus
 *     proportionné à sa finalité.
 */

import cron from 'node-cron';
import prisma from '../config/database.js';

/** Au-delà, un signalement clos ou un journal d'accès n'a plus d'utilité. */
const RETENTION_MOIS = 12;

const dansNJours = (n) => new Date(Date.now() + n * 86400000);

/**
 * Suppression des comptes arrivés à échéance.
 *
 * Un recours en cours suspend la suppression : c'est la contrepartie du droit de
 * contestation. Sans cette condition, une personne pourrait voir son compte
 * supprimé pendant l'examen de son propre recours.
 */
export const executerSuppressionsProgrammees = async () => {
  const echus = await prisma.user.findMany({
    where: {
      status: 'PENDING_DELETION',
      scheduledDeletionAt: { lte: new Date() },
      appeals: { none: { status: 'PENDING' } },
    },
    select: { id: true, email: true, suspensionReason: true },
  });

  for (const user of echus) {
    try {
      // La trace est écrite AVANT la suppression : après, targetId sera null et
      // plus rien ne permettrait de justifier l'opération.
      await prisma.moderationAction.create({
        data: {
          targetId: user.id,
          targetLabel: user.email,
          type: 'DELETE',
          reason: user.suspensionReason || 'Suppression programmée arrivée à échéance',
          metadata: { executedBy: 'cron' },
        },
      });

      // Les 35 cascades du schéma emportent profil, programmes, séances, messages,
      // statistiques et notifications.
      await prisma.user.delete({ where: { id: user.id } });

      console.log(`[moderation] compte supprimé : ${user.email}`);
    } catch (error) {
      console.error(`[moderation] échec de suppression pour ${user.email} :`, error.message);
    }
  }

  return echus.length;
};

/** Prévient sept jours avant l'échéance, pour laisser le temps de réagir. */
export const notifierSuppressionsProches = async () => {
  const cibles = await prisma.user.findMany({
    where: {
      status: 'PENDING_DELETION',
      scheduledDeletionAt: { gte: new Date(), lte: dansNJours(7) },
    },
    select: { id: true, scheduledDeletionAt: true },
  });

  for (const user of cibles) {
    // Idempotence : une seule alerte par compte, même si la tâche passe chaque jour.
    const dejaPrevenu = await prisma.notification.findFirst({
      where: { userId: user.id, type: 'MODERATION', title: 'Suppression imminente' },
    });
    if (dejaPrevenu) continue;

    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'MODERATION',
        title: 'Suppression imminente',
        body: `Votre compte sera supprimé le ${user.scheduledDeletionAt.toLocaleDateString('fr-FR')}. `
          + `Vous pouvez encore contester cette décision ou exporter vos données.`,
        data: {
          scheduledDeletionAt: user.scheduledDeletionAt,
          exportEndpoint: '/api/auth/me/export',
          appealEndpoint: '/api/appeals',
        },
      },
    });
  }

  return cibles.length;
};

/**
 * Purge des données de modération périmées.
 *
 * On ne touche qu'aux signalements CLOS : un signalement encore ouvert reste utile
 * quel que soit son âge. Les journaux d'accès, eux, sont purgés sur leur seule date.
 */
export const purgerDonneesModeration = async () => {
  const limite = new Date();
  limite.setMonth(limite.getMonth() - RETENTION_MOIS);

  const [signalements, journaux] = await Promise.all([
    prisma.report.deleteMany({
      where: { status: { in: ['DISMISSED', 'ACTIONED'] }, reviewedAt: { lt: limite } },
    }),
    prisma.moderationAccessLog.deleteMany({ where: { createdAt: { lt: limite } } }),
  ]);

  if (signalements.count || journaux.count) {
    console.log(
      `[moderation] purge : ${signalements.count} signalement(s), ${journaux.count} journal/journaux`
    );
  }

  return { signalements: signalements.count, journaux: journaux.count };
};

// Une fois par jour à 3 h : hors des heures d'usage, et la granularité du jour
// suffit pour des échéances exprimées en jours.
//
// Pas de planification en test : la suite importe ce module pour appeler les
// fonctions directement, et un cron actif empêcherait le processus de rendre la
// main — les tests tourneraient indéfiniment après leur dernière assertion.
if (process.env.NODE_ENV !== 'test') {
cron.schedule('0 3 * * *', async () => {
  try {
    await notifierSuppressionsProches();
    await executerSuppressionsProgrammees();
    await purgerDonneesModeration();
  } catch (error) {
    console.error('[moderation] erreur de la tâche planifiée :', error);
  }
});
}
