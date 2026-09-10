import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

/**
 * Créer ou mettre à jour les stats quotidiennes
 */
export const upsertDailyStat = async (req, res) => {
  try {
    const { clientId, date, sleepHours, bedTime, wakeTime, waterIntake, weight, workoutTime, workoutDuration, notes } =
      req.body;

    // Vérifier l'autorisation sur le clientId
    const userRole = req.user.role;

    if (userRole === 'CLIENT') {
      const clientProfile = await prisma.clientProfile.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (!clientProfile || clientProfile.id !== clientId) {
        return sendError(res, 'Vous n\'êtes pas autorisé à modifier les stats de ce client', 403);
      }
    } else if (userRole === 'COACH') {
      const coachProfile = await prisma.coachProfile.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (!coachProfile) {
        return sendError(res, 'Vous n\'êtes pas autorisé à modifier les stats de ce client', 403);
      }
      const relation = await prisma.clientCoach.findFirst({
        where: { coachId: coachProfile.id, clientId, isActive: true },
      });
      if (!relation) {
        return sendError(res, 'Vous n\'êtes pas autorisé à modifier les stats de ce client', 403);
      }
    }

    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    const stat = await prisma.dailyStat.upsert({
      where: {
        clientId_date: {
          clientId,
          date: dateObj,
        },
      },
      update: {
        sleepHours: sleepHours ? parseFloat(sleepHours) : undefined,
        bedTime: bedTime ? new Date(bedTime) : undefined,
        wakeTime: wakeTime ? new Date(wakeTime) : undefined,
        waterIntake: waterIntake ? parseFloat(waterIntake) : undefined,
        weight: weight ? parseFloat(weight) : undefined,
        workoutTime: workoutTime ? new Date(workoutTime) : undefined,
        workoutDuration: workoutDuration ? parseInt(workoutDuration) : undefined,
        notes,
      },
      create: {
        clientId,
        date: dateObj,
        sleepHours: sleepHours ? parseFloat(sleepHours) : null,
        bedTime: bedTime ? new Date(bedTime) : null,
        wakeTime: wakeTime ? new Date(wakeTime) : null,
        waterIntake: waterIntake ? parseFloat(waterIntake) : null,
        weight: weight ? parseFloat(weight) : null,
        workoutTime: workoutTime ? new Date(workoutTime) : null,
        workoutDuration: workoutDuration ? parseInt(workoutDuration) : null,
        notes,
      },
    });

    sendSuccess(res, stat, 'Daily stats saved successfully');
  } catch (error) {
    console.error('Upsert daily stat error:', error);
    sendError(res, 'Failed to save daily stats', 500);
  }
};

/**
 * Vérifier que l'utilisateur a accès aux stats d'un client
 * Retourne true si accès autorisé, false sinon
 */
async function canAccessClientStats(userId, clientId) {
  // Le client accède à ses propres stats
  const clientProfile = await prisma.clientProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (clientProfile?.id === clientId) return true;

  // Le coach accède aux stats d'un de ses clients
  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!coachProfile) return false;

  const relation = await prisma.clientCoach.findFirst({
    where: { coachId: coachProfile.id, clientId, isActive: true },
  });
  return !!relation;
}

/**
 * Récupérer les stats d'un client
 */
export const getClientStats = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.query;

    if (!(await canAccessClientStats(req.user.id, clientId))) {
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

    const stats = await prisma.dailyStat.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    sendSuccess(res, stats);
  } catch (error) {
    console.error('Get stats error:', error);
    sendError(res, 'Failed to get stats', 500);
  }
};

/**
 * Récupérer les stats agrégées (moyennes, totaux)
 */
export const getAggregatedStats = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate, period } = req.query;

    if (!(await canAccessClientStats(req.user.id, clientId))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    const where = {
      clientId,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    const stats = await prisma.dailyStat.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    // Calculer les moyennes
    const count = stats.length;
    if (count === 0) {
      return sendSuccess(res, {
        count: 0,
        averages: {},
        totals: {},
      });
    }

    const totals = stats.reduce(
      (acc, stat) => {
        acc.sleepHours += stat.sleepHours || 0;
        acc.waterIntake += stat.waterIntake || 0;
        acc.totalCalories += stat.totalCalories || 0;
        acc.workoutDuration += stat.workoutDuration || 0;
        return acc;
      },
      { sleepHours: 0, waterIntake: 0, totalCalories: 0, workoutDuration: 0 }
    );

    const averages = {
      sleepHours: totals.sleepHours / count,
      waterIntake: totals.waterIntake / count,
      totalCalories: totals.totalCalories / count,
      workoutDuration: totals.workoutDuration / count,
    };

    // Poids (dernier enregistré)
    const lastWeight = stats
      .filter((s) => s.weight)
      .sort((a, b) => b.date - a.date)[0]?.weight;

    sendSuccess(res, {
      count,
      period,
      startDate,
      endDate,
      averages,
      totals,
      lastWeight,
      stats,
    });
  } catch (error) {
    console.error('Get aggregated stats error:', error);
    sendError(res, 'Failed to get aggregated stats', 500);
  }
};

/**
 * Récupérer une stat par date
 */
export const getStatByDate = async (req, res) => {
  try {
    const { clientId, date } = req.params;

    if (!(await canAccessClientStats(req.user.id, clientId))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    const stat = await prisma.dailyStat.findUnique({
      where: {
        clientId_date: {
          clientId,
          date: dateObj,
        },
      },
    });

    if (!stat) {
      return sendError(res, 'No stats found for this date', 404);
    }

    sendSuccess(res, stat);
  } catch (error) {
    console.error('Get stat by date error:', error);
    sendError(res, 'Failed to get stat', 500);
  }
};
