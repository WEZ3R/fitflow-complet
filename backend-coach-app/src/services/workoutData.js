/**
 * Briques partagées des analyses de musculation.
 *
 * Extraites de workoutAnalyticsController pour être réutilisées par
 * analyticsController, qui doit joindre les métriques de performance aux données
 * quotidiennes. Sans cette extraction, la même requête et le même calcul de 1RM de
 * référence auraient existé en deux exemplaires, avec la garantie de diverger.
 */

import prisma from '../config/database.js';
import { parseNumericField, estimate1RM } from '../utils/parseSetData.js';

/**
 * Bornes d'une plage de jours, en incluant réellement le jour de fin.
 *
 * `new Date('2026-08-11')` vaut minuit UTC. Utilisé tel quel en `lte`, il excluait
 * tout ce qui suit minuit — donc la totalité du jour de fin. Une requête sur une
 * seule journée renvoyait un intervalle vide.
 *
 * On élargit d'une journée de chaque côté : les séances sont enregistrées à minuit
 * LOCAL, ce qui décale l'horodatage UTC de plusieurs heures selon le fuseau, et une
 * borne UTC stricte laisse tomber les journées de bord.
 */
export function dayRange(startDate, endDate) {
  const gte = new Date(startDate);
  gte.setUTCHours(0, 0, 0, 0);
  gte.setUTCDate(gte.getUTCDate() - 1);

  const lte = new Date(endDate);
  lte.setUTCHours(23, 59, 59, 999);
  lte.setUTCDate(lte.getUTCDate() + 1);

  return { gte, lte };
}

/**
 * Séances complétées d'un client sur la période, avec leurs exercices principaux
 * reliés au catalogue et les séries effectivement terminées.
 */
export function fetchCompletedSessionsWithSets(coachId, clientId, startDate, endDate) {
  return prisma.session.findMany({
    where: {
      program: { coachId, clientId },
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
          exerciseRef: { select: { id: true, name: true, bodyParts: true, equipments: true } },
          setCompletions: { where: { completed: true } },
        },
      },
    },
    orderBy: { date: 'asc' },
  });
}

/**
 * Meilleur 1RM estimé par exercice, sur les séances fournies.
 * Sert de référence pour exprimer une charge en pourcentage du maximum.
 */
export function computeBest1RM(sessions) {
  const best = new Map();
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      for (const sc of exercise.setCompletions) {
        const est = estimate1RM(
          parseNumericField(sc.weightUsed, 'high'),
          parseNumericField(sc.repsAchieved, 'high'),
        );
        if (est == null) continue;
        const prev = best.get(exercise.exerciseRefId);
        if (prev == null || est > prev) best.set(exercise.exerciseRefId, est);
      }
    }
  }
  return best;
}

/** Clé de journée LOCALE (YYYY-MM-DD), celle que l'interface affiche. */
const localDay = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Métriques de performance agrégées PAR JOUR.
 *
 * Objectif : les superposer aux données de consommation (calories, eau, sommeil) sur
 * le même axe temporel, pour qu'un coach puisse rapprocher un apport d'une
 * performance. Il faut donc un scalaire par jour et par métrique.
 *
 * @returns {Map<string, {inol:number, tonnage:number, setsDone:number, topPct1RM:number|null, best1RM:number|null}>}
 */
export function computeDailyPerformance(sessions, best1RM) {
  const byDay = new Map();

  for (const session of sessions) {
    const key = localDay(session.date);
    const day = byDay.get(key) ?? { inol: 0, tonnage: 0, setsDone: 0, topPct1RM: null, best1RM: null };

    for (const exercise of session.exercises) {
      const ref = best1RM.get(exercise.exerciseRefId);

      for (const sc of exercise.setCompletions) {
        const w = parseNumericField(sc.weightUsed, 'high');
        const r = parseNumericField(sc.repsAchieved, 'high');
        if (r == null) continue;

        day.setsDone += 1;
        // Tonnage : seules les séries chargées comptent. Un gainage au poids du
        // corps n'ajoute rien, ce qui est correct — il n'y a pas de charge externe.
        if (w != null) day.tonnage += w * r;

        const est = estimate1RM(w, r);
        if (est != null && (day.best1RM == null || est > day.best1RM)) day.best1RM = est;

        if (ref != null && w != null) {
          const pct = (w / ref) * 100;
          if (day.topPct1RM == null || pct > day.topPct1RM) day.topPct1RM = pct;
          const denominator = 100 - pct;
          if (denominator > 0) day.inol += r / denominator;
        }
      }
    }

    byDay.set(key, day);
  }

  // Arrondis à l'usage : deux décimales pour l'INOL, l'entier pour le reste.
  for (const [key, d] of byDay) {
    byDay.set(key, {
      inol: Math.round(d.inol * 100) / 100,
      tonnage: Math.round(d.tonnage),
      setsDone: d.setsDone,
      topPct1RM: d.topPct1RM == null ? null : Math.round(d.topPct1RM),
      best1RM: d.best1RM,
    });
  }

  return byDay;
}

export { localDay };
