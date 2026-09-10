import express from 'express';
import { searchExerciseRefs, getExerciseRefById } from '../controllers/exerciseRefController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Recherche d'exercices — accessible aux COACH et CLIENT
router.get('/search', authorize('COACH', 'CLIENT'), searchExerciseRefs);

// Détail d'un exercice de référence
router.get('/:id', authorize('COACH', 'CLIENT'), getExerciseRefById);

export default router;
