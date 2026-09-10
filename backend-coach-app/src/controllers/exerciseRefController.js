import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

/**
 * Abréviations françaises courantes → termes de recherche étendus
 * Permet de trouver "Développé couché" en tapant "DC", "SDT" → "Soulevé de terre", etc.
 */
const ABBREVIATIONS = {
  // Mouvements de poitrine
  'dc':   'développé couché',
  'dce':  'développé couché écarté',
  'dci':  'développé couché incliné',
  'dcd':  'développé couché décliné',
  // Épaules
  'dm':   'développé militaire',
  'dp':   'développé prise',
  'ohp':  'développé militaire',
  // Jambes
  'sq':   'squat',
  'sqa':  'squat avant',
  'sge':  'squat goblet',
  'leg':  'leg press',
  'lp':   'leg press',
  'lc':   'leg curl',
  'le':   'leg extension',
  // Dos
  'sdt':  'soulevé de terre',
  'sde':  'soulevé de terre',
  'dl':   'soulevé de terre',
  'rdl':  'soulevé de terre roumain',
  'tr':   'tractions',
  'tp':   'tirage poitrine',
  'th':   'tirage horizontal',
  'thn':  'tirage nuque',
  // Bras
  'cu':   'curl',
  'cb':   'curl barre',
  'cbu':  'curl barre',
  'ch':   'curl haltère',
  'chm':  'curl marteau',
  'ep':   'extension poulie',
  'dips': 'dips',
  'dip':  'dips',
  // Mollets / abdos
  'ml':   'mollets',
  'abs':  'abdominaux',
  'gm':   'good morning',
  // Exercices composés
  'bp':   'développé couché',
  'bb':   'barre',
  'db':   'haltère',
};

/**
 * Recherche d'exercices dans le référentiel ExerciseDB
 * GET /api/exercise-refs/search?q=bench&limit=20
 *
 * Recherche multi-champs : name, bodyParts, targetMuscles, secondaryMuscles, equipments, exerciseType
 * Supporte les abréviations françaises : DC, SDT, DM, SQ, RDL, etc.
 */
export const searchExerciseRefs = async (req, res) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query;

    if (!q || q.trim().length < 2) {
      return sendSuccess(res, { exercises: [], total: 0 });
    }

    const rawTerm = q.trim();
    // Résoudre l'abréviation si elle existe, sinon garder le terme original
    const searchTerm = ABBREVIATIONS[rawTerm.toLowerCase()] || rawTerm;
    const take = Math.min(parseInt(limit) || 20, 50);
    const skip = parseInt(offset) || 0;

    // Variantes de casse pour les champs en français (ex: "barre" → "Barre", "pectoraux" → "Pectoraux")
    const searchCapitalized = searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1);

    // Conditions sur le nom : terme direct + terme original si résolu via abréviation
    const nameConditions = [
      { name: { contains: searchTerm, mode: 'insensitive' } },
    ];
    if (searchTerm !== rawTerm) {
      nameConditions.push({ name: { contains: rawTerm, mode: 'insensitive' } });
    }

    // Recherche inverse : si le terme tapé est contenu dans la valeur d'une abréviation,
    // chercher aussi les exercices dont le nom commence par cette abréviation.
    // Ex : "développé" → trouve "DC", "DCI", "DCE", "DCD" → cherche "DC Barre", "DCI ...", etc.
    const reverseAbbrs = Object.entries(ABBREVIATIONS)
      .filter(([, full]) => full.toLowerCase().includes(rawTerm.toLowerCase()))
      .map(([abbr]) => abbr.toUpperCase());

    for (const abbr of reverseAbbrs) {
      nameConditions.push({ name: { startsWith: abbr, mode: 'insensitive' } });
    }

    // Recherche ILIKE multi-champs avec OR
    // bodyParts utilise des codes UPPERCASE (CHEST, BACK…), les autres champs sont en français
    const where = {
      OR: [
        ...nameConditions,
        { bodyParts: { hasSome: [searchTerm.toUpperCase()] } },
        { targetMuscles: { hasSome: [searchTerm] } },
        { targetMuscles: { hasSome: [searchCapitalized] } },
        { secondaryMuscles: { hasSome: [searchTerm] } },
        { secondaryMuscles: { hasSome: [searchCapitalized] } },
        { equipments: { hasSome: [searchTerm] } },
        { equipments: { hasSome: [searchCapitalized] } },
        { exerciseType: { contains: searchTerm, mode: 'insensitive' } },
      ],
    };

    const [exercises, total] = await Promise.all([
      prisma.exerciseReference.findMany({
        where,
        take,
        skip,
        orderBy: [
          // Priorité aux résultats par nom (les plus pertinents)
          { name: 'asc' },
        ],
      }),
      prisma.exerciseReference.count({ where }),
    ]);

    sendSuccess(res, { exercises, total });
  } catch (error) {
    console.error('Search exercise refs error:', error);
    sendError(res, 'Failed to search exercises', 500);
  }
};

/**
 * Récupérer un exercice de référence par ID
 * GET /api/exercise-refs/:id
 */
export const getExerciseRefById = async (req, res) => {
  try {
    const { id } = req.params;

    const exerciseRef = await prisma.exerciseReference.findUnique({
      where: { id },
    });

    if (!exerciseRef) {
      return sendError(res, 'Exercise reference not found', 404);
    }

    sendSuccess(res, exerciseRef);
  } catch (error) {
    console.error('Get exercise ref error:', error);
    sendError(res, 'Failed to get exercise reference', 500);
  }
};
