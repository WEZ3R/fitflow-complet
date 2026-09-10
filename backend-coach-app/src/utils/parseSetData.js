/**
 * Utilitaires pour parser les données de série et calculer le 1RM estimé.
 *
 * Les champs `repsAchieved` et `weightUsed` du modèle SetCompletion sont des
 * String? en base (valeurs libres : "12", "12-15", "AMRAP", "80kg", null, "").
 */

/**
 * Parse une valeur textuelle en nombre.
 * @param {string|null|undefined} value
 * @param {'high'|'low'|'avg'} strategy - Pour les plages "12-15" : prendre la valeur haute, basse ou moyenne
 * @returns {number|null}
 */
export function parseNumericField(value, strategy = 'high') {
  if (value == null) return null;

  const str = String(value).trim();
  if (str === '') return null;

  // Plage "12-15"
  const rangeMatch = str.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const lo = parseFloat(rangeMatch[1]);
    const hi = parseFloat(rangeMatch[2]);
    if (strategy === 'low') return lo;
    if (strategy === 'avg') return (lo + hi) / 2;
    return hi; // 'high' par défaut
  }

  // Valeur numérique avec unité : "80kg", "80 kg", "80lbs"
  const unitMatch = str.match(/^(\d+(?:\.\d+)?)\s*(?:kg|lbs?|lb)?$/i);
  if (unitMatch) {
    const n = parseFloat(unitMatch[1]);
    return n === 0 ? null : n; // 0 n'a pas de sens (poids ou reps nul)
  }

  // Non numérique ("AMRAP", "MAX", espaces seuls, etc.)
  return null;
}

/**
 * Estime le 1RM à partir du poids et du nombre de répétitions.
 * - 1 rep → poids direct
 * - 2-10 reps → Brzycki (plus précis sur les reps faibles à modérées)
 * - > 10 reps → Epley (plus adapté aux reps élevées)
 *
 * @param {number|null} weight - Poids en kg
 * @param {number|null} reps   - Nombre de répétitions
 * @returns {number|null} 1RM estimé, arrondi à 0.5 kg près, ou null si données invalides
 */
export function estimate1RM(weight, reps) {
  if (weight == null || reps == null) return null;
  if (weight <= 0 || reps <= 0) return null;

  let raw;
  if (reps === 1) {
    raw = weight;
  } else if (reps <= 10) {
    // Brzycki : W × 36 / (37 - R)
    raw = (weight * 36) / (37 - reps);
  } else {
    // Epley : W × (1 + R/30)
    raw = weight * (1 + reps / 30);
  }

  // Arrondir à 0.5 kg près
  return Math.round(raw * 2) / 2;
}

/**
 * Retourne la semaine ISO (ex: "2026-W13") pour une date donnée.
 * @param {Date|string} date
 * @returns {string} Format "YYYY-Www"
 */
export function getISOWeek(date) {
  const d = new Date(date);
  // Régler sur le jeudi de la semaine (convention ISO 8601)
  const dayOfWeek = d.getUTCDay() || 7; // 1=Lun, 7=Dim
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
