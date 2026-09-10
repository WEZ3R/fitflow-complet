import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

// Vérifie si un blocage client est actif
const isBlockActive = (block) => {
  if (!block) return false;
  if (!block.blockedUntil) return true; // permanent
  return new Date(block.blockedUntil) > new Date();
};

// GET /api/availability/me — CLIENT : ses propres créneaux
export const getMyAvailability = async (req, res) => {
  try {
    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!clientProfile) return sendError(res, 'Profil client introuvable', 404);

    const availabilities = await prisma.clientAvailability.findMany({
      where: { clientId: clientProfile.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    sendSuccess(res, availabilities);
  } catch (error) {
    console.error('getMyAvailability error:', error);
    sendError(res, 'Échec de la récupération des disponibilités', 500);
  }
};

// PUT /api/availability — CLIENT : remplace tous ses créneaux
export const upsertMyAvailability = async (req, res) => {
  try {
    const { slots } = req.body;
    if (!Array.isArray(slots)) return sendError(res, 'Format invalide : slots doit être un tableau', 400);

    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!clientProfile) return sendError(res, 'Profil client introuvable', 404);

    // Remplacement atomique
    const result = await prisma.$transaction(async (tx) => {
      await tx.clientAvailability.deleteMany({ where: { clientId: clientProfile.id } });

      if (slots.length === 0) return [];

      return tx.clientAvailability.createMany({
        data: slots.map((slot) => ({
          clientId: clientProfile.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          contactTypes: slot.contactTypes || [],
        })),
      });
    });

    const availabilities = await prisma.clientAvailability.findMany({
      where: { clientId: clientProfile.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    sendSuccess(res, availabilities, 'Disponibilités mises à jour');
  } catch (error) {
    console.error('upsertMyAvailability error:', error);
    sendError(res, 'Échec de la mise à jour des disponibilités', 500);
  }
};

// GET /api/availability/:clientId — COACH : créneaux du client
export const getClientAvailability = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { month } = req.query; // format "YYYY-MM"

    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!coachProfile) return sendError(res, 'Profil coach introuvable', 404);

    // Vérifier la relation coach-client
    const relation = await prisma.clientCoach.findFirst({
      where: { coachId: coachProfile.id, clientId, isActive: true },
    });
    if (!relation) return sendError(res, 'Client introuvable ou non assigné', 403);

    // Récupérer les disponibilités
    const availabilities = await prisma.clientAvailability.findMany({
      where: { clientId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    // Récupérer les RDV du mois
    let from, to;
    if (month) {
      from = new Date(`${month}-01T00:00:00.000Z`);
      to = new Date(from);
      to.setMonth(to.getMonth() + 1);
    } else {
      from = new Date();
      from.setDate(1);
      to = new Date(from);
      to.setMonth(to.getMonth() + 1);
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        coachId: coachProfile.id,
        clientId,
        startAt: { gte: from, lt: to },
        OR: [{ parentId: null, rrule: null }, { parentId: { not: null } }],
      },
      orderBy: { startAt: 'asc' },
    });

    sendSuccess(res, { availabilities, appointments });
  } catch (error) {
    console.error('getClientAvailability error:', error);
    sendError(res, 'Échec de la récupération des disponibilités client', 500);
  }
};

// GET /api/availability/coach/:coachId — CLIENT : voir l'agenda du coach (jours bloqués)
export const getCoachAvailability = async (req, res) => {
  try {
    const { coachId } = req.params;

    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!clientProfile) return sendError(res, 'Profil client introuvable', 404);

    // Vérifier si le client est bloqué par ce coach
    const block = await prisma.coachClientBlock.findUnique({
      where: { coachId_clientId: { coachId, clientId: clientProfile.id } },
    });

    if (block && isBlockActive(block)) {
      return sendSuccess(res, { blocked: true });
    }

    // Retourner les jours bloqués du coach
    const scheduleBlocks = await prisma.coachScheduleBlock.findMany({
      where: { coachId },
      orderBy: { createdAt: 'asc' },
    });

    sendSuccess(res, { blocked: false, scheduleBlocks });
  } catch (error) {
    console.error('getCoachAvailability error:', error);
    sendError(res, "Échec de la récupération de l'agenda du coach", 500);
  }
};

// GET /api/availability/coach/blocks — COACH : ses jours bloqués
export const getMyScheduleBlocks = async (req, res) => {
  try {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!coachProfile) return sendError(res, 'Profil coach introuvable', 404);

    const blocks = await prisma.coachScheduleBlock.findMany({
      where: { coachId: coachProfile.id },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, blocks);
  } catch (error) {
    console.error('getMyScheduleBlocks error:', error);
    sendError(res, 'Échec de la récupération des blocages', 500);
  }
};

// POST /api/availability/coach/blocks — COACH : ajouter un blocage
export const addScheduleBlock = async (req, res) => {
  try {
    const { dayOfWeek, date, reason } = req.body;

    if (dayOfWeek === undefined && !date) {
      return sendError(res, 'Veuillez fournir dayOfWeek (récurrent) ou date (ponctuel)', 400);
    }

    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!coachProfile) return sendError(res, 'Profil coach introuvable', 404);

    const block = await prisma.coachScheduleBlock.create({
      data: {
        coachId: coachProfile.id,
        dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : null,
        date: date ? new Date(date) : null,
        reason: reason || null,
      },
    });

    sendSuccess(res, block, 'Blocage ajouté', 201);
  } catch (error) {
    console.error('addScheduleBlock error:', error);
    sendError(res, "Échec de l'ajout du blocage", 500);
  }
};

