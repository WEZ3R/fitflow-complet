import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { upload, handleUploadError } from '../middlewares/upload.js';
import { getAllCoaches, getCoachProfile, getMyProfile, updateMyProfile, submitCoachOnboarding, getRecommendedCoaches } from '../controllers/coaches.controller.js';
import { upsertReview, deleteReview } from '../controllers/reviewController.js';

const router = express.Router();

// Routes publiques
router.get('/', getAllCoaches);
router.get('/public/:id', getCoachProfile);

// Routes protégées
router.get('/me', authenticate, getMyProfile);
router.put('/me', authenticate, upload.single('profilePicture'), handleUploadError, updateMyProfile);
router.put('/onboarding', authenticate, submitCoachOnboarding);
router.get('/recommended', authenticate, getRecommendedCoaches);

// Avis (client authentifié uniquement)
router.post('/:coachId/reviews', authenticate, upsertReview);
router.delete('/:coachId/reviews', authenticate, deleteReview);

export default router;
