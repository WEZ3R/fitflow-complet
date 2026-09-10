import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import { saveUpload } from '../services/fileStorage.js';

/**
 * Récupérer tous les coachs publics pour la recherche
 */
export const getAllCoaches = async (req, res) => {
  try {
    const { city, gym } = req.query;

    // Construire les filtres optionnels — n'expose que les coachs ayant activé leur visibilité
    const whereFilter = { visibleInSearch: true };
    if (city) {
      whereFilter.city = { contains: city, mode: 'insensitive' };
    }
    if (gym) {
      whereFilter.gyms = { some: { gym: { name: { contains: gym, mode: 'insensitive' } } } };
    }

    const coaches = await prisma.coachProfile.findMany({
      where: whereFilter,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: false, // Ne pas exposer l'email
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
      },
    });

    // Calculer le rating moyen pour chaque coach
    const coachesWithRating = coaches.map((coach) => {
      const { reviews, ...coachData } = coach;
      return coachData;
    });

    sendSuccess(res, coachesWithRating);
  } catch (error) {
    console.error('Get all coaches error:', error);
    sendError(res, 'Erreur lors de la récupération des coachs', 500);
  }
};

/**
 * Récupérer le profil public d'un coach
 */
export const getCoachProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const coach = await prisma.coachProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            // L'identifiant est nécessaire pour signaler ce coach : le signalement
            // vise un User, pas un profil. C'est un UUID sans caractère sensible,
            // et l'email reste exclu de cette vue publique.
            id: true,
            firstName: true,
            lastName: true,
            email: false,
          },
        },
        reviews: {
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
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!coach) {
      return sendError(res, 'Coach non trouvé', 404);
    }

    sendSuccess(res, coach);
  } catch (error) {
    console.error('Get coach profile error:', error);
    sendError(res, 'Erreur lors de la récupération du profil', 500);
  }
};

/**
 * Récupérer son propre profil coach (avec données complètes)
 */
export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!coach) {
      return sendError(res, 'Profil coach non trouvé', 404);
    }

    sendSuccess(res, coach);
  } catch (error) {
    console.error('Get my profile error:', error);
    sendError(res, 'Erreur lors de la récupération du profil', 500);
  }
};

/**
 * Mettre à jour son profil coach
 */
export const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bio, city, isRemote, visibleInSearch } = req.body;

    // Récupérer le profil coach
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId },
    });

    if (!coachProfile) {
      return sendError(res, 'Profil coach non trouvé', 404);
    }

    // Gérer l'upload de la photo de profil si présente
    let profilePicture = coachProfile.profilePicture;
    if (req.file) {
      profilePicture = await saveUpload(req.file);
    }

    // Convertir isRemote en booléen si c'est une chaîne
    let parsedIsRemote = coachProfile.isRemote;
    if (isRemote !== undefined) {
      parsedIsRemote = isRemote === 'true' || isRemote === true;
    }

    // Convertir visibleInSearch en booléen si c'est une chaîne (FormData)
    let parsedVisibleInSearch = coachProfile.visibleInSearch;
    if (visibleInSearch !== undefined) {
      parsedVisibleInSearch = visibleInSearch === 'true' || visibleInSearch === true;
    }

    // Mettre à jour le profil
    const updatedProfile = await prisma.coachProfile.update({
      where: { userId },
      data: {
        bio,
        city,
        isRemote: parsedIsRemote,
        visibleInSearch: parsedVisibleInSearch,
        profilePicture,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    sendSuccess(res, updatedProfile, 'Profil mis à jour avec succès');
  } catch (error) {
    console.error('Update profile error:', error);
    sendError(res, 'Erreur lors de la mise à jour du profil', 500);
  }
};

/**
 * Soumettre l'onboarding coach (wizard 2 étapes)
 * PUT /api/coaches/onboarding
 */
export const submitCoachOnboarding = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bio, specialties = [], city, latitude, longitude, gymIds = [], isRemote } = req.body;

    const coachProfile = await prisma.coachProfile.findUnique({ where: { userId } });
    if (!coachProfile) return sendError(res, 'Profil coach non trouvé', 404);

    await prisma.$transaction(async (tx) => {
      await tx.coachProfile.update({
        where: { userId },
        data: {
          bio: bio || null,
          specialties: specialties,
          city: city || null,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          isRemote: isRemote === true || isRemote === 'true',
          onboardingCompletedAt: new Date(),
        },
      });

      if (gymIds.length > 0) {
        await tx.coachGym.deleteMany({ where: { coachId: coachProfile.id } });
        await tx.coachGym.createMany({
          data: gymIds.map((gymId) => ({ coachId: coachProfile.id, gymId })),
          skipDuplicates: true,
        });
      }
    });

    const updated = await prisma.coachProfile.findUnique({
      where: { userId },
      include: { gyms: { include: { gym: true } } },
    });

    sendSuccess(res, updated, 'Onboarding coach complété');
  } catch (error) {
    console.error('Coach onboarding error:', error);
    sendError(res, "Erreur lors de l'onboarding", 500);
  }
};

