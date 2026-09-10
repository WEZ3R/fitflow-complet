import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import { ownsTemplate } from '../utils/authorization.js';
import { computeNutrition } from './nutrition.controller.js';

/**
 * Créer un template à partir d'un programme existant ou nouveau
 */
export const createTemplate = async (req, res) => {
  try {
    const {
      name,
      description,
      cycleDays,
      dietEnabled,
      dietType,
      targetCalories,
      waterTrackingEnabled,
      waterGoal,
      sleepTrackingEnabled,
      weightTrackingEnabled,
      sessionsData,
      customGoalsData,
      nutritionObjective,
      nutritionActivityFactor,
      nutritionSurplus,
      nutritionDeficit,
      programId, // Optionnel : ID du programme source
    } = req.body;
    const coachId = req.user.id;

    // Récupérer le profil coach
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: coachId },
    });

    if (!coachProfile) {
      return sendError(res, 'Coach profile not found', 404);
    }

    // Si un programId est fourni, récupérer les données du programme
    let templateData = {
      coachId: coachProfile.id,
      name,
      description,
      cycleDays: cycleDays ? parseInt(cycleDays) : null,
      dietEnabled: dietEnabled || false,
      dietType: dietType || null,
      targetCalories: targetCalories ? parseInt(targetCalories) : null,
      waterTrackingEnabled: waterTrackingEnabled || false,
      waterGoal: waterGoal ? parseFloat(waterGoal) : null,
      sleepTrackingEnabled: sleepTrackingEnabled || false,
      weightTrackingEnabled: weightTrackingEnabled || false,
      sessionsData: sessionsData || null,
      customGoalsData: customGoalsData || null,
      nutritionObjective: nutritionObjective || null,
      nutritionActivityFactor: nutritionActivityFactor ? parseFloat(nutritionActivityFactor) : null,
      nutritionSurplus: nutritionSurplus ? parseInt(nutritionSurplus) : null,
      nutritionDeficit: nutritionDeficit ? parseInt(nutritionDeficit) : null,
    };

    if (programId) {
      // Récupérer le programme source avec toutes ses données
      const sourceProgram = await prisma.program.findUnique({
        where: { id: programId },
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
      });

      if (!sourceProgram) {
        return sendError(res, 'Source program not found', 404);
      }

      // Vérifier que le coach est bien le propriétaire du programme
      if (sourceProgram.coachId !== coachProfile.id) {
        return sendError(res, 'Unauthorized to copy this program', 403);
      }

      // Convertir les sessions en structure JSON
      const sessionsStructure = sourceProgram.sessions.map(session => ({
        dayNumber: Math.floor(
          (new Date(session.date) - new Date(sourceProgram.startDate)) /
            (1000 * 60 * 60 * 24)
        ),
        isRestDay: session.isRestDay,
        notes: session.notes,
        exercises: session.exercises.map(ex => ({
          name: ex.name,
          category: ex.category,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
          restTime: ex.restTime,
          videoUrl: ex.videoUrl,
          gifUrl: ex.gifUrl,
          description: ex.description,
          order: ex.order,
        })),
      }));

      // Convertir les objectifs personnalisés en structure JSON
      const customGoalsStructure = sourceProgram.customGoals.map(goal => ({
        title: goal.title,
        description: goal.description,
        order: goal.order,
      }));

      templateData = {
        ...templateData,
        cycleDays: sourceProgram.cycleDays,
        dietEnabled: sourceProgram.dietEnabled,
        dietType: sourceProgram.dietType,
        targetCalories: sourceProgram.targetCalories,
        waterTrackingEnabled: sourceProgram.waterTrackingEnabled,
        waterGoal: sourceProgram.waterGoal,
        sleepTrackingEnabled: sourceProgram.sleepTrackingEnabled,
        weightTrackingEnabled: sourceProgram.weightTrackingEnabled,
        sessionsData: sessionsStructure,
        customGoalsData: customGoalsStructure,
      };
    }

    const template = await prisma.programTemplate.create({
      data: templateData,
    });

    sendSuccess(res, template, 'Template created successfully', 201);
  } catch (error) {
    console.error('Create template error:', error);
    sendError(res, 'Failed to create template', 500);
  }
};

