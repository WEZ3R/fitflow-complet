import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

// ─── Constantes par défaut ────────────────────────────────────────────────────

const DEFAULT_SURPLUS = 300;   // kcal — prise de masse
const DEFAULT_DEFICIT = 400;   // kcal — sèche

// ─── Moteur de calcul (pur, sans DB) ─────────────────────────────────────────

export function computeNutrition({ gender, weight, height, age, activityFactor, objective, surplus, deficit }) {
  // ── Étape 1 : BMR (Mifflin-St Jeor) ──
  const isMan = gender === 'male' || gender === 'M' || gender === 'homme';
  const bmr = Math.round(10 * weight + 6.25 * height - 5 * age + (isMan ? 5 : -161));

  // ── Étape 2 : TDEE ──
  const tdee = Math.round(bmr * activityFactor);

  // ── Étape 3 : Calories cibles ──
  let caloriesCibles;
  const usedSurplus = surplus ?? DEFAULT_SURPLUS;
  const usedDeficit = deficit ?? DEFAULT_DEFICIT;

  if (objective === 'prise_de_masse') {
    caloriesCibles = tdee + usedSurplus;
  } else if (objective === 'seche') {
    caloriesCibles = tdee - usedDeficit;
  } else {
    caloriesCibles = tdee; // maintien
  }
  caloriesCibles = Math.max(0, Math.round(caloriesCibles));

  // ── Étape 4 : Macros ──
  const proteines = Math.round(2 * weight);       // 2 g/kg
  const lipides   = Math.round(0.9 * weight);     // 0.9 g/kg

  const proteinesKcal = proteines * 4;
  const lipidesKcal   = lipides * 9;
  const glucidesKcal  = Math.max(0, caloriesCibles - proteinesKcal - lipidesKcal);
  const glucides      = Math.round(glucidesKcal / 4);

  return {
    bmr,
    tdee,
    calories_cible: caloriesCibles,
    objectif:       objective,
    facteur_activite: activityFactor,
    delta: objective === 'prise_de_masse' ? usedSurplus
         : objective === 'seche'          ? -usedDeficit
         : 0,
    macronutriments: {
      proteines,
      lipides,
      glucides,
    },
  };
}

// ─── Endpoint HTTP ────────────────────────────────────────────────────────────

/**
 * Calculer les besoins caloriques d'un client
 * POST /api/nutrition/calculate
 *
 * Body : { clientId, activityFactor, objective, surplus?, deficit? }
 */
export const calculateNutrition = async (req, res) => {
  try {
    const { clientId, activityFactor, objective, surplus, deficit } = req.body;

    // Validation des champs obligatoires
    if (!clientId) return sendError(res, 'clientId requis', 400);
    if (!activityFactor || isNaN(parseFloat(activityFactor))) return sendError(res, 'facteur_activite invalide', 400);
    if (!['maintien', 'prise_de_masse', 'seche'].includes(objective)) return sendError(res, 'objectif invalide (maintien | prise_de_masse | seche)', 400);

    const af = parseFloat(activityFactor);
    if (af < 1 || af > 2.5) return sendError(res, 'facteur_activite doit être entre 1 et 2.5', 400);

    // Récupérer le profil client
    const clientProfile = await prisma.clientProfile.findUnique({
      where: { id: clientId },
      select: {
        weight: true,
        height: true,
        dateOfBirth: true,
        gender: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!clientProfile) return sendError(res, 'Client introuvable', 404);

    // Validation des données biométriques
    if (!clientProfile.weight) return sendError(res, 'Poids du client manquant dans son profil', 422);
    if (!clientProfile.height) return sendError(res, 'Taille du client manquante dans son profil', 422);
    if (!clientProfile.dateOfBirth) return sendError(res, 'Date de naissance du client manquante', 422);
    if (!clientProfile.gender) return sendError(res, 'Genre du client manquant dans son profil', 422);

    // Calcul de l'âge
    const today = new Date();
    const dob = new Date(clientProfile.dateOfBirth);
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;

    const result = computeNutrition({
      gender: clientProfile.gender,
      weight: clientProfile.weight,
      height: clientProfile.height,
      age,
      activityFactor: af,
      objective,
      surplus: surplus !== undefined ? parseInt(surplus) : undefined,
      deficit: deficit !== undefined ? parseInt(deficit) : undefined,
    });

    sendSuccess(res, {
      client: {
        nom: `${clientProfile.user.firstName} ${clientProfile.user.lastName}`,
        poids: clientProfile.weight,
        taille: clientProfile.height,
        age,
        genre: clientProfile.gender,
      },
      ...result,
    });
  } catch (error) {
    console.error('Calculate nutrition error:', error);
    sendError(res, 'Erreur lors du calcul', 500);
  }
};
