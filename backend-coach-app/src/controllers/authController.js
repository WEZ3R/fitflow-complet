import prisma from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/bcrypt.js';
import { generateToken } from '../utils/jwt.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

/**
 * Inscription d'un nouvel utilisateur
 */
export const register = async (req, res) => {
  try {
    const { email, password, role, firstName, lastName, phone } = req.body;

    // Validation des champs requis
    if (!email || !password || !role || !firstName || !lastName) {
      return sendError(res, 'Tous les champs sont requis (email, mot de passe, rôle, prénom, nom)', 400);
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendError(res, "Le format de l'email n'est pas valide", 400);
    }

    // Validation de la longueur du mot de passe
    if (password.length < 6) {
      return sendError(res, 'Le mot de passe doit contenir au moins 6 caractères', 400);
    }

    // Validation du rôle
    if (role !== 'COACH' && role !== 'CLIENT') {
      return sendError(res, 'Le rôle doit être COACH ou CLIENT', 400);
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return sendError(res, 'Cet email est déjà utilisé. Veuillez en choisir un autre ou vous connecter.', 400);
    }

    // Hasher le mot de passe
    const hashedPassword = await hashPassword(password);

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
        firstName,
        lastName,
        phone: phone || null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    });

    // Créer le profil vide correspondant au rôle
    if (role === 'COACH') {
      await prisma.coachProfile.create({ data: { userId: user.id } });
    } else if (role === 'CLIENT') {
      await prisma.clientProfile.create({ data: { userId: user.id } });
    }

    // Générer un token
    const token = generateToken({ userId: user.id, role: user.role });

    sendSuccess(
      res,
      {
        user,
        token,
        onboardingComplete: false,
      },
      'Inscription réussie',
      201
    );
  } catch (error) {
    console.error('Register error:', error);

    // Messages d'erreur détaillés selon le type d'erreur
    if (error.code === 'P2002') {
      return sendError(res, 'Cet email est déjà utilisé', 400);
    }

    if (error.code === 'P2003') {
      return sendError(res, 'Erreur de relation dans la base de données', 400);
    }

    sendError(res, `Erreur lors de l'inscription: ${error.message}`, 500);
  }
};

/**
 * Connexion d'un utilisateur
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Trouver l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        coachProfile: { include: { gyms: { include: { gym: true } } } },
        clientProfile: {
          include: {
            gyms: { include: { gym: true } },
            trainingSpots: true,
            coaches: { where: { isActive: true }, select: { id: true } },
          },
        },
      },
    });

    if (!user) {
      return sendError(res, 'Email ou mot de passe incorrect', 401);
    }

    // Vérifier le mot de passe
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      return sendError(res, 'Email ou mot de passe incorrect', 401);
    }

    // Statut de modération. Le contrôle a lieu APRÈS la vérification du mot de passe :
    // annoncer « ce compte est suspendu » à qui ne connaît pas le mot de passe
    // révélerait à la fois l'existence du compte et sa situation.
    //
    // Un jeton est tout de même émis pour un compte sanctionné : sans lui, la personne
    // ne pourrait pas déposer de recours. Il ne donne accès qu'à /api/appeals, les
    // autres routes étant fermées par le middleware d'authentification.
    if (user.status === 'SUSPENDED' || user.status === 'PENDING_DELETION') {
      // Une suppression programmée n'a pas de terme : seule une suspension expire.
      const echu = user.status === 'SUSPENDED'
        && user.suspendedUntil
        && new Date(user.suspendedUntil) <= new Date();

      if (echu) {
        // Le statut est remis à jour ICI, et pas seulement au premier appel authentifié :
        // laisser un compte marqué SUSPENDED alors qu'il peut se connecter afficherait
        // une sanction fantôme sur la fiche de modération.
        await prisma.user.update({
          where: { id: user.id },
          data: {
            status: 'ACTIVE',
            suspendedAt: null,
            suspendedUntil: null,
            suspensionReason: null,
          },
        });
        user.status = 'ACTIVE';
      }

      if (!echu) {
        return res.status(403).json({
          success: false,
          message: user.status === 'SUSPENDED'
            ? 'Votre compte est suspendu.'
            : 'Votre compte est en cours de suppression.',
          moderation: {
            status: user.status,
            reason: user.suspensionReason,
            until: user.suspendedUntil,
            scheduledDeletionAt: user.scheduledDeletionAt,
            appealEndpoint: '/api/appeals',
          },
          data: { token: generateToken({ userId: user.id, role: user.role }) },
          errors: null,
        });
      }
    }

    // Générer un token
    const token = generateToken({ userId: user.id, role: user.role });

    // Retourner les données sans le mot de passe
    const { password: _, ...userWithoutPassword } = user;

    sendSuccess(res, {
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    sendError(res, 'Login failed', 500);
  }
};

/**
 * Récupérer le profil de l'utilisateur connecté
 */
