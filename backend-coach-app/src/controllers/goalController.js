import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import { canAccessProgram } from '../utils/authorization.js';

/**
 * Toggle la completion d'un objectif personnalisé pour une date donnée
 */
export const toggleGoalCompletion = async (req, res) => {
  try {
    const { goalId } = req.params;
    const { date, completed } = req.body;
    const userId = req.user.id;

    // Récupérer le profil client
    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId },
    });

    if (!clientProfile) {
      return sendError(res, 'Client profile not found', 404);
    }

    // Vérifier que l'objectif existe
    const goal = await prisma.customGoal.findUnique({
      where: { id: goalId },
      select: { id: true, programId: true },
    });

    if (!goal) {
      return sendError(res, 'Goal not found', 404);
    }

    // Un CustomGoal appartient à un Program, jamais directement au client : sans cette
    // vérification, n'importe qui pouvait valider l'objectif du programme d'un autre.
    if (!(await canAccessProgram(req.user.id, goal.programId))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    const completionDate = new Date(date);
    completionDate.setHours(0, 0, 0, 0);

    // Upsert la completion
    const completion = await prisma.goalCompletion.upsert({
      where: {
        customGoalId_clientId_date: {
          customGoalId: goalId,
          clientId: clientProfile.id,
          date: completionDate,
        },
      },
      update: {
        completed,
      },
      create: {
        customGoalId: goalId,
        clientId: clientProfile.id,
        date: completionDate,
        completed,
      },
    });

    sendSuccess(res, completion, 'Goal completion updated successfully');
  } catch (error) {
    console.error('Toggle goal completion error:', error);
    sendError(res, 'Failed to update goal completion', 500);
  }
};

/**
 * Récupérer toutes les completions d'objectifs pour un client et une date
 */
export const getGoalCompletions = async (req, res) => {
  try {
    const { date } = req.query;
    const userId = req.user.id;

    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId },
    });

    if (!clientProfile) {
      return sendError(res, 'Client profile not found', 404);
    }

    const completionDate = new Date(date);
    completionDate.setHours(0, 0, 0, 0);

    const completions = await prisma.goalCompletion.findMany({
      where: {
        clientId: clientProfile.id,
        date: completionDate,
      },
      include: {
        customGoal: true,
      },
    });

    sendSuccess(res, completions);
  } catch (error) {
    console.error('Get goal completions error:', error);
    sendError(res, 'Failed to get goal completions', 500);
  }
};
