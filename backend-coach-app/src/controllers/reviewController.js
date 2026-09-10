import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

/**
 * Vérifie que le client authentifié a une relation active avec le coach.
 * Retourne { clientProfile, coachProfile } ou null.
 */
async function resolveClientCoachRelation(req, coachId) {
  const clientProfile = await prisma.clientProfile.findUnique({
    where: { userId: req.user.id },
  });
  if (!clientProfile) return null;

  const coachProfile = await prisma.coachProfile.findUnique({
    where: { id: coachId },
    select: { id: true, rating: true, ratingCount: true },
  });
  if (!coachProfile) return null;

  const relation = await prisma.clientCoach.findFirst({
    where: { clientId: clientProfile.id, coachId, isActive: true },
  });
  if (!relation) return null;

  return { clientProfile, coachProfile };
}

/**
 * Met à jour rating + ratingCount de façon incrémentale.
 * On travaille sur les valeurs stockées (qui incluent les avis seedés),
 * sans recompter depuis la table reviews.
 *
 * - isNew   : true si c'est un nouvel avis, false si c'est une mise à jour
 * - oldRating : note précédente (seulement si isNew === false)
 */
async function updateCoachRating(coachId, { storedRating, storedCount, newRating, isNew, oldRating }) {
  let updatedCount = storedCount;
  let updatedRating;

  if (isNew) {
    updatedCount = storedCount + 1;
    // Moyenne pondérée : (ancienneMoyenne × ancienCount + nouvelleNote) / nouveauCount
    updatedRating = updatedCount === 0
      ? newRating
      : (storedRating * storedCount + newRating) / updatedCount;
  } else {
    // Mise à jour : count inchangé, on retire l'ancienne note et ajoute la nouvelle
    updatedRating = storedCount === 0
      ? newRating
      : (storedRating * storedCount - oldRating + newRating) / storedCount;
  }

  await prisma.coachProfile.update({
    where: { id: coachId },
    data: {
      rating: Math.round(updatedRating * 10) / 10,
      ratingCount: updatedCount,
    },
  });
}

/**
 * Créer ou mettre à jour un avis
 * POST /coaches/:coachId/reviews
 */
export const upsertReview = async (req, res) => {
  try {
    const { coachId } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return sendError(res, 'La note doit être comprise entre 1 et 5', 400);
    }

    const relation = await resolveClientCoachRelation(req, coachId);
    if (!relation) {
      return sendError(res, 'Vous devez être client de ce coach pour laisser un avis', 403);
    }

    const { clientProfile, coachProfile } = relation;
    const newRating = parseInt(rating);

    // Vérifier si un avis existe déjà (pour distinguer create vs update)
    const existing = await prisma.review.findUnique({
      where: { coachId_clientId: { coachId, clientId: clientProfile.id } },
      select: { rating: true },
    });

    const review = await prisma.review.upsert({
      where: { coachId_clientId: { coachId, clientId: clientProfile.id } },
      create: {
        coachId,
        clientId: clientProfile.id,
        rating: newRating,
        comment: comment?.trim() || null,
      },
      update: {
        rating: newRating,
        comment: comment?.trim() || null,
      },
      include: {
        client: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    await updateCoachRating(coachId, {
      storedRating: coachProfile.rating,
      storedCount:  coachProfile.ratingCount,
      newRating,
      isNew:        !existing,
      oldRating:    existing?.rating,
    });

    sendSuccess(res, review, 'Avis enregistré', 201);
  } catch (error) {
    console.error('upsertReview error:', error);
    sendError(res, 'Erreur lors de l\'enregistrement de l\'avis', 500);
  }
};

/**
 * Supprimer son avis
 * DELETE /coaches/:coachId/reviews
 */
export const deleteReview = async (req, res) => {
  try {
    const { coachId } = req.params;

    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!clientProfile) return sendError(res, 'Profil client introuvable', 404);

    const existing = await prisma.review.findUnique({
      where: { coachId_clientId: { coachId, clientId: clientProfile.id } },
      select: { rating: true },
    });
    if (!existing) return sendError(res, 'Avis introuvable', 404);

    const coachProfile = await prisma.coachProfile.findUnique({
      where: { id: coachId },
      select: { rating: true, ratingCount: true },
    });

    await prisma.review.delete({
      where: { coachId_clientId: { coachId, clientId: clientProfile.id } },
    });

    // Décrémenter et recalculer de façon incrémentale
    const newCount = Math.max(0, coachProfile.ratingCount - 1);
    const newRating = newCount === 0
      ? 0
      : (coachProfile.rating * coachProfile.ratingCount - existing.rating) / newCount;

    await prisma.coachProfile.update({
      where: { id: coachId },
      data: {
        rating: Math.round(newRating * 10) / 10,
        ratingCount: newCount,
      },
    });

    sendSuccess(res, null, 'Avis supprimé');
  } catch (error) {
    console.error('deleteReview error:', error);
    sendError(res, 'Erreur lors de la suppression de l\'avis', 500);
  }
};
