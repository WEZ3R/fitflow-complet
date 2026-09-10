import { verifyToken } from '../utils/jwt.js';
import { sendError } from '../utils/responseHandler.js';
import prisma from '../config/database.js';

/**
 * Charge l'utilisateur du jeton, sans se prononcer sur son statut de modération.
 *
 * Séparé de `authenticate` parce qu'une personne suspendue doit rester capable de
 * contester sa sanction : la route de recours a besoin de savoir QUI appelle, mais
 * ne peut pas exiger un compte actif — ce serait vider le droit de contestation de
 * son sens.
 */
const chargerUtilisateur = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const decoded = verifyToken(authHeader.substring(7));

  return prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      status: true,
      suspendedUntil: true,
      suspensionReason: true,
      scheduledDeletionAt: true,
    },
  });
};

/**
 * Authentifie et exige un compte utilisable.
 *
 * Une suspension à terme échu est levée à la volée : c'est le premier accès qui
 * réactive le compte, plutôt qu'une tâche planifiée qui balaierait toute la table
 * pour réactiver des comptes que personne n'utilise.
 */
export const authenticate = async (req, res, next) => {
  try {
    const user = await chargerUtilisateur(req);
    if (!user) return sendError(res, 'Authentification requise', 401);

    if (user.status === 'SUSPENDED') {
      const termeEchu = user.suspendedUntil && new Date(user.suspendedUntil) <= new Date();

      if (termeEchu) {
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
      } else {
        // Le motif et l'échéance sont renvoyés délibérément : une sanction qu'on ne
        // peut ni comprendre ni dater n'est pas contestable.
        return res.status(403).json({
          success: false,
          message: 'Votre compte est suspendu.',
          moderation: {
            status: 'SUSPENDED',
            reason: user.suspensionReason,
            until: user.suspendedUntil,
            appealEndpoint: '/api/appeals',
          },
          errors: null,
        });
      }
    }

    if (user.status === 'PENDING_DELETION') {
      return res.status(403).json({
        success: false,
        message: 'Votre compte est en cours de suppression.',
        moderation: {
          status: 'PENDING_DELETION',
          reason: user.suspensionReason,
          scheduledDeletionAt: user.scheduledDeletionAt,
          appealEndpoint: '/api/appeals',
        },
        errors: null,
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return sendError(res, 'Jeton invalide ou expiré', 401);
  }
};

/**
 * Authentifie SANS exiger un compte actif.
 *
 * Réservé aux routes qui doivent rester ouvertes à une personne sanctionnée :
 * aujourd'hui le dépôt d'un recours, et rien d'autre.
 */
export const authenticateEvenIfSuspended = async (req, res, next) => {
  try {
    const user = await chargerUtilisateur(req);
    if (!user) return sendError(res, 'Authentification requise', 401);
    req.user = user;
    next();
  } catch (error) {
    return sendError(res, 'Jeton invalide ou expiré', 401);
  }
};

/**
 * Middleware de vérification du rôle
 * @param {...string} roles - Rôles autorisés
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!roles.includes(req.user.role)) {
      return sendError(res, 'Forbidden: Insufficient permissions', 403);
    }

    next();
  };
};
