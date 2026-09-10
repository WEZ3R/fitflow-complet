import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import {
  getMyAvailability,
  upsertMyAvailability,
  getClientAvailability,
  getCoachAvailability,
  getMyScheduleBlocks,
  addScheduleBlock,
  removeScheduleBlock,
  blockClient,
  unblockClient,
  getBlockStatus,
} from '../controllers/availabilityController.js';

const router = express.Router();
router.use(authenticate);

// CLIENT : ses propres créneaux
router.get('/me', authorize('CLIENT'), getMyAvailability);
router.put('/', authorize('CLIENT'), upsertMyAvailability);

// COACH : son agenda bloqué
router.get('/coach/blocks', authorize('COACH'), getMyScheduleBlocks);
router.post('/coach/blocks', authorize('COACH'), addScheduleBlock);
router.delete('/coach/blocks/:blockId', authorize('COACH'), removeScheduleBlock);

// CLIENT : voir l'agenda du coach (vérif blocage)
router.get('/coach/:coachId', authorize('CLIENT'), getCoachAvailability);

// Blocage client-coach (les deux rôles peuvent GET)
router.get('/client-block/:clientId', getBlockStatus);
router.post('/client-block/:clientId', authorize('COACH'), blockClient);
router.delete('/client-block/:clientId', authorize('COACH'), unblockClient);

// COACH : disponibilités d'un client spécifique (après les routes fixes)
router.get('/:clientId', authorize('COACH'), getClientAvailability);

export default router;
