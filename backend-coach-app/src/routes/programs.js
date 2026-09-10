import express from 'express';
import {
  createProgram,
  getCoachPrograms,
  getClientPrograms,
  getProgramById,
  updateProgram,
  deleteProgram,
} from '../controllers/programController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Routes pour les coachs
router.post('/', authorize('COACH'), createProgram);
router.get('/coach', authorize('COACH'), getCoachPrograms);

// Routes pour les clients
router.get('/client', authorize('CLIENT'), getClientPrograms);

// Routes accessibles par coach et client
router.get('/:id', getProgramById);

// Routes pour les coachs seulement
router.put('/:id', authorize('COACH'), updateProgram);
router.delete('/:id', authorize('COACH'), deleteProgram);

export default router;
