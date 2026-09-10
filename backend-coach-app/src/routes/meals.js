import express from 'express';
import { createMeal, getClientMeals, updateMeal, deleteMeal } from '../controllers/mealController.js';
import { authenticate } from '../middlewares/auth.js';
import { upload, handleUploadError } from '../middlewares/upload.js';

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Routes pour les repas
router.post('/', upload.single('photo'), handleUploadError, createMeal);
router.get('/client/:clientId', getClientMeals);
router.put('/:id', updateMeal);
router.delete('/:id', deleteMeal);

export default router;
