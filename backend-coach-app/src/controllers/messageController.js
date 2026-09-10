import prisma from '../config/database.js';
import { notifierConversation } from '../ws.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import { canAccessClient, canAccessConversation } from '../utils/authorization.js';

/**
 * Envoyer un message
 */
export const sendMessage = async (req, res) => {
  try {
    const { coachId, clientId, content, type, scheduledTime, isSentByCoach } = req.body;

    // Valider que coachId et clientId sont fournis
    if (!coachId || !clientId) {
      return sendError(res, 'coachId et clientId sont requis', 400);
    }

    const message = await prisma.message.create({
      data: {
        coachId,
        clientId,
        content,
        type: type || 'CHAT',
        scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
        isSentByCoach,
      },
    });

    // Diffusion temps reel, sans attendre : la reponse HTTP ne doit pas dependre du
    // WebSocket. Si personne n'ecoute, le sondage du client rattrapera.
    notifierConversation(coachId, clientId, { type: 'message', coachId, clientId });

    sendSuccess(res, message, 'Message sent successfully', 201);
  } catch (error) {
    console.error('Send message error:', error);
    sendError(res, 'Failed to send message', 500);
  }
};

/**
 * Récupérer la conversation entre un coach et un client
 */
export const getConversation = async (req, res) => {
  try {
    const { coachId, clientId } = req.params;

    if (!(await canAccessConversation(req.user.id, coachId, clientId))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    const messages = await prisma.message.findMany({
      where: {
        coachId,
        clientId,
        type: { in: ['CHAT', 'APPOINTMENT_PROPOSAL'] },
      },
      include: {
        appointment: {
          select: {
            id: true,
            title: true,
            startAt: true,
            endAt: true,
            durationMinutes: true,
            meetingType: true,
            locationType: true,
            locationDetail: true,
            status: true,
            rrule: true,
            parentId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    sendSuccess(res, messages);
  } catch (error) {
    console.error('Get conversation error:', error);
    sendError(res, 'Failed to get conversation', 500);
  }
};

/**
 * Récupérer les tips d'un client
 */
export const getClientTips = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { upcoming } = req.query; // Si true, récupérer seulement les tips futurs

    if (!(await canAccessClient(req.user.id, clientId))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    const where = {
      clientId,
      type: 'TIP',
      ...(upcoming && {
        scheduledTime: {
          gte: new Date(),
        },
      }),
    };

    const tips = await prisma.message.findMany({
      where,
      orderBy: { scheduledTime: 'asc' },
    });

    sendSuccess(res, tips);
  } catch (error) {
    console.error('Get tips error:', error);
    sendError(res, 'Failed to get tips', 500);
  }
};

/**
 * Marquer un message comme lu
 */
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.message.findUnique({
      where: { id },
      select: { coachId: true, clientId: true },
    });
    if (!existing) return sendError(res, 'Message introuvable', 404);
    if (!(await canAccessConversation(req.user.id, existing.coachId, existing.clientId))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    const message = await prisma.message.update({
      where: { id },
      data: { isRead: true },
    });

    sendSuccess(res, message, 'Message marked as read');
  } catch (error) {
    console.error('Mark as read error:', error);
    sendError(res, 'Failed to mark message as read', 500);
  }
};

/**
 * Récupérer tous les partenaires de conversation de l'utilisateur connecté.
 * Pour un CLIENT : retourne les CoachProfiles ayant échangé au moins un message.
 * Pour un COACH  : retourne les ClientProfiles ayant échangé au moins un message.
 */
export const getConversationPartners = async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    if (role === 'COACH') {
      const coachProfile = await prisma.coachProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!coachProfile) return sendSuccess(res, []);

      // Distinct clientIds dans les messages de ce coach
      const rows = await prisma.message.findMany({
        where: { coachId: coachProfile.id },
        select: { clientId: true },
        distinct: ['clientId'],
      });
      const clientIds = rows.map((r) => r.clientId);

      const clients = await prisma.clientProfile.findMany({
        where: { id: { in: clientIds } },
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      });
      return sendSuccess(res, clients);
    }

    // CLIENT
    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!clientProfile) return sendSuccess(res, []);

    // Distinct coachIds dans les messages de ce client
    const rows = await prisma.message.findMany({
      where: { clientId: clientProfile.id },
      select: { coachId: true },
      distinct: ['coachId'],
    });
    const coachIds = rows.map((r) => r.coachId);

    const coaches = await prisma.coachProfile.findMany({
      where: { id: { in: coachIds } },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    return sendSuccess(res, coaches);
  } catch (error) {
    console.error('Get conversation partners error:', error);
    sendError(res, 'Failed to get conversation partners', 500);
  }
};

/**
 * Récupérer le nombre de messages non lus par conversation
 * Retourne un objet { [interlocuteurProfileId]: count }
 */
export const getUnreadCountsByConversation = async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    if (role === 'COACH') {
      const coachProfile = await prisma.coachProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!coachProfile) return sendSuccess(res, {});

      const rows = await prisma.message.groupBy({
        by: ['clientId'],
        where: { coachId: coachProfile.id, isSentByCoach: false, isRead: false, type: 'CHAT' },
        _count: { id: true },
      });

      const counts = Object.fromEntries(rows.map((r) => [r.clientId, r._count.id]));
      return sendSuccess(res, counts);
    }

    // CLIENT
    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!clientProfile) return sendSuccess(res, {});

    const rows = await prisma.message.groupBy({
      by: ['coachId'],
      where: { clientId: clientProfile.id, isSentByCoach: true, isRead: false, type: 'CHAT' },
      _count: { id: true },
    });

    const counts = Object.fromEntries(rows.map((r) => [r.coachId, r._count.id]));
    return sendSuccess(res, counts);
  } catch (error) {
    console.error('Get unread counts by conversation error:', error);
    sendError(res, 'Failed to get unread counts', 500);
  }
};

