import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import {
  fetchCompletedSessionsWithSets,
  computeBest1RM,
  computeDailyPerformance,
  localDay,
} from '../services/workoutData.js';

/**
 * Récupérer la liste de tous les clients du coach
 */
export const getCoachClients = async (req, res) => {
  try {
    // Récupérer le profil coach
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!coachProfile) {
      return sendError(res, 'Profil coach non trouvé', 403);
    }

    const coachId = coachProfile.id;

    // Récupérer via la relation many-to-many pour couvrir tous les clients du coach
    const clientCoachRelations = await prisma.clientCoach.findMany({
      where: { coachId, isActive: true },
      include: {
        client: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                birthDate: true,
              },
            },
          },
        },
      },
    });

    // Récupérer le programme actif pour chaque client
    const clientIds = clientCoachRelations.map(r => r.client.id);
    const activePrograms = await prisma.program.findMany({
      where: { coachId, clientId: { in: clientIds }, isActive: true },
      select: { id: true, clientId: true, title: true },
    });
    const programByClient = Object.fromEntries(
      activePrograms.map(p => [p.clientId, p])
    );

    const clientList = clientCoachRelations.map(({ client }) => {
      // Calculer l'âge depuis dateOfBirth (profil) ou birthDate (user)
      const dob = client.dateOfBirth ?? client.user.birthDate;
      let age = null;
      if (dob) {
        const today = new Date();
        const birth = new Date(dob);
        age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      }

      const prog = programByClient[client.id];

      return {
        id:        client.id,
        name:      `${client.user.firstName} ${client.user.lastName}`,
        gender:    client.gender ?? null,
        age,
        weight:    client.weight ?? null,
        height:    client.height ?? null,
        level:     client.level ?? null,
        program:   prog?.title ?? null,
        programId: prog?.id ?? null,
      };
    });

    sendSuccess(res, clientList);
  } catch (error) {
    console.error('Get coach clients error:', error);
    sendError(res, 'Erreur lors de la récupération des clients', 500);
  }
};

/**
 * Récupérer les statistiques d'un ou plusieurs clients
 */
export const getClientStats = async (req, res) => {
  try {
    const { clientIds, startDate, endDate, metrics } = req.query;

    // Récupérer le profil coach
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!coachProfile) {
      return sendError(res, 'Profil coach non trouvé', 403);
    }

    const coachId = coachProfile.id;

    // Le lien coach-client passe par la table de liaison `ClientCoach` depuis le
    // passage au multi-coach (partie 7.3 du dossier). Le champ hérité
    // `clientProfile.coachId` n'est plus alimenté : filtrer dessus ne renvoyait
    // aucun client, et cet écran répondait « Aucun client trouvé » en 404 alors
    // que la liste de gauche — qui interroge bien la table de liaison — en
    // affichait cinq.
    let whereClause = {
      coaches: { some: { coachId: coachId, isActive: true } },
    };

    if (clientIds) {
      const clientIdArray = Array.isArray(clientIds) ? clientIds : [clientIds];
      whereClause.id = { in: clientIdArray };
    }

    // Récupérer les clients du coach (tous ou filtrés)
    const clients = await prisma.clientProfile.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (clients.length === 0) {
      return sendError(res, 'Aucun client trouvé', 404);
    }

    // Filtrer par date si spécifié
    const dateFilter = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    // Récupérer les statistiques pour chaque client, enrichies des métriques de
    // performance du jour.
    //
    // POURQUOI LES JOINDRE ICI
    // Le coach doit pouvoir rapprocher un apport calorique d'une performance : deux
    // séries tracées sur des axes temporels séparés ne se comparent pas à l'œil. On
    // les livre donc sur la MÊME ligne de jour, quitte à laisser les champs nuls les
    // jours sans séance — une valeur nulle laisse un trou dans la courbe, ce qui est
    // exact, alors qu'un zéro suggérerait un entraînement sans intensité.
    const statsData = await Promise.all(
      clients.map(async (client) => {
        const [stats, sessions] = await Promise.all([
          prisma.dailyStat.findMany({
            where: {
              clientId: client.id,
              ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
            },
            orderBy: { date: 'asc' },
          }),
          startDate && endDate
            ? fetchCompletedSessionsWithSets(coachId, client.id, startDate, endDate)
            : Promise.resolve([]),
        ]);

        // Le 1RM de référence se cherche au-delà de la fenêtre affichée : sans
        // antériorité, les premiers jours n'auraient aucun pourcentage de 1RM.
        let perf = new Map();
        if (sessions.length) {
          const refStart = new Date(startDate);
          refStart.setDate(refStart.getDate() - 56);
          const refSessions = await fetchCompletedSessionsWithSets(
            coachId, client.id,
            refStart.toISOString().split('T')[0], endDate,
          );
          perf = computeDailyPerformance(sessions, computeBest1RM(refSessions));
        }

        return {
          clientId: client.id,
          clientName: `${client.user.firstName} ${client.user.lastName}`,
          stats: stats.map((s) => {
            const p = perf.get(localDay(s.date));
            return {
              ...s,
              inol: p?.inol ?? null,
              tonnage: p?.tonnage ?? null,
              setsDone: p?.setsDone ?? null,
              topPct1RM: p?.topPct1RM ?? null,
              best1RM: p?.best1RM ?? null,
            };
          }),
        };
      })
    );

    sendSuccess(res, statsData);
  } catch (error) {
    console.error('Get client stats error:', error);
    sendError(res, 'Erreur lors de la récupération des statistiques', 500);
  }
};

