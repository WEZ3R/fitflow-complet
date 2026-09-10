import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { calculateNutrition } from '../controllers/nutrition.controller.js';

const router = Router();

router.use(authenticate);

// POST /api/nutrition/calculate
router.post('/calculate', authorize('COACH'), calculateNutrition);

export default router;
