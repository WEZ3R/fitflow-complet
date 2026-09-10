/**
 * Standards de force (inspirés ExRx) — ratios 1RM / poids de corps
 * Matching via bodyParts[0] + présence de "Barre" dans equipments
 */

const STANDARDS = {
  // Développé couché — CHEST + BARBELL
  CHEST_BARBELL: {
    M: { beginner: 0.5, novice: 0.75, intermediate: 1.0, advanced: 1.5, elite: 2.0 },
    F: { beginner: 0.25, novice: 0.5,  intermediate: 0.75, advanced: 1.0, elite: 1.5 },
  },
  // Squat — UPPER_LEGS + BARBELL
  UPPER_LEGS_BARBELL: {
    M: { beginner: 0.75, novice: 1.25, intermediate: 1.75, advanced: 2.25, elite: 2.75 },
    F: { beginner: 0.5,  novice: 0.75, intermediate: 1.25, advanced: 1.75, elite: 2.25 },
  },
  // Soulevé de terre — BACK + BARBELL
  BACK_BARBELL: {
    M: { beginner: 1.0, novice: 1.5, intermediate: 2.0, advanced: 2.5, elite: 3.0 },
    F: { beginner: 0.5, novice: 1.0, intermediate: 1.5, advanced: 2.0, elite: 2.5 },
  },
  // Développé militaire — SHOULDERS + BARBELL
  SHOULDERS_BARBELL: {
    M: { beginner: 0.35, novice: 0.65, intermediate: 1.0, advanced: 1.3, elite: 1.6 },
    F: { beginner: 0.2,  novice: 0.4,  intermediate: 0.65, advanced: 0.9, elite: 1.2 },
  },
  // Rowing barre — BACK + BARBELL (secondaire)
  BACK_BARBELL_ROW: {
    M: { beginner: 0.5, novice: 0.75, intermediate: 1.15, advanced: 1.5, elite: 1.8 },
    F: { beginner: 0.25, novice: 0.5,  intermediate: 0.75, advanced: 1.0, elite: 1.35 },
  },
};

const LEVELS = ['beginner', 'novice', 'intermediate', 'advanced', 'elite'];
const LEVEL_LABELS = {
  beginner: 'Débutant',
  novice: 'Novice',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
  elite: 'Élite',
};

/**
 * Détermine la clé de standard selon bodyParts et equipments.
 */
function getStandardKey(bodyParts, equipments) {
  if (!equipments.includes('Barre')) return null;
  const primary = bodyParts[0];
  if (primary === 'CHEST') return 'CHEST_BARBELL';
  if (primary === 'UPPER_LEGS') return 'UPPER_LEGS_BARBELL';
  if (primary === 'BACK') return 'BACK_BARBELL';
  if (primary === 'SHOULDERS') return 'SHOULDERS_BARBELL';
  return null;
}

/**
 * Classifie le niveau d'un athlète selon son ratio 1RM/poids de corps.
 * @param {number} ratio
 * @param {string} gender - 'F' / 'female' / 'femme' → barème féminin, sinon masculin
 * @param {string[]} bodyParts
 * @param {string[]} equipments
 * @returns {{ level: string|null, levelIndex: number, levelLabel: string|null, nextLevel: string|null, nextLevelRatio: number|null }}
 */
function classify(ratio, gender, bodyParts, equipments) {
  const key = getStandardKey(bodyParts, equipments);
  if (!key) return { level: null, levelIndex: -1, levelLabel: null, nextLevel: null, nextLevelRatio: null };

  // ClientProfile.gender vaut 'male' / 'female' en base, pas 'M' / 'F'. Le test
  // strict `gender === 'F'` ne matchait donc jamais et toutes les clientes étaient
  // évaluées au barème masculin — un niveau trop bas la plupart du temps.
  const g = /^(f|female|femme)$/i.test(String(gender ?? '')) ? 'F' : 'M';
  const table = STANDARDS[key][g];

  let level = 'beginner';
  let levelIndex = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (ratio >= table[LEVELS[i]]) {
      level = LEVELS[i];
      levelIndex = i;
      break;
    }
  }

  const nextLevelIndex = levelIndex + 1;
  const nextLevel = nextLevelIndex < LEVELS.length ? LEVELS[nextLevelIndex] : null;
  const nextLevelRatio = nextLevel ? table[nextLevel] : null;

  return {
    level,
    levelIndex,
    levelLabel: LEVEL_LABELS[level],
    nextLevel,
    nextLevelRatio,
  };
}

export const strengthStandards = { classify };
