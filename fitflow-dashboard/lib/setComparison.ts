// Validation d'un champ reps planifié par le coach.
// Accepte : "" (vide, optionnel), "12" (entier), "8-12" (plage). Refuse tout caractère
// non numérique. Les espaces autour du tiret sont tolérés ("8 - 12").
export function isValidReps(value: string | null | undefined): boolean {
  if (value == null) return true;
  const str = String(value).trim();
  if (str === '') return true;
  return /^\d+\s*[-–]\s*\d+$/.test(str) || /^\d+$/.test(str);
}

// Parse "8-12" → {min:8, max:12}, "12" → {min:12, max:12}, "" / NaN / "AMRAP" → null
function parseRange(value: string | null | undefined): { min: number; max: number } | null {
  if (value == null) return null;
  const str = String(value).trim();
  if (str === '') return null;
  const rangeMatch = str.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) return { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
  const single = parseFloat(str);
  if (Number.isNaN(single)) return null;
  return { min: single, max: single };
}

type SetStatus = 'below' | 'in' | 'above';

// Compare une valeur réalisée à un objectif (valeur unique ou plage).
// → 'below' (sous l'objectif), 'in' (dans / égal), 'above' (au-dessus)
function compareToTarget(achieved: number, target: { min: number; max: number } | null): SetStatus | null {
  if (target == null) return null;
  if (achieved < target.min) return 'below';
  if (achieved > target.max) return 'above';
  return 'in';
}

// Statut global d'une série : 'below' prime sur 'above', sinon 'in'.
// Si aucune donnée n'est exploitable (cibles manquantes ou réelles non numériques),
// retourne 'in' par défaut (on ne pénalise pas faute d'information).
export function setStatus(
  plannedReps: string | null | undefined,
  plannedWeight: string | null | undefined,
  achievedRepsStr: string | null | undefined,
  achievedWeightStr: string | null | undefined,
): SetStatus {
  const repsTarget = parseRange(plannedReps);
  const weightTarget = parseRange(plannedWeight);
  const achievedReps = parseFloat(achievedRepsStr ?? '');
  const achievedWeight = parseFloat(achievedWeightStr ?? '');

  const repsCmp = Number.isNaN(achievedReps) ? null : compareToTarget(achievedReps, repsTarget);
  const weightCmp = Number.isNaN(achievedWeight) ? null : compareToTarget(achievedWeight, weightTarget);

  const statuses = [repsCmp, weightCmp].filter((s): s is SetStatus => s != null);
  if (statuses.includes('below')) return 'below';
  if (statuses.includes('above')) return 'above';
  return 'in';
}

export const setStatusColors: Record<SetStatus, { bg: string; text: string }> = {
  in:    { bg: 'bg-green-50 border-green-200',   text: 'text-green-700' },
  above: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700' },
  below: { bg: 'bg-red-50 border-red-200',       text: 'text-red-700' },
};

// Validation d'une durée prescrite par le coach.
// Accepte : "" (optionnel), "45s", "90s", "2min", "1min30", "1m30". Refuse le reste.
// Un nombre nu est refusé volontairement : « 45 » ne dit pas si ce sont des secondes
// ou des minutes, et l'ambiguïté se paierait à l'analyse.
export function isValidDuration(value: string | null | undefined): boolean {
  if (value == null) return true;
  const str = String(value).trim().toLowerCase();
  if (str === '') return true;
  return /^\d+\s*s$/.test(str) || /^\d+\s*(min|m)(\s*\d{1,2}s?)?$/.test(str);
}

/** Durée en secondes, ou null si illisible. Sert aux comparaisons et aux cumuls. */
export function parseDurationSeconds(value: string | null | undefined): number | null {
  if (value == null) return null;
  const str = String(value).trim().toLowerCase();
  if (str === '') return null;
  const sec = str.match(/^(\d+)\s*s$/);
  if (sec) return parseInt(sec[1], 10);
  const min = str.match(/^(\d+)\s*(?:min|m)(?:\s*(\d{1,2})s?)?$/);
  if (min) return parseInt(min[1], 10) * 60 + (min[2] ? parseInt(min[2], 10) : 0);
  return null;
}

/**
 * Statut d'une série CHRONOMÉTRÉE : le temps tenu face au temps prescrit.
 *
 * Nécessaire parce que `setStatus` compare via `parseFloat` : « 45s » y passerait par
 * chance, mais « 1min30 » serait lu comme 1. On convertit donc en secondes des deux
 * côtés avant de comparer.
 */
export function durationStatus(
  plannedDuration: string | null | undefined,
  achievedDuration: string | null | undefined,
): SetStatus {
  const target = parseDurationSeconds(plannedDuration);
  const achieved = parseDurationSeconds(achievedDuration);
  // Faute d'information, on ne pénalise pas — même règle que setStatus.
  if (target == null || achieved == null) return 'in';
  if (achieved < target) return 'below';
  if (achieved > target) return 'above';
  return 'in';
}
