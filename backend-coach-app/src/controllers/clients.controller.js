import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import { saveUpload } from '../services/fileStorage.js';

// Récupérer tous les clients d'un coach (y compris les demandes en attente)
export const getCoachClients = async (req, res) => {
  try {
    const coachId = req.user.id;

    // Récupérer le profil coach
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: coachId },
    });

    if (!coachProfile) {
      return sendError(res, 'Profil coach non trouvé', 404);
    }

    // Récupérer tous les clients via la table ClientCoach (relation many-to-many)
    const clientCoachRelations = await prisma.clientCoach.findMany({
      where: {
        coachId: coachProfile.id,
        isActive: true,
      },
      include: {
        client: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
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
    });

    // Récupérer les demandes en attente
    const pendingRequests = await prisma.coachRequest.findMany({
      where: {
        coachId: coachProfile.id,
        status: 'pending',
      },
      include: {
        client: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
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
    });

    // Formater les demandes pour correspondre au format des clients
    const formattedPendingRequests = pendingRequests.map(request => ({
      ...request.client,
      requestId: request.id,
      requestStatus: 'pending',
      requestMessage: request.message,
      requestDate: request.createdAt,
    }));

    // Formater les clients acceptés depuis ClientCoach
    const formattedAcceptedClients = clientCoachRelations.map(relation => ({
      ...relation.client,
      requestStatus: 'accepted',
      isPrimaryCoach: relation.isPrimary,
      relationStartDate: relation.startDate,
    }));

    // Combiner les deux listes
    const allClients = [...formattedPendingRequests, ...formattedAcceptedClients];

    sendSuccess(res, allClients);
  } catch (error) {
    console.error('Error fetching coach clients:', error);
    sendError(res, 'Erreur lors de la récupération des clients', 500);
  }
};

// Récupérer un client spécifique (ou une demande en attente)
export const getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const coachId = req.user.id;

    // Récupérer le profil coach
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: coachId },
    });

    if (!coachProfile) {
      return sendError(res, 'Profil coach non trouvé', 404);
    }

    // Essayer de récupérer le client via ClientCoach
    const clientCoachRelation = await prisma.clientCoach.findFirst({
      where: {
        clientId: id,
        coachId: coachProfile.id,
        isActive: true,
      },
      include: {
        client: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (clientCoachRelation) {
      // Client accepté trouvé
      return sendSuccess(res, {
        ...clientCoachRelation.client,
        requestStatus: 'accepted',
        isPrimaryCoach: clientCoachRelation.isPrimary,
        relationStartDate: clientCoachRelation.startDate,
      });
    }

    // Sinon, vérifier si c'est une demande en attente
    const request = await prisma.coachRequest.findFirst({
      where: {
        coachId: coachProfile.id,
        clientId: id,
        status: 'pending',
      },
      include: {
        client: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (request) {
      // Demande en attente trouvée
      return sendSuccess(res, {
        ...request.client,
        requestId: request.id,
        requestStatus: 'pending',
        requestMessage: request.message,
        requestDate: request.createdAt,
      });
    }

    // Ni client accepté ni demande en attente
    return sendError(res, 'Client non trouvé', 404);
  } catch (error) {
    console.error('Error fetching client:', error);
    sendError(res, 'Erreur lors de la récupération du client', 500);
  }
};

/**
 * Récupérer son propre profil client (avec données complètes)
 */
export const getMyClientProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const client = await prisma.clientProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            birthDate: true,
          },
        },
        // Coach principal (rétrocompatibilité)
        coach: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        // Tous les coaches via la relation many-to-many
        coaches: {
          where: { isActive: true },
          include: {
            coach: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { isPrimary: 'desc' },
            { startDate: 'asc' },
          ],
        },
      },
    });

    if (!client) {
      return sendError(res, 'Profil client non trouvé', 404);
    }

    sendSuccess(res, client);
  } catch (error) {
    console.error('Get my client profile error:', error);
    sendError(res, 'Erreur lors de la récupération du profil', 500);
  }
};

/**
 * Mettre à jour son profil client
 */
export const updateMyClientProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { goalCategory, customGoal, level, weight, height, gender, city, visibleInProspection } = req.body;

    // Récupérer le profil client
    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId },
    });

    if (!clientProfile) {
      return sendError(res, 'Profil client non trouvé', 404);
    }

    // Gérer l'upload de la photo de profil si présente.
    // saveUpload décide de la destination selon STORAGE_DRIVER et renvoie l'URL à stocker.
    let profilePicture = clientProfile.profilePicture;
    if (req.file) {
      profilePicture = await saveUpload(req.file);
    }

    // Mettre à jour le profil
    const updatedProfile = await prisma.clientProfile.update({
      where: { userId },
      data: {
        goalCategory: goalCategory !== undefined ? goalCategory : clientProfile.goalCategory,
        customGoal: customGoal !== undefined ? customGoal : clientProfile.customGoal,
        level: level !== undefined ? level : clientProfile.level,
        weight: weight ? parseFloat(weight) : clientProfile.weight,
        height: height ? parseFloat(height) : clientProfile.height,
        gender: gender !== undefined ? gender : clientProfile.gender,
        city: city !== undefined ? city : clientProfile.city,
        visibleInProspection:
          visibleInProspection !== undefined
            ? visibleInProspection === 'true' || visibleInProspection === true
            : clientProfile.visibleInProspection,
        profilePicture,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            birthDate: true,
          },
        },
      },
    });

    sendSuccess(res, updatedProfile, 'Profil mis à jour avec succès');
  } catch (error) {
    console.error('Update client profile error:', error);
    sendError(res, 'Erreur lors de la mise à jour du profil', 500);
  }
};

/**
 * Récupérer les clients potentiels (prospection géographique)
 */
