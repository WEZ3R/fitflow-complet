import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  toggleGoalCompletion,
  getGoalCompletions,
} from '../controllers/goalController.js';

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Routes pour les clients
router.post('/:goalId/complete', toggleGoalCompletion);
router.get('/completions', getGoalCompletions);

export default router;