/**
 * Récupérer les données de progression des séances
 */
export const getClientProgress = async (req, res) => {
  try {
    const { clientIds, startDate, endDate } = req.query;

    // Récupérer le profil coach
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!coachProfile) {
      return sendError(res, 'Profil coach non trouvé', 403);
    }

    const coachId = coachProfile.id;

    const clientIdArray = Array.isArray(clientIds) ? clientIds : [clientIds];

    // Récupérer les programmes des clients
    const programs = await prisma.program.findMany({
      where: {
        coachId: coachId,
        clientId: { in: clientIdArray },
      },
      include: {
        client: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        sessions: {
          where: {
            ...(startDate && endDate
              ? {
                  date: {
                    gte: new Date(startDate),
                    lte: new Date(endDate),
                  },
                }
              : {}),
          },
          orderBy: {
            date: 'asc',
          },
        },
      },
    });

    const progressData = programs.map((program) => {
      const completedSessions = program.sessions.filter(
        (s) => s.status === 'DONE'
      ).length;
      const totalSessions = program.sessions.length;
      const completionRate =
        totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

      return {
        clientId: program.clientId,
        clientName: `${program.client.user.firstName} ${program.client.user.lastName}`,
        programTitle: program.title,
        completedSessions,
        totalSessions,
        completionRate: Math.round(completionRate),
        sessions: program.sessions.map((s) => ({
          date: s.date,
          status: s.status,
          isRestDay: s.isRestDay,
        })),
      };
    });

    sendSuccess(res, progressData);
  } catch (error) {
    console.error('Get client progress error:', error);
    sendError(res, 'Erreur lors de la récupération de la progression', 500);
  }
};

/**
 * Récupérer les objectifs personnalisés et leur completion
 */
export const getGoalsCompletion = async (req, res) => {
  try {
    const { clientIds, startDate, endDate } = req.query;

    // Récupérer le profil coach
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!coachProfile) {
      return sendError(res, 'Profil coach non trouvé', 403);
    }

    const coachId = coachProfile.id;

    const clientIdArray = Array.isArray(clientIds) ? clientIds : [clientIds];

    // Récupérer les programmes et objectifs
    const programs = await prisma.program.findMany({
      where: {
        coachId: coachId,
        clientId: { in: clientIdArray },
      },
      include: {
        client: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        customGoals: {
          include: {
            completions: {
              where: {
                ...(startDate && endDate
                  ? {
                      date: {
                        gte: new Date(startDate),
                        lte: new Date(endDate),
                      },
                    }
                  : {}),
              },
              orderBy: {
                date: 'asc',
              },
            },
          },
        },
      },
    });

    const goalsData = programs.map((program) => {
      const goalsWithStats = program.customGoals.map((goal) => {
        const totalDays = goal.completions.length;
        const completedDays = goal.completions.filter((c) => c.completed).length;
        const completionRate =
          totalDays > 0 ? (completedDays / totalDays) * 100 : 0;

        return {
          goalId: goal.id,
          goalTitle: goal.title,
          goalDescription: goal.description,
          totalDays,
          completedDays,
          completionRate: Math.round(completionRate),
          completions: goal.completions,
        };
      });

      return {
        clientId: program.clientId,
        clientName: `${program.client.user.firstName} ${program.client.user.lastName}`,
        programTitle: program.title,
        goals: goalsWithStats,
      };
    });

    sendSuccess(res, goalsData);
  } catch (error) {
    console.error('Get goals completion error:', error);
    sendError(res, 'Erreur lors de la récupération des objectifs', 500);
  }
};