/**
 * Récupérer tous les templates d'un coach
 */
export const getCoachTemplates = async (req, res) => {
  try {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!coachProfile) {
      return sendError(res, 'Coach profile not found', 404);
    }

    const templates = await prisma.programTemplate.findMany({
      where: { coachId: coachProfile.id },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, templates);
  } catch (error) {
    console.error('Get coach templates error:', error);
    sendError(res, 'Failed to get templates', 500);
  }
};

/**
 * Récupérer un template par ID
 */
export const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!(await ownsTemplate(req.user.id, id))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    const template = await prisma.programTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return sendError(res, 'Template not found', 404);
    }

    sendSuccess(res, template);
  } catch (error) {
    console.error('Get template error:', error);
    sendError(res, 'Failed to get template', 500);
  }
};

/**
 * Créer un programme à partir d'un template
 */
export const applyTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { clientId, title, description, startDate, endDate } = req.body;
    const coachId = req.user.id;

    // Récupérer le profil coach
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: coachId },
      include: {
        clients: {
          where: { id: clientId },
        },
      },
    });

    if (!coachProfile || coachProfile.clients.length === 0) {
      return sendError(res, 'Client not found or not assigned to this coach', 403);
    }

    // Récupérer le template
    const template = await prisma.programTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return sendError(res, 'Template not found', 404);
    }

    // Vérifier que le template appartient au coach
    if (template.coachId !== coachProfile.id) {
      return sendError(res, 'Unauthorized to use this template', 403);
    }

    const programStartDate = new Date(startDate);

    // Calcul automatique des calories si le template a des paramètres nutritionnels
    let resolvedTargetCalories = template.targetCalories;

    if (
      template.dietEnabled &&
      template.dietType === 'calories' &&
      template.nutritionObjective &&
      template.nutritionActivityFactor
    ) {
      const clientProfile = await prisma.clientProfile.findUnique({
        where: { id: clientId },
        select: { weight: true, height: true, dateOfBirth: true, gender: true },
      });

      if (clientProfile?.weight && clientProfile?.height && clientProfile?.dateOfBirth && clientProfile?.gender) {
        const today = new Date();
        const dob = new Date(clientProfile.dateOfBirth);
        let age = today.getFullYear() - dob.getFullYear();
        if (
          today.getMonth() < dob.getMonth() ||
          (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
        ) age--;

        const calc = computeNutrition({
          gender:         clientProfile.gender,
          weight:         clientProfile.weight,
          height:         clientProfile.height,
          age,
          activityFactor: template.nutritionActivityFactor,
          objective:      template.nutritionObjective,
          surplus:        template.nutritionSurplus ?? undefined,
          deficit:        template.nutritionDeficit ?? undefined,
        });
        resolvedTargetCalories = calc.calories_cible;
      }
    }

    // Créer le programme avec les custom goals
    const program = await prisma.program.create({
      data: {
        coachId: coachProfile.id,
        clientId,
        title: title || template.name,
        description: description || template.description,
        cycleDays: template.cycleDays,
        startDate: programStartDate,
        endDate: endDate ? new Date(endDate) : null,
        dietEnabled: template.dietEnabled,
        dietType: template.dietType,
        targetCalories: resolvedTargetCalories,
        waterTrackingEnabled: template.waterTrackingEnabled,
        waterGoal: template.waterGoal,
        sleepTrackingEnabled: template.sleepTrackingEnabled,
        weightTrackingEnabled: template.weightTrackingEnabled,
        customGoals: {
          create: template.customGoalsData
            ? template.customGoalsData.map(goal => ({
                title: goal.title,
                description: goal.description || null,
                order: goal.order,
              }))
            : [],
        },
      },
    });

    // Créer les sessions à partir du template
    if (template.sessionsData && Array.isArray(template.sessionsData)) {
      for (const sessionTemplate of template.sessionsData) {
        const sessionDate = new Date(programStartDate);
        sessionDate.setDate(sessionDate.getDate() + sessionTemplate.dayNumber);

        await prisma.session.create({
          data: {
            programId: program.id,
            date: sessionDate,
            isRestDay: sessionTemplate.isRestDay,
            notes: sessionTemplate.notes,
            status: sessionTemplate.isRestDay ? 'EMPTY' : 'DRAFT',
            exercises: {
              create: sessionTemplate.exercises.map(ex => ({
                name: ex.name,
                category: ex.category,
                sets: ex.sets,
                reps: ex.reps,
                weight: ex.weight,
                restTime: ex.restTime,
                videoUrl: ex.videoUrl,
                gifUrl: ex.gifUrl,
                description: ex.description,
                order: ex.order,
              })),
            },
          },
        });
      }
    }

    // Récupérer le programme complet avec toutes les relations
    const fullProgram = await prisma.program.findUnique({
      where: { id: program.id },
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
    });

    sendSuccess(res, fullProgram, 'Program created from template successfully', 201);
  } catch (error) {
    console.error('Apply template error:', error);
    sendError(res, 'Failed to apply template', 500);
  }
};