export const getProspectiveClients = async (req, res) => {
  try {
    const coachUserId = req.user.id;

    // Récupérer le profil coach
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: coachUserId },
    });

    if (!coachProfile) {
      return sendError(res, 'Profil coach non trouvé', 404);
    }

    const hasCity = !!coachProfile.city;

    if (!hasCity) {
      return sendSuccess(res, []);
    }

    // Récupérer les IDs clients déjà liés (actifs)
    const linkedClientCoaches = await prisma.clientCoach.findMany({
      where: { coachId: coachProfile.id, isActive: true },
      select: { clientId: true },
    });

    // Récupérer les IDs clients avec demande en cours
    const pendingRequests = await prisma.coachRequest.findMany({
      where: { coachId: coachProfile.id, status: 'pending' },
      select: { clientId: true },
    });

    const excludedClientIds = [
      ...linkedClientCoaches.map((cc) => cc.clientId),
      ...pendingRequests.map((r) => r.clientId),
    ];

    // Récupérer les gym IDs du coach
    const coachGyms = await prisma.coachGym.findMany({
      where: { coachId: coachProfile.id },
      select: { gymId: true },
    });
    const coachGymIds = coachGyms.map((g) => g.gymId);

    // Construire les conditions de matching géographique
    const whereConditions = [{ city: coachProfile.city }];
    if (coachGymIds.length > 0) {
      whereConditions.push({ gyms: { some: { gymId: { in: coachGymIds } } } });
    }

    const prospectiveClients = await prisma.clientProfile.findMany({
      where: {
        visibleInProspection: true,
        ...(excludedClientIds.length > 0 && { id: { notIn: excludedClientIds } }),
        OR: whereConditions,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        gyms: { include: { gym: true } },
      },
    });

    // Calculer le score de matching
    const scoredClients = prospectiveClients.map((client) => {
      let score = 0;
      const cityMatch = !!(client.city && coachProfile.city === client.city);
      if (cityMatch) score += 2;

      const clientGymIds = client.gyms.map((g) => g.gymId);
      const commonGymIds = clientGymIds.filter((id) => coachGymIds.includes(id));
      score += commonGymIds.length * 2;

      const commonLocations = client.gyms
        .filter((g) => coachGymIds.includes(g.gymId))
        .map((g) => g.gym?.name || 'Salle commune');

      return {
        ...client,
        score,
        matchDetails: {
          cityMatch,
          commonGyms: commonGymIds.length,
          commonLocations,
        },
      };
    });

    // Trier par score décroissant
    scoredClients.sort((a, b) => b.score - a.score);

    sendSuccess(res, scoredClients);
  } catch (error) {
    console.error('Get prospective clients error:', error);
    sendError(res, 'Erreur lors de la récupération des clients potentiels', 500);
  }
};

/**
 * Soumettre l'onboarding client (wizard 3 étapes)
 * PUT /api/clients/onboarding
 * Body: { step1: { gender?, age, height, weight }, step2: { city, gymIds[], customSpots[] }, step3: { goalCategory?, customGoal?, level } }
 */
export const submitClientOnboarding = async (req, res) => {
  try {
    const userId = req.user.id;
    const { step1 = {}, step2 = {}, step3 = {} } = req.body;

    const clientProfile = await prisma.clientProfile.findUnique({ where: { userId } });
    if (!clientProfile) return sendError(res, 'Profil client non trouvé', 404);

    // dateOfBirth : accepte ISO string (nouveau) ou calcul depuis age (rétrocompat)
    let dateOfBirth = clientProfile.dateOfBirth;
    if (step1.dateOfBirth) {
      dateOfBirth = new Date(step1.dateOfBirth);
    } else if (step1.age) {
      const year = new Date().getFullYear() - parseInt(step1.age, 10);
      dateOfBirth = new Date(`${year}-01-01`);
    }

    // Transaction atomique
    await prisma.$transaction(async (tx) => {
      // 1. Mettre à jour ClientProfile
      await tx.clientProfile.update({
        where: { userId },
        data: {
          gender: step1.gender || null,
          dateOfBirth,
          height: step1.height ? parseFloat(step1.height) : null,
          weight: step1.weight ? parseFloat(step1.weight) : null,
          city: step2.city || null,
          goalCategory: step3.goalCategory || null,
          customGoal: step3.customGoal || null,
          level: step3.level || null,
          onboardingCompletedAt: new Date(),
        },
      });

      // 2. Gyms — supprimer ancien puis recréer
      if (step2.gymIds && step2.gymIds.length > 0) {
        await tx.clientGym.deleteMany({ where: { clientId: clientProfile.id } });
        await tx.clientGym.createMany({
          data: step2.gymIds.map((gymId) => ({ clientId: clientProfile.id, gymId })),
          skipDuplicates: true,
        });
      }

      // 3. Lieux custom — supprimer anciens puis recréer
      if (step2.customSpots) {
        await tx.trainingSpot.deleteMany({ where: { clientId: clientProfile.id } });
        if (step2.customSpots.length > 0) {
          await tx.trainingSpot.createMany({
            data: step2.customSpots.map((spot) => ({
              clientId: clientProfile.id,
              type: spot.type || 'OTHER',
              label: spot.label,
              address: spot.address || null,
              latitude: spot.lat ? parseFloat(spot.lat) : null,
              longitude: spot.lng ? parseFloat(spot.lng) : null,
            })),
          });
        }
      }
    });

    const updated = await prisma.clientProfile.findUnique({
      where: { userId },
      include: { gyms: { include: { gym: true } }, trainingSpots: true },
    });

    sendSuccess(res, updated, 'Onboarding complété');
  } catch (error) {
    console.error('Client onboarding error:', error);
    sendError(res, "Erreur lors de l'onboarding", 500);
  }
};
