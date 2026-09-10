import express from 'express';
import { searchFood, getFoodByCode } from '../controllers/foodController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Recherche d'aliments Ciqual
router.get('/search', searchFood);

// Détail d'un aliment par code Ciqual
router.get('/:code', getFoodByCode);

export default router;
