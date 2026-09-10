import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import {
  getCachedUnreadCount,
  setCachedUnreadCount,
  invalidateUnreadCount,
} from '../services/notificationCache.js';

// GET /api/notifications
export const getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    sendSuccess(res, notifications);
  } catch (error) {
    console.error('getNotifications error:', error);
    sendError(res, 'Échec de la récupération des notifications', 500);
  }
};

// GET /api/notifications/unread-count
//
// Endpoint le plus sollicité de l'API : chaque application mobile ouverte l'appelle
// toutes les 30 secondes. Il est servi par un cache Redis en lecture au travers —
// PostgreSQL n'est interrogé que sur défaut de cache ou si Redis est indisponible.
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const cached = await getCachedUnreadCount(userId);
    if (cached !== null) return sendSuccess(res, { count: cached, cached: true });

    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    await setCachedUnreadCount(userId, count);

    sendSuccess(res, { count, cached: false });
  } catch (error) {
    console.error('getUnreadCount error:', error);
    sendError(res, 'Échec', 500);
  }
};

// PUT /api/notifications/:id/read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.notification.update({
      where: { id, userId: req.user.id },
      data: { isRead: true },
    });
    // Le compteur vient de changer : la valeur en cache est fausse.
    await invalidateUnreadCount(req.user.id);
    sendSuccess(res, null, 'Notification lue');
  } catch (error) {
    console.error('markAsRead error:', error);
    sendError(res, 'Échec', 500);
  }
};

// PUT /api/notifications/read-all
export const markAllAsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    await invalidateUnreadCount(req.user.id);
    sendSuccess(res, null, 'Toutes les notifications lues');
  } catch (error) {
    console.error('markAllAsRead error:', error);
    sendError(res, 'Échec', 500);
  }
};
