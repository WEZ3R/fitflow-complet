import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import {
  createRequest,
  getReceivedRequests,
  getSentRequests,
  acceptRequest,
  rejectRequest,
} from '../controllers/requests.controller.js';

const router = express.Router();

// Toutes les routes nécessitent l'authentification
router.use(authenticate);

// Routes pour les clients
router.post('/', authorize('CLIENT'), createRequest);
router.get('/sent', authorize('CLIENT'), getSentRequests);

// Routes pour les coaches
router.get('/received', authorize('COACH'), getReceivedRequests);
router.put('/:requestId/accept', authorize('COACH'), acceptRequest);
router.put('/:requestId/reject', authorize('COACH'), rejectRequest);

export default router;