// Mapping GoalCategory → spécialités compatibles
const GOAL_SPECIALTY_MAP = {
  WEIGHT_LOSS: ['WEIGHT_LOSS', 'FITNESS', 'ENDURANCE', 'CROSSFIT'],
  MUSCLE_GAIN: ['HYPERTROPHY', 'BODYBUILDING', 'STRENGTH', 'POWERLIFTING'],
  FITNESS: ['FITNESS', 'CROSSFIT', 'ENDURANCE', 'YOGA', 'MOBILITY'],
  REHAB: ['REHAB', 'MOBILITY', 'YOGA'],
  PERFORMANCE: ['PERFORMANCE', 'STRENGTH', 'POWERLIFTING', 'ENDURANCE', 'CROSSFIT'],
  ENDURANCE: ['ENDURANCE', 'FITNESS', 'CROSSFIT'],
};

/**
 * Coachs recommandés pour le client connecté
 * GET /api/coaches/recommended
 */
export const getRecommendedCoaches = async (req, res) => {
  try {
    const userId = req.user.id;

    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId },
      include: { gyms: { select: { gymId: true } } },
    });
    if (!clientProfile) return sendError(res, 'Profil client non trouvé', 404);

    const clientGymIds = clientProfile.gyms.map((g) => g.gymId);
    const compatibleSpecialties = clientProfile.goalCategory
      ? GOAL_SPECIALTY_MAP[clientProfile.goalCategory] || []
      : [];

    const coaches = await prisma.coachProfile.findMany({
      where: { visibleInSearch: true },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: false } },
        gyms: { select: { gymId: true } },
        reviews: { select: { rating: true } },
      },
    });

    const scored = coaches.map((coach) => {
      let score = 0;

      // Matching spécialité ↔ objectif (+3)
      const hasMatchingSpecialty = coach.specialties.some((s) =>
        compatibleSpecialties.includes(s)
      );
      if (hasMatchingSpecialty) score += 3;

      // Même ville (+2)
      if (clientProfile.city && coach.city) {
        if (coach.city.toLowerCase() === clientProfile.city.toLowerCase()) score += 2;
      }

      // Salles en commun (+2 par salle)
      const coachGymIds = coach.gyms.map((g) => g.gymId);
      const commonGyms = clientGymIds.filter((id) => coachGymIds.includes(id));
      score += commonGyms.length * 2;

      // Coaching à distance (+1 si client sans ville)
      if (!clientProfile.city && coach.isRemote) score += 1;

      return {
        ...coach,
        score,
        matchDetails: {
          specialtyMatch: hasMatchingSpecialty,
          cityMatch: coach.city?.toLowerCase() === clientProfile.city?.toLowerCase(),
          commonGyms: commonGyms.length,
        },
      };
    });

    // Trier par score décroissant, retourner top 10
    scored.sort((a, b) => b.score - a.score);
    sendSuccess(res, scored.slice(0, 10));
  } catch (error) {
    console.error('Recommended coaches error:', error);
    sendError(res, 'Erreur lors de la récupération des coachs recommandés', 500);
  }
};
