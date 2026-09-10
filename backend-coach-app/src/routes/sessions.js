import express from 'express';
import {
  upsertSession,
  getSessionsByProgram,
  getSessionById,
  deleteSession,
  validateSession,
  addSessionComment,
} from '../controllers/sessionController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Routes pour les coachs
router.post('/', authorize('COACH'), upsertSession);
router.delete('/:id', authorize('COACH'), deleteSession);
router.post('/:sessionId/comments', authorize('COACH'), addSessionComment);

// Routes pour les clients (IMPORTANT: avant les routes avec :id)
router.put('/:id/validate', authorize('CLIENT'), validateSession);

// Routes accessibles par coach et client
router.get('/program/:programId', getSessionsByProgram);
router.get('/:id', getSessionById);

export default router;