/**
 * Marquer tous les messages non lus d'une conversation comme lus
 */
export const markConversationAsRead = async (req, res) => {
  try {
    const { coachId, clientId } = req.params;
    const { role } = req.user;

    if (!(await canAccessConversation(req.user.id, coachId, clientId))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    // Le client lit les messages du coach, le coach lit les messages du client
    const isSentByCoach = role === 'CLIENT';

    await prisma.message.updateMany({
      where: { coachId, clientId, isSentByCoach, isRead: false, type: 'CHAT' },
      data: { isRead: true },
    });

    sendSuccess(res, null, 'Conversation marked as read');
  } catch (error) {
    console.error('Mark conversation as read error:', error);
    sendError(res, 'Failed to mark conversation as read', 500);
  }
};

/**
 * Récupérer le nombre de messages non lus pour l'utilisateur connecté
 */
export const getUnreadCount = async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    if (role === 'COACH') {
      // Trouver le profil coach lié à cet utilisateur
      const coachProfile = await prisma.coachProfile.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!coachProfile) return sendSuccess(res, { count: 0 });

      const count = await prisma.message.count({
        where: {
          coachId: coachProfile.id,
          isSentByCoach: false,
          isRead: false,
          type: 'CHAT',
        },
      });

      return sendSuccess(res, { count });
    }

    // CLIENT
    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!clientProfile) return sendSuccess(res, { count: 0 });

    const count = await prisma.message.count({
      where: {
        clientId: clientProfile.id,
        isSentByCoach: true,
        isRead: false,
        type: 'CHAT',
      },
    });

    return sendSuccess(res, { count });
  } catch (error) {
    console.error('Get unread count error:', error);
    sendError(res, 'Failed to get unread count', 500);
  }
};

/**
 * Supprimer un message
 */
export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.message.findUnique({
      where: { id },
      select: { coachId: true, clientId: true },
    });
    if (!existing) return sendError(res, 'Message introuvable', 404);
    if (!(await canAccessConversation(req.user.id, existing.coachId, existing.clientId))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    await prisma.message.delete({
      where: { id },
    });

    sendSuccess(res, null, 'Message deleted successfully');
  } catch (error) {
    console.error('Delete message error:', error);
    sendError(res, 'Failed to delete message', 500);
  }
};