/**
 * Mettre à jour un template (tous les champs)
 */
export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, description, cycleDays,
      dietEnabled, dietType, targetCalories,
      waterTrackingEnabled, waterGoal,
      sleepTrackingEnabled, weightTrackingEnabled,
      sessionsData, customGoalsData,
      nutritionObjective, nutritionActivityFactor, nutritionSurplus, nutritionDeficit,
    } = req.body;

    const coachProfile = await prisma.coachProfile.findUnique({ where: { userId: req.user.id } });
    if (!coachProfile) return sendError(res, 'Coach profile not found', 404);

    const existing = await prisma.programTemplate.findUnique({ where: { id } });
    if (!existing) return sendError(res, 'Template not found', 404);
    if (existing.coachId !== coachProfile.id) return sendError(res, 'Unauthorized', 403);

    const template = await prisma.programTemplate.update({
      where: { id },
      data: {
        name,
        description: description ?? null,
        cycleDays: cycleDays !== undefined ? (cycleDays ? parseInt(cycleDays) : null) : undefined,
        dietEnabled: dietEnabled ?? undefined,
        dietType: dietType ?? null,
        targetCalories: targetCalories !== undefined ? (targetCalories ? parseInt(targetCalories) : null) : undefined,
        waterTrackingEnabled: waterTrackingEnabled ?? undefined,
        waterGoal: waterGoal !== undefined ? (waterGoal ? parseFloat(waterGoal) : null) : undefined,
        sleepTrackingEnabled: sleepTrackingEnabled ?? undefined,
        weightTrackingEnabled: weightTrackingEnabled ?? undefined,
        sessionsData: sessionsData !== undefined ? sessionsData : undefined,
        customGoalsData: customGoalsData !== undefined ? customGoalsData : undefined,
        nutritionObjective: nutritionObjective !== undefined ? (nutritionObjective || null) : undefined,
        nutritionActivityFactor: nutritionActivityFactor !== undefined ? (nutritionActivityFactor ? parseFloat(nutritionActivityFactor) : null) : undefined,
        nutritionSurplus: nutritionSurplus !== undefined ? (nutritionSurplus ? parseInt(nutritionSurplus) : null) : undefined,
        nutritionDeficit: nutritionDeficit !== undefined ? (nutritionDeficit ? parseInt(nutritionDeficit) : null) : undefined,
      },
    });

    sendSuccess(res, template, 'Template updated successfully');
  } catch (error) {
    console.error('Update template error:', error);
    sendError(res, 'Failed to update template', 500);
  }
};

/**
 * Supprimer un template
 */
export const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    if (!(await ownsTemplate(req.user.id, id))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    await prisma.programTemplate.delete({
      where: { id },
    });

    sendSuccess(res, null, 'Template deleted successfully');
  } catch (error) {
    console.error('Delete template error:', error);
    sendError(res, 'Failed to delete template', 500);
  }
};
