/**
 * Recours contre une sanction.
 *
 * Ce contrôleur est le seul du projet monté derrière `authenticateEvenIfSuspended` :
 * une personne sanctionnée doit pouvoir contester, sans quoi le droit de recours
 * n'existerait que sur le papier. C'est aussi ce qui distingue une décision
 * révisable d'une décision définitive prise sans contradictoire (article 22).
 */

import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

/** POST /api/appeals — déposer un recours. */
export const createAppeal = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || message.trim().length < 10) {
      return sendError(res, 'Merci d\'expliquer votre contestation (10 caractères minimum)', 400);
    }

    // Contester suppose une décision à contester.
    if (req.user.status === 'ACTIVE') {
      return sendError(res, "Aucune sanction n'est en cours sur votre compte", 400);
    }

    const enCours = await prisma.appeal.findFirst({
      where: { userId: req.user.id, status: 'PENDING' },
      select: { id: true, createdAt: true },
    });
    if (enCours) {
      return sendError(res, 'Un recours est déjà en cours d\'examen', 409);
    }

    const appeal = await prisma.appeal.create({
      data: { userId: req.user.id, message: message.trim() },
      select: { id: true, status: true, createdAt: true },
    });

    return sendSuccess(
      res,
      appeal,
      'Recours enregistré. Toute suppression programmée est suspendue jusqu\'à son examen.',
      201
    );
  } catch (error) {
    console.error('createAppeal error:', error);
    return sendError(res, 'Échec du dépôt du recours', 500);
  }
};

/** GET /api/appeals/mine — suivre ses recours. */
export const getMyAppeals = async (req, res) => {
  try {
    const appeals = await prisma.appeal.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, message: true, status: true, decision: true,
        createdAt: true, reviewedAt: true,
      },
    });
    return sendSuccess(res, appeals);
  } catch (error) {
    console.error('getMyAppeals error:', error);
    return sendError(res, 'Échec de la récupération des recours', 500);
  }
};
