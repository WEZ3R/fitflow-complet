import express from 'express';
import { createAppeal, getMyAppeals } from '../controllers/appeal.controller.js';
import { authenticateEvenIfSuspended } from '../middlewares/auth.js';

const router = express.Router();

// authenticateEvenIfSuspended, et non authenticate : exiger un compte actif ici
// rendrait le recours impossible pour ceux qui en ont besoin.
router.post('/', authenticateEvenIfSuspended, createAppeal);
router.get('/mine', authenticateEvenIfSuspended, getMyAppeals);

export default router;