// DELETE /api/availability/coach/blocks/:blockId — COACH : supprimer un blocage
export const removeScheduleBlock = async (req, res) => {
  try {
    const { blockId } = req.params;

    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!coachProfile) return sendError(res, 'Profil coach introuvable', 404);

    const block = await prisma.coachScheduleBlock.findUnique({ where: { id: blockId } });
    if (!block) return sendError(res, 'Blocage introuvable', 404);
    if (block.coachId !== coachProfile.id) return sendError(res, 'Accès non autorisé', 403);

    await prisma.coachScheduleBlock.delete({ where: { id: blockId } });

    sendSuccess(res, null, 'Blocage supprimé');
  } catch (error) {
    console.error('removeScheduleBlock error:', error);
    sendError(res, 'Échec de la suppression du blocage', 500);
  }
};

// POST /api/availability/client-block/:clientId — COACH : bloquer un client
export const blockClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { blockedUntil, reason } = req.body;

    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!coachProfile) return sendError(res, 'Profil coach introuvable', 404);

    const block = await prisma.coachClientBlock.upsert({
      where: { coachId_clientId: { coachId: coachProfile.id, clientId } },
      update: {
        blockedUntil: blockedUntil ? new Date(blockedUntil) : null,
        reason: reason || null,
      },
      create: {
        coachId: coachProfile.id,
        clientId,
        blockedUntil: blockedUntil ? new Date(blockedUntil) : null,
        reason: reason || null,
      },
    });

    sendSuccess(res, block, 'Client bloqué', 201);
  } catch (error) {
    console.error('blockClient error:', error);
    sendError(res, 'Échec du blocage du client', 500);
  }
};

// DELETE /api/availability/client-block/:clientId — COACH : débloquer un client
export const unblockClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!coachProfile) return sendError(res, 'Profil coach introuvable', 404);

    await prisma.coachClientBlock.deleteMany({
      where: { coachId: coachProfile.id, clientId },
    });

    sendSuccess(res, null, 'Client débloqué');
  } catch (error) {
    console.error('unblockClient error:', error);
    sendError(res, 'Échec du déblocage du client', 500);
  }
};

// GET /api/availability/client-block/:clientId — COACH ou CLIENT : statut du blocage
export const getBlockStatus = async (req, res) => {
  try {
    const { clientId } = req.params;

    let coachId;
    if (req.user.role === 'COACH') {
      const coachProfile = await prisma.coachProfile.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (!coachProfile) return sendError(res, 'Profil coach introuvable', 404);
      coachId = coachProfile.id;
    } else {
      // CLIENT : le clientId dans params est le coachId ici (voir routes)
      // La route GET /client-block/:coachId est utilisée par le client
      const clientProfile = await prisma.clientProfile.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (!clientProfile) return sendError(res, 'Profil client introuvable', 404);

      // Pour le client, on cherche si ce coach l'a bloqué
      const block = await prisma.coachClientBlock.findUnique({
        where: { coachId_clientId: { coachId: clientId, clientId: clientProfile.id } },
      });

      const active = isBlockActive(block);
      return sendSuccess(res, { isBlocked: active, block: active ? block : null });
    }

    const block = await prisma.coachClientBlock.findUnique({
      where: { coachId_clientId: { coachId, clientId } },
    });

    const active = isBlockActive(block);
    sendSuccess(res, { isBlocked: active, block: active ? block : null });
  } catch (error) {
    console.error('getBlockStatus error:', error);
    sendError(res, 'Échec de la récupération du statut de blocage', 500);
  }
};