export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        coachProfile: {
          include: {
            gyms: { include: { gym: true } },
          },
        },
        clientProfile: {
          include: {
            gyms: { include: { gym: true } },
            trainingSpots: true,
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
            coaches: {
              where: { isActive: true },
              select: { id: true },
            },
          },
        },
      },
    });

    sendSuccess(res, user);
  } catch (error) {
    console.error('Get me error:', error);
    sendError(res, 'Failed to get user profile', 500);
  }
};

/**
 * Mettre à jour le profil de l'utilisateur connecté
 */
export const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, birthDate } = req.body;
    const userId = req.user.id;

    // Validation des champs requis
    if (!firstName || !lastName || !email) {
      return sendError(res, 'Le prénom, le nom et l\'email sont requis', 400);
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendError(res, "Le format de l'email n'est pas valide", 400);
    }

    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    if (email !== req.user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser && existingUser.id !== userId) {
        return sendError(res, 'Cet email est déjà utilisé par un autre utilisateur', 400);
      }
    }

    // Mettre à jour l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        email,
        phone: phone || null,
        birthDate: birthDate ? new Date(birthDate) : null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        birthDate: true,
      },
    });

    sendSuccess(res, updatedUser, 'Profil mis à jour avec succès');
  } catch (error) {
    console.error('Update profile error:', error);

    if (error.code === 'P2002') {
      return sendError(res, 'Cet email est déjà utilisé', 400);
    }

    sendError(res, `Erreur lors de la mise à jour du profil: ${error.message}`, 500);
  }
};

/**
 * Export des données personnelles — RGPD, droit d'accès et portabilité (art. 15 et 20).
 *
 * Renvoie en un seul JSON tout ce que la plateforme détient sur l'appelant. Le mot de
 * passe haché en est exclu : il n'est pas une donnée « fournie par la personne » au sens
 * de l'article 20, et l'exporter n'aurait d'autre effet que d'exposer une empreinte à
 * attaquer hors ligne.
 *
 * Les conversations sont incluses parce qu'elles concernent l'appelant, mais elles
 * contiennent aussi les messages de son interlocuteur : c'est la limite reconnue de la
 * portabilité sur des données relationnelles.
 */
export const exportMyData = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, role: true, firstName: true, lastName: true,
        phone: true, birthDate: true, createdAt: true,
        notifications: true,
        // specialties est un tableau d'enum porté par la table, pas une relation :
        // il est déjà présent dans le profil sans include.
        coachProfile: { include: { gyms: true, reviews: true } },
        clientProfile: {
          include: {
            gyms: true, trainingSpots: true, coaches: true,
            stats: true, meals: true, reviews: true,
          },
        },
      },
    });

    if (!user) return sendError(res, 'Utilisateur introuvable', 404);

    const profileId = user.coachProfile?.id ?? user.clientProfile?.id;
    const messages = profileId
      ? await prisma.message.findMany({
          where: user.role === 'COACH' ? { coachId: profileId } : { clientId: profileId },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const appointments = profileId
      ? await prisma.appointment.findMany({
          where: user.role === 'COACH' ? { coachId: profileId } : { clientId: profileId },
          orderBy: { startAt: 'asc' },
        })
      : [];

    return sendSuccess(
      res,
      { exportedAt: new Date().toISOString(), user, messages, appointments },
      'Export des données personnelles'
    );
  } catch (error) {
    console.error('exportMyData error:', error);
    return sendError(res, "Échec de l'export des données", 500);
  }
};

/**
 * Suppression du compte — RGPD, droit à l'effacement (art. 17).
 *
 * Le mot de passe est redemandé : un jeton valide suffit à agir au nom de la personne,
 * et cette action est irréversible. C'est la même précaution que pour un changement
 * d'email, appliquée à une opération bien plus destructrice.
 *
 * L'effacement des données liées repose sur les `onDelete: Cascade` du schéma : profil,
 * relations coach-client, programmes, séances, validations de séries, statistiques,
 * repas, messages et notifications disparaissent avec l'utilisateur.
 */
export const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return sendError(res, 'Mot de passe requis pour confirmer la suppression', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return sendError(res, 'Utilisateur introuvable', 404);

    const passwordMatch = await comparePassword(password, user.password);
    if (!passwordMatch) return sendError(res, 'Mot de passe incorrect', 401);

    await prisma.user.delete({ where: { id: user.id } });

    return sendSuccess(res, null, 'Compte et données associées supprimés');
  } catch (error) {
    console.error('deleteAccount error:', error);
    return sendError(res, 'Échec de la suppression du compte', 500);
  }
};
