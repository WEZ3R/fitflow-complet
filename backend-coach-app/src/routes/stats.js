import express from 'express';
import { upsertDailyStat, getClientStats, getAggregatedStats, getStatByDate } from '../controllers/statController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Routes pour les stats
router.post('/', upsertDailyStat);
router.get('/client/:clientId', getClientStats);
router.get('/client/:clientId/aggregated', getAggregatedStats);
router.get('/client/:clientId/date/:date', getStatByDate);

export default router;
