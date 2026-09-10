import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import { saveUpload } from '../services/fileStorage.js';
import { canAccessClient } from '../utils/authorization.js';

/**
 * Créer un repas
 */
export const createMeal = async (req, res) => {
  try {
    const { clientId, date, mealType, description, calories, protein, carbs, fats } = req.body;

    if (!(await canAccessClient(req.user.id, clientId))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    // Si une image est uploadée. saveUpload renvoie null si req.file est absent.
    const photoUrl = await saveUpload(req.file);

    const meal = await prisma.meal.create({
      data: {
        clientId,
        date: new Date(date),
        mealType,
        description,
        photoUrl,
        calories: parseInt(calories),
        protein: protein ? parseFloat(protein) : null,
        carbs: carbs ? parseFloat(carbs) : null,
        fats: fats ? parseFloat(fats) : null,
      },
    });

    // Mettre à jour les stats quotidiennes
    await updateDailyCalories(clientId, date);

    sendSuccess(res, meal, 'Meal created successfully', 201);
  } catch (error) {
    console.error('Create meal error:', error);
    sendError(res, 'Failed to create meal', 500);
  }
};

/**
 * Récupérer les repas d'un client
 */
export const getClientMeals = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.query;

    if (!(await canAccessClient(req.user.id, clientId))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    const where = {
      clientId,
      ...(startDate &&
        endDate && {
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
    };

    const meals = await prisma.meal.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    sendSuccess(res, meals);
  } catch (error) {
    console.error('Get meals error:', error);
    sendError(res, 'Failed to get meals', 500);
  }
};

/**
 * Mettre à jour un repas
 */
export const updateMeal = async (req, res) => {
  try {
    const { id } = req.params;
    const { mealType, description, calories, protein, carbs, fats } = req.body;

    const existing = await prisma.meal.findUnique({ where: { id }, select: { clientId: true } });
    if (!existing) return sendError(res, 'Repas introuvable', 404);
    if (!(await canAccessClient(req.user.id, existing.clientId))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    const meal = await prisma.meal.update({
      where: { id },
      data: {
        mealType,
        description,
        calories: calories ? parseInt(calories) : undefined,
        protein: protein ? parseFloat(protein) : undefined,
        carbs: carbs ? parseFloat(carbs) : undefined,
        fats: fats ? parseFloat(fats) : undefined,
      },
    });

    // Mettre à jour les stats quotidiennes
    await updateDailyCalories(meal.clientId, meal.date);

    sendSuccess(res, meal, 'Meal updated successfully');
  } catch (error) {
    console.error('Update meal error:', error);
    sendError(res, 'Failed to update meal', 500);
  }
};

/**
 * Supprimer un repas
 */
export const deleteMeal = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.meal.findUnique({ where: { id }, select: { clientId: true } });
    if (!existing) return sendError(res, 'Repas introuvable', 404);
    if (!(await canAccessClient(req.user.id, existing.clientId))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    const meal = await prisma.meal.delete({
      where: { id },
    });

    // Mettre à jour les stats quotidiennes
    await updateDailyCalories(meal.clientId, meal.date);

    sendSuccess(res, null, 'Meal deleted successfully');
  } catch (error) {
    console.error('Delete meal error:', error);
    sendError(res, 'Failed to delete meal', 500);
  }
};

/**
 * Fonction helper pour mettre à jour les calories totales du jour
 */
async function updateDailyCalories(clientId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Calculer le total des calories du jour
  const meals = await prisma.meal.findMany({
    where: {
      clientId,
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);

  // Mettre à jour ou créer la stat quotidienne
  await prisma.dailyStat.upsert({
    where: {
      clientId_date: {
        clientId,
        date: startOfDay,
      },
    },
    update: {
      totalCalories,
    },
    create: {
      clientId,
      date: startOfDay,
      totalCalories,
    },
  });
}
