import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

/**
 * Créer un nouveau programme
 */
export const createProgram = async (req, res) => {
  try {
    const {
      clientId,
      title,
      description,
      cycleDays,
      startDate,
      endDate,
      dietEnabled,
      dietType,
      targetCalories,
      waterTrackingEnabled,
      waterGoal,
      sleepTrackingEnabled,
      weightTrackingEnabled,
      customGoals
    } = req.body;
    const coachId = req.user.id;

    // Vérifier que le coach a bien ce client (ancienne relation directe OU nouvelle table M2M)
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: coachId },
      include: {
        clients: { where: { id: clientId } },
        clientCoaches: { where: { clientId, isActive: true } },
      },
    });

    if (!coachProfile || (coachProfile.clients.length === 0 && coachProfile.clientCoaches.length === 0)) {
      return sendError(res, 'Client not found or not assigned to this coach', 403);
    }

    const program = await prisma.program.create({
      data: {
        coachId: coachProfile.id,
        clientId,
        title,
        description,
        cycleDays: cycleDays ? parseInt(cycleDays) : null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        dietEnabled: dietEnabled || false,
        dietType: dietType || null,
        targetCalories: targetCalories ? parseInt(targetCalories) : null,
        waterTrackingEnabled: waterTrackingEnabled || false,
        waterGoal: waterGoal ? parseFloat(waterGoal) : null,
        sleepTrackingEnabled: sleepTrackingEnabled || false,
        weightTrackingEnabled: weightTrackingEnabled || false,
        customGoals: {
          create: customGoals && Array.isArray(customGoals)
            ? customGoals.map((goal, index) => ({
                title: goal.title,
                description: goal.description || null,
                order: index
              }))
            : []
        }
      },
      include: {
        customGoals: {
          orderBy: { order: 'asc' }
        }
      }
    });

    sendSuccess(res, program, 'Program created successfully', 201);
  } catch (error) {
    console.error('Create program error:', error);
    sendError(res, 'Failed to create program', 500);
  }
};

/**
 * Récupérer tous les programmes d'un coach
 */
export const getCoachPrograms = async (req, res) => {
  try {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!coachProfile) {
      return sendError(res, 'Coach profile not found', 404);
    }

    const programs = await prisma.program.findMany({
      where: { coachId: coachProfile.id },
      include: {
        sessions: {
          include: {
            exercises: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { date: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, programs);
  } catch (error) {
    console.error('Get coach programs error:', error);
    sendError(res, 'Failed to get programs', 500);
  }
};

/**
 * Récupérer tous les programmes d'un client
 */
export const getClientPrograms = async (req, res) => {
  try {
    // clientId dans Program = ClientProfile.id (pas User.id)
    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!clientProfile) {
      return sendSuccess(res, []);
    }

    const programs = await prisma.program.findMany({
      where: { clientId: clientProfile.id },
      include: {
        sessions: {
          include: {
            exercises: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { date: 'asc' },
        },
        customGoals: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, programs);
  } catch (error) {
    console.error('Get client programs error:', error);
    sendError(res, 'Failed to get programs', 500);
  }
};

/**
 * Récupérer un programme par ID
 */
export const getProgramById = async (req, res) => {
  try {
    const { id } = req.params;

    const program = await prisma.program.findUnique({
      where: { id },
      include: {
        sessions: {
          include: {
            exercises: {
              orderBy: { order: 'asc' },
            },
            comments: true,
          },
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!program) {
      return sendError(res, 'Program not found', 404);
    }

    // Vérifier que l'utilisateur a accès au programme (coach propriétaire ou client assigné)
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.user.id },
    });
    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId: req.user.id },
    });

    const isCoachOwner = coachProfile && program.coachId === coachProfile.id;
    const isAssignedClient = clientProfile && program.clientId === clientProfile.id;

    if (!isCoachOwner && !isAssignedClient) {
      return sendError(res, 'Vous n\'avez pas accès à ce programme', 403);
    }

    sendSuccess(res, program);
  } catch (error) {
    console.error('Get program error:', error);
    sendError(res, 'Failed to get program', 500);
  }
};

/**
 * Mettre à jour un programme
 */
export const updateProgram = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, cycleDays, endDate, isActive } = req.body;

    // Vérifier que le programme existe
    const existingProgram = await prisma.program.findUnique({
      where: { id },
    });

    if (!existingProgram) {
      return sendError(res, 'Program not found', 404);
    }

    // Vérifier que le coach est propriétaire du programme
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!coachProfile || existingProgram.coachId !== coachProfile.id) {
      return sendError(res, 'Vous n\'êtes pas autorisé à modifier ce programme', 403);
    }

    const program = await prisma.program.update({
      where: { id },
      data: {
        title,
        description,
        cycleDays,
        endDate: endDate ? new Date(endDate) : null,
        isActive,
      },
    });

    sendSuccess(res, program, 'Program updated successfully');
  } catch (error) {
    console.error('Update program error:', error);
    sendError(res, 'Failed to update program', 500);
  }
};

/**
 * Supprimer un programme
 */
export const deleteProgram = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que le programme existe
    const existingProgram = await prisma.program.findUnique({
      where: { id },
    });

    if (!existingProgram) {
      return sendError(res, 'Program not found', 404);
    }

    // Vérifier que le coach est propriétaire du programme
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!coachProfile || existingProgram.coachId !== coachProfile.id) {
      return sendError(res, 'Vous n\'êtes pas autorisé à supprimer ce programme', 403);
    }

    await prisma.program.delete({
      where: { id },
    });

    sendSuccess(res, null, 'Program deleted successfully');
  } catch (error) {
    console.error('Delete program error:', error);
    sendError(res, 'Failed to delete program', 500);
  }
};
