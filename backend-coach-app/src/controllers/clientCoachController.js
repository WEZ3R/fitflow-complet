import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import { canAccessClient, canAccessRelation, resolveProfiles } from '../utils/authorization.js';

/**
 * Ajouter un coach à un client
 */
export const addCoachToClient = async (req, res) => {
  try {
    const { clientId, coachId, isPrimary } = req.body;

    // Vérifier si la relation existe déjà
    const existingRelation = await prisma.clientCoach.findUnique({
      where: {
        clientId_coachId: {
          clientId,
          coachId,
        },
      },
    });

    if (existingRelation) {
      return sendError(res, 'Cette relation client-coach existe déjà', 400);
    }

    // Si c'est le coach principal, retirer le statut des autres
    if (isPrimary) {
      await prisma.clientCoach.updateMany({
        where: { clientId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    // Créer la relation
    const clientCoach = await prisma.clientCoach.create({
      data: {
        clientId,
        coachId,
        isPrimary: isPrimary || false,
        isActive: true,
      },
      include: {
        coach: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    sendSuccess(res, clientCoach, 'Coach ajouté avec succès', 201);
  } catch (error) {
    console.error('Add coach to client error:', error);
    sendError(res, 'Failed to add coach to client', 500);
  }
};

/**
 * Obtenir tous les coaches d'un client
 */
export const getClientCoaches = async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!(await canAccessClient(req.user.id, clientId))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    const clientCoaches = await prisma.clientCoach.findMany({
      where: {
        clientId,
        isActive: true,
      },
      include: {
        coach: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    sendSuccess(res, clientCoaches);
  } catch (error) {
    console.error('Get client coaches error:', error);
    sendError(res, 'Failed to get client coaches', 500);
  }
};

/**
 * Obtenir tous les clients d'un coach
 */
export const getCoachClients = async (req, res) => {
  try {
    const { coachId } = req.params;

    const { coachProfile } = await resolveProfiles(req.user.id);
    if (coachProfile?.id !== coachId) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    const coachClients = await prisma.clientCoach.findMany({
      where: {
        coachId,
        isActive: true,
      },
      include: {
        client: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    sendSuccess(res, coachClients);
  } catch (error) {
    console.error('Get coach clients error:', error);
    sendError(res, 'Failed to get coach clients', 500);
  }
};

/**
 * Définir un coach comme principal pour un client
 */
export const setPrimaryCoach = async (req, res) => {
  try {
    const { id } = req.params; // ID de la relation ClientCoach

    if (!(await canAccessRelation(req.user.id, id))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    const relation = await prisma.clientCoach.findUnique({
      where: { id },
    });

    if (!relation) {
      return sendError(res, 'Relation not found', 404);
    }

    // Retirer le statut principal des autres coaches
    await prisma.clientCoach.updateMany({
      where: {
        clientId: relation.clientId,
        isPrimary: true,
      },
      data: { isPrimary: false },
    });

    // Définir ce coach comme principal
    const updatedRelation = await prisma.clientCoach.update({
      where: { id },
      data: { isPrimary: true },
      include: {
        coach: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Mettre à jour aussi le champ coachId dans ClientProfile pour rétrocompatibilité
    await prisma.clientProfile.update({
      where: { id: relation.clientId },
      data: { coachId: relation.coachId },
    });

    sendSuccess(res, updatedRelation, 'Coach principal défini avec succès');
  } catch (error) {
    console.error('Set primary coach error:', error);
    sendError(res, 'Failed to set primary coach', 500);
  }
};

/**
 * Désactiver une relation client-coach
 */
export const removeCoachFromClient = async (req, res) => {
  try {
    const { id } = req.params;

    if (!(await canAccessRelation(req.user.id, id))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    const relation = await prisma.clientCoach.update({
      where: { id },
      data: {
        isActive: false,
        endDate: new Date(),
      },
    });

    // Si c'était le coach principal, retirer coachId du ClientProfile
    if (relation.isPrimary) {
      await prisma.clientProfile.update({
        where: { id: relation.clientId },
        data: { coachId: null },
      });
    }

    sendSuccess(res, relation, 'Coach retiré avec succès');
  } catch (error) {
    console.error('Remove coach from client error:', error);
    sendError(res, 'Failed to remove coach from client', 500);
  }
};
