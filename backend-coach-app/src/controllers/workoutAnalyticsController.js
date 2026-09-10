import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import { parseNumericField, estimate1RM, getISOWeek } from '../utils/parseSetData.js';
// dayRange et fetchCompletedSessionsWithSets vivent dans un service partagé :
// analyticsController en a besoin pour joindre la performance aux données du jour.
import { dayRange, fetchCompletedSessionsWithSets } from '../services/workoutData.js';

/**
 * Vérifie que le coach authentifié possède bien ce client.
 * Retourne { coachId, clientProfile } ou null si accès refusé.
 */
async function resolveCoachClient(req, clientId) {
  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId: req.user.id },
  });
  if (!coachProfile) return null;

  const relation = await prisma.clientCoach.findFirst({
    where: { coachId: coachProfile.id, clientId, isActive: true },
    include: {
      client: {
        select: { id: true, weight: true, gender: true },
      },
    },
  });
  if (!relation) return null;

  return { coachId: coachProfile.id, clientProfile: relation.client };
}

// ──────────────────────────────────────────────────────────────────────────────
// 1RM ESTIMÉ PAR EXERCICE
// GET /analytics/workout/estimated-1rm?clientId=&startDate=&endDate=
// ──────────────────────────────────────────────────────────────────────────────
export const getEstimated1RM = async (req, res) => {
  try {
    const { clientId, startDate, endDate } = req.query;
    if (!clientId || !startDate || !endDate) {
      return sendError(res, 'clientId, startDate et endDate sont requis', 400);
    }

    const access = await resolveCoachClient(req, clientId);
    if (!access) return sendError(res, 'Accès non autorisé', 403);

    const sessions = await fetchCompletedSessionsWithSets(access.coachId, clientId, startDate, endDate);

    // Map : exerciseRefId → { exerciseName, bodyParts, Map<week, maxEstimated1RM> }
    const byExercise = new Map();

    for (const session of sessions) {
      const week = getISOWeek(session.date);
      for (const exercise of session.exercises) {
        const refId = exercise.exerciseRefId;
        if (!byExercise.has(refId)) {
          byExercise.set(refId, {
            exerciseRefId: refId,
            exerciseName: exercise.exerciseRef.name,
            bodyParts: exercise.exerciseRef.bodyParts,
            weeklyMax: new Map(), // week → max 1RM
          });
        }
        const entry = byExercise.get(refId);

        for (const sc of exercise.setCompletions) {
          const w = parseNumericField(sc.weightUsed, 'high');
          const r = parseNumericField(sc.repsAchieved, 'high');
          const est = estimate1RM(w, r);
          if (est == null) continue;

          const current = entry.weeklyMax.get(week) ?? 0;
          if (est > current) entry.weeklyMax.set(week, est);
        }
      }
    }

    const exercises = [...byExercise.values()]
      .filter(e => e.weeklyMax.size > 0)
      .map(e => ({
        exerciseRefId: e.exerciseRefId,
        exerciseName: e.exerciseName,
        bodyParts: e.bodyParts,
        weeklyData: [...e.weeklyMax.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([week, estimated1RM]) => ({ week, estimated1RM })),
      }));

    sendSuccess(res, { clientId, exercises });
  } catch (error) {
    console.error('getEstimated1RM error:', error);
    sendError(res, 'Erreur lors du calcul du 1RM', 500);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// VOLUME HEBDOMADAIRE PAR GROUPE MUSCULAIRE
// GET /analytics/workout/volume?clientId=&startDate=&endDate=
// ──────────────────────────────────────────────────────────────────────────────
export const getWeeklyVolume = async (req, res) => {
  try {
    const { clientId, startDate, endDate } = req.query;
    if (!clientId || !startDate || !endDate) {
      return sendError(res, 'clientId, startDate et endDate sont requis', 400);
    }

    const access = await resolveCoachClient(req, clientId);
    if (!access) return sendError(res, 'Accès non autorisé', 403);

    const sessions = await fetchCompletedSessionsWithSets(access.coachId, clientId, startDate, endDate);

    // Map : week → { muscleGroup → volume (kg × reps) }
    const weekMap = new Map();

    for (const session of sessions) {
      const week = getISOWeek(session.date);
      if (!weekMap.has(week)) weekMap.set(week, {});
      const weekData = weekMap.get(week);

      for (const exercise of session.exercises) {
        const muscles = exercise.exerciseRef.bodyParts; // ex: ["CHEST"]
        for (const sc of exercise.setCompletions) {
          const w = parseNumericField(sc.weightUsed, 'high');
          const r = parseNumericField(sc.repsAchieved, 'high');
          if (w == null || r == null) continue;
          const vol = w * r;
          for (const muscle of muscles) {
            weekData[muscle] = (weekData[muscle] ?? 0) + vol;
          }
        }
      }
    }

    const weeklyVolume = [...weekMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, muscleGroups]) => ({
        week,
        muscleGroups,
        total: Object.values(muscleGroups).reduce((s, v) => s + v, 0),
      }));

    // Volume total par muscle sur toute la période (pour le body map)
    const totalByMuscle = {};
    for (const { muscleGroups } of weeklyVolume) {
      for (const [muscle, vol] of Object.entries(muscleGroups)) {
        totalByMuscle[muscle] = (totalByMuscle[muscle] ?? 0) + vol;
      }
    }

    sendSuccess(res, { clientId, weeklyVolume, totalByMuscle });
  } catch (error) {
    console.error('getWeeklyVolume error:', error);
    sendError(res, 'Erreur lors du calcul du volume', 500);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// TAUX DE COMPLÉTION + STREAK
// GET /analytics/workout/completion?clientId=&startDate=&endDate=
// ──────────────────────────────────────────────────────────────────────────────
export const getCompletionAndStreak = async (req, res) => {
  try {
    const { clientId, startDate, endDate } = req.query;
    if (!clientId || !startDate || !endDate) {
      return sendError(res, 'clientId, startDate et endDate sont requis', 400);
    }

    const access = await resolveCoachClient(req, clientId);
    if (!access) return sendError(res, 'Accès non autorisé', 403);

    const sessions = await prisma.session.findMany({
      where: {
        program: { coachId: access.coachId, clientId },
        isRestDay: false,
        date: dayRange(startDate, endDate),
      },
      orderBy: { date: 'asc' },
      select: { id: true, date: true, completedByClient: true },
    });

    // Complétion par semaine
    const weekMap = new Map();
    for (const s of sessions) {
      const week = getISOWeek(s.date);
      if (!weekMap.has(week)) weekMap.set(week, { completed: 0, total: 0 });
      const w = weekMap.get(week);
      w.total++;
      if (s.completedByClient) w.completed++;
    }

    const weeklyCompletion = [...weekMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, { completed, total }]) => ({
        week,
        completed,
        total,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      }));

    // Streak actuel : consécutif à partir d'aujourd'hui vers le passé
    const allCompleted = sessions.filter(s => s.completedByClient);
    let currentStreak = 0;
    let longestStreak = 0;
    let streak = 0;
    let prevDate = null;

    for (const s of allCompleted) {
      const d = new Date(s.date);
      d.setUTCHours(0, 0, 0, 0);
      if (prevDate === null) {
        streak = 1;
      } else {
        const diff = (d - prevDate) / 86400000;
        streak = diff <= 7 ? streak + 1 : 1; // consécutif à la semaine près
      }
      longestStreak = Math.max(longestStreak, streak);
      prevDate = d;
    }

    // Streak actuel = streak en cours si la dernière session complétée est récente (< 8 jours)
    if (allCompleted.length > 0) {
      const lastDate = new Date(allCompleted[allCompleted.length - 1].date);
      const daysSinceLast = (Date.now() - lastDate.getTime()) / 86400000;
      currentStreak = daysSinceLast <= 8 ? streak : 0;
    }

    sendSuccess(res, { clientId, currentStreak, longestStreak, weeklyCompletion });
  } catch (error) {
    console.error('getCompletionAndStreak error:', error);
    sendError(res, 'Erreur lors du calcul de la complétion', 500);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PROGRESSION DE CHARGE (max weight par exercice par semaine)
// GET /analytics/workout/load-progression?clientId=&startDate=&endDate=
// ──────────────────────────────────────────────────────────────────────────────
export const getLoadProgression = async (req, res) => {
  try {
    const { clientId, startDate, endDate } = req.query;
    if (!clientId || !startDate || !endDate) {
      return sendError(res, 'clientId, startDate et endDate sont requis', 400);
    }

    const access = await resolveCoachClient(req, clientId);
    if (!access) return sendError(res, 'Accès non autorisé', 403);

    const sessions = await fetchCompletedSessionsWithSets(access.coachId, clientId, startDate, endDate);

    const byExercise = new Map();

    for (const session of sessions) {
      const week = getISOWeek(session.date);
      for (const exercise of session.exercises) {
        const refId = exercise.exerciseRefId;
        if (!byExercise.has(refId)) {
          byExercise.set(refId, {
            exerciseRefId: refId,
            exerciseName: exercise.exerciseRef.name,
            bodyParts: exercise.exerciseRef.bodyParts,
            weeklyMax: new Map(),
          });
        }
        const entry = byExercise.get(refId);

        for (const sc of exercise.setCompletions) {
          const w = parseNumericField(sc.weightUsed, 'high');
          if (w == null) continue;
          const current = entry.weeklyMax.get(week) ?? 0;
          if (w > current) entry.weeklyMax.set(week, w);
        }
      }
    }

    const exercises = [...byExercise.values()]
      .filter(e => e.weeklyMax.size > 0)
      .map(e => ({
        exerciseRefId: e.exerciseRefId,
        exerciseName: e.exerciseName,
        bodyParts: e.bodyParts,
        weeklyData: [...e.weeklyMax.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([week, maxWeight]) => ({ week, maxWeight })),
      }));

    sendSuccess(res, { clientId, exercises });
  } catch (error) {
    console.error('getLoadProgression error:', error);
    sendError(res, 'Erreur lors du calcul de la progression de charge', 500);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// INOL PAR SÉANCE (Phase 2)
// GET /analytics/workout/inol?clientId=&startDate=&endDate=
// ──────────────────────────────────────────────────────────────────────────────
export const getSessionINOL = async (req, res) => {
  try {
    const { clientId, startDate, endDate } = req.query;
    if (!clientId || !startDate || !endDate) {
      return sendError(res, 'clientId, startDate et endDate sont requis', 400);
    }

    const access = await resolveCoachClient(req, clientId);
    if (!access) return sendError(res, 'Accès non autorisé', 403);

    // Récupérer le 1RM de référence pour chaque exercice (meilleur des 8 dernières semaines)
    const refStart = new Date(startDate);
    refStart.setDate(refStart.getDate() - 56); // 8 semaines avant
    const refSessions = await fetchCompletedSessionsWithSets(
      access.coachId, clientId,
      refStart.toISOString().split('T')[0],
      endDate
    );

    const best1RM = new Map(); // exerciseRefId → best estimated 1RM
    for (const session of refSessions) {
      for (const exercise of session.exercises) {
        const refId = exercise.exerciseRefId;
        for (const sc of exercise.setCompletions) {
          const w = parseNumericField(sc.weightUsed, 'high');
          const r = parseNumericField(sc.repsAchieved, 'high');
          const est = estimate1RM(w, r);
          if (est == null) continue;
          if (!best1RM.has(refId) || est > best1RM.get(refId)) best1RM.set(refId, est);
        }
      }
    }

    // Calculer INOL pour les sessions dans la période demandée
    const sessions = await fetchCompletedSessionsWithSets(access.coachId, clientId, startDate, endDate);

    const result = sessions.map(session => {
      const exerciseINOL = [];
      let totalINOL = 0;

      // INOL par groupe musculaire : agrégé depuis les exercices, via leurs
      // bodyParts. Un exercice qui sollicite deux groupes compte dans les deux —
      // c'est bien une charge subie par chacun, pas une part à découper.
      const byMuscle = new Map();

      for (const exercise of session.exercises) {
        const refId = exercise.exerciseRefId;
        const ref1RM = best1RM.get(refId);
        if (!ref1RM) continue;

        let exerciseTotal = 0;
        let countedSets = 0;
        let topPct = 0;
        let topWeight = 0;
        let totalReps = 0;

        for (const sc of exercise.setCompletions) {
          const w = parseNumericField(sc.weightUsed, 'high');
          const r = parseNumericField(sc.repsAchieved, 'high');
          if (w == null || r == null) continue;
          const pct1RM = (w / ref1RM) * 100;
          const denominator = 100 - pct1RM;
          if (denominator <= 0) continue; // poids >= 1RM, INOL non défini
          exerciseTotal += r / denominator;
          countedSets++;
          totalReps += r;
          if (pct1RM > topPct) { topPct = pct1RM; topWeight = w; }
        }

        if (exerciseTotal > 0) {
          const rounded = Math.round(exerciseTotal * 100) / 100;
          exerciseINOL.push({
            // Clé d'appariement pour l'interface : le NOM du catalogue diffère
            // souvent de celui saisi dans la séance (« DC Barre » contre
            // « Développé couché barre »), un rapprochement par nom échouerait.
            exerciseRefId: refId,
            exerciseName: exercise.exerciseRef.name,
            bodyParts: exercise.exerciseRef.bodyParts,
            inol: rounded,
            // Le détail qui rend le chiffre lisible : sans le %1RM et la charge,
            // un INOL de 0,9 ne dit pas s'il vient de séries lourdes ou longues.
            sets: countedSets,
            totalReps,
            topPct1RM: Math.round(topPct),
            topWeight,
            ref1RM,
          });
          totalINOL += exerciseTotal;

          for (const part of exercise.exerciseRef.bodyParts) {
            byMuscle.set(part, (byMuscle.get(part) ?? 0) + exerciseTotal);
          }
        }
      }

      const muscleINOL = [...byMuscle.entries()]
        .map(([muscle, v]) => ({ muscle, inol: Math.round(v * 100) / 100 }))
        .sort((a, b) => b.inol - a.inol);

      return {
        date: session.date,
        sessionId: session.id,
        totalINOL: Math.round(totalINOL * 100) / 100,
        exerciseINOL: exerciseINOL.sort((a, b) => b.inol - a.inol),
        muscleINOL,
      };
    }).filter(s => s.totalINOL > 0);

    sendSuccess(res, { clientId, sessions: result });
  } catch (error) {
    console.error('getSessionINOL error:', error);
    sendError(res, 'Erreur lors du calcul de l\'INOL', 500);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// STANDARDS DE FORCE (Phase 2)
// GET /analytics/workout/strength-standards?clientId=
// ──────────────────────────────────────────────────────────────────────────────
export const getStrengthStandards = async (req, res) => {
  try {
    const { clientId } = req.query;
    if (!clientId) return sendError(res, 'clientId requis', 400);

    const access = await resolveCoachClient(req, clientId);
    if (!access) return sendError(res, 'Accès non autorisé', 403);

    const { strengthStandards } = await import('../utils/strengthStandards.js');

    const bodyweight = access.clientProfile.weight;
    const gender = access.clientProfile.gender || 'M';

    if (!bodyweight) {
      return sendError(res, 'Poids du client non renseigné', 422);
    }

    // 1RM sur les 90 derniers jours
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
    const sessions = await fetchCompletedSessionsWithSets(access.coachId, clientId, startDate, endDate);

    const best1RM = new Map();
    for (const session of sessions) {
      for (const exercise of session.exercises) {
        const refId = exercise.exerciseRefId;
        for (const sc of exercise.setCompletions) {
          const w = parseNumericField(sc.weightUsed, 'high');
          const r = parseNumericField(sc.repsAchieved, 'high');
          const est = estimate1RM(w, r);
          if (est == null) continue;
          const prev = best1RM.get(refId);
          if (!prev || est > prev.estimated1RM) {
            best1RM.set(refId, {
              exerciseName: exercise.exerciseRef.name,
              bodyParts: exercise.exerciseRef.bodyParts,
              equipments: exercise.exerciseRef.equipments,
              estimated1RM: est,
            });
          }
        }
      }
    }

    const exercises = [...best1RM.values()]
      .map(ex => {
        const ratio = ex.estimated1RM / bodyweight;
        const classification = strengthStandards.classify(
          ratio,
          gender,
          ex.bodyParts,
          ex.equipments
        );
        return {
          exerciseName: ex.exerciseName,
          estimated1RM: ex.estimated1RM,
          ratio: Math.round(ratio * 100) / 100,
          ...classification,
        };
      })
      .filter(ex => ex.level !== null);

    sendSuccess(res, { clientId, bodyweight, gender, exercises });
  } catch (error) {
    console.error('getStrengthStandards error:', error);
    sendError(res, 'Erreur lors du calcul des standards de force', 500);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// VOLUME LANDMARKS RP (Phase 2)
// GET /analytics/workout/volume-landmarks?clientId=&startDate=&endDate=
// ──────────────────────────────────────────────────────────────────────────────
export const getVolumeLandmarks = async (req, res) => {
  try {
    const { clientId, startDate, endDate } = req.query;
    if (!clientId || !startDate || !endDate) {
      return sendError(res, 'clientId, startDate et endDate sont requis', 400);
    }

    const access = await resolveCoachClient(req, clientId);
    if (!access) return sendError(res, 'Accès non autorisé', 403);

    const { LANDMARKS, getZone } = await import('../utils/volumeLandmarks.js');

    const sessions = await prisma.session.findMany({
      where: {
        program: { coachId: access.coachId, clientId },
        completedByClient: true,
        isRestDay: false,
        date: dayRange(startDate, endDate),
      },
      include: {
        exercises: {
          where: {
          exerciseRefId: { not: null },
          // RENFORCEMENT inclus : le gainage est du vrai travail, il doit compter
          // dans les volume landmarks, qui dénombrent des SÉRIES par muscle.
          // Les autres calculs l'écartent d'eux-mêmes : sans charge ni répétitions,
          // le volume, le 1RM et l'INOL n'ont rien à lire.
          category: { in: ['MAIN', 'RENFORCEMENT'] },
        },
          include: {
            exerciseRef: { select: { bodyParts: true } },
            setCompletions: { where: { completed: true }, select: { id: true } },
          },
        },
      },
    });

    // Séries par muscle par semaine
    const weekMuscle = new Map(); // week → { muscle → setCount }
    for (const session of sessions) {
      const week = getISOWeek(session.date);
      if (!weekMuscle.has(week)) weekMuscle.set(week, {});
      const wData = weekMuscle.get(week);

      for (const exercise of session.exercises) {
        const completedSets = exercise.setCompletions.length;
        if (completedSets === 0) continue;
        for (const muscle of exercise.exerciseRef.bodyParts) {
          wData[muscle] = (wData[muscle] ?? 0) + completedSets;
        }
      }
    }

    // Moyenne hebdo par muscle
    const weekCount = weekMuscle.size || 1;
    const avgByMuscle = {};
    for (const weekData of weekMuscle.values()) {
      for (const [muscle, sets] of Object.entries(weekData)) {
        avgByMuscle[muscle] = (avgByMuscle[muscle] ?? 0) + sets;
      }
    }
    for (const muscle of Object.keys(avgByMuscle)) {
      avgByMuscle[muscle] = Math.round((avgByMuscle[muscle] / weekCount) * 10) / 10;
    }

    const muscleGroups = Object.entries(avgByMuscle)
      .map(([name, weeklyAvgSets]) => {
        const landmark = LANDMARKS[name];
        if (!landmark) return null;
        return {
          name,
          weeklyAvgSets,
          ...landmark,
          zone: getZone(weeklyAvgSets, landmark),
        };
      })
      .filter(Boolean);

    sendSuccess(res, { clientId, muscleGroups });
  } catch (error) {
    console.error('getVolumeLandmarks error:', error);
    sendError(res, 'Erreur lors du calcul des volume landmarks', 500);
  }
};
