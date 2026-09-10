import express from 'express';
import { sendMessage, getConversation, getClientTips, markAsRead, deleteMessage, getUnreadCount, getUnreadCountsByConversation, markConversationAsRead, getConversationPartners } from '../controllers/messageController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Routes pour les messages
router.get('/unread-count', getUnreadCount);
router.get('/unread-counts', getUnreadCountsByConversation);
router.get('/conversations', getConversationPartners);
router.patch('/conversation/:coachId/:clientId/read', markConversationAsRead);
router.post('/', sendMessage);
router.get('/conversation/:coachId/:clientId', getConversation);
router.get('/tips/client/:clientId', getClientTips);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteMessage);

export default router;
