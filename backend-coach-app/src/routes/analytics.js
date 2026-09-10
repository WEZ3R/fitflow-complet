import express from 'express';
import {
  getCoachClients,
  getClientStats,
  getClientProgress,
  getGoalsCompletion,
} from '../controllers/analyticsController.js';
import {
  getEstimated1RM,
  getWeeklyVolume,
  getCompletionAndStreak,
  getLoadProgression,
  getSessionINOL,
  getStrengthStandards,
  getVolumeLandmarks,
} from '../controllers/workoutAnalyticsController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Toutes les routes nécessitent l'authentification
router.get('/clients', authenticate, getCoachClients);
router.get('/stats', authenticate, getClientStats);
router.get('/progress', authenticate, getClientProgress);
router.get('/goals', authenticate, getGoalsCompletion);

// ── Analytics musculation (Phase 1) ──
router.get('/workout/estimated-1rm', authenticate, getEstimated1RM);
router.get('/workout/volume', authenticate, getWeeklyVolume);
router.get('/workout/completion', authenticate, getCompletionAndStreak);
router.get('/workout/load-progression', authenticate, getLoadProgression);

// ── Analytics musculation (Phase 2) ──
router.get('/workout/inol', authenticate, getSessionINOL);
router.get('/workout/strength-standards', authenticate, getStrengthStandards);
router.get('/workout/volume-landmarks', authenticate, getVolumeLandmarks);

export default router;
