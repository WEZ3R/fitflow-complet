import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { upload, handleUploadError } from '../middlewares/upload.js';
import {
  getCoachClients,
  getClientById,
  getMyClientProfile,
  updateMyClientProfile,
  getProspectiveClients,
  submitClientOnboarding,
} from '../controllers/clients.controller.js';

const router = express.Router();

// Toutes les routes nécessitent l'authentification
router.use(authenticate);

// Routes pour les clients (leur propre profil)
router.get('/me', authorize('CLIENT'), getMyClientProfile);
router.put('/me', authorize('CLIENT'), upload.single('profilePicture'), handleUploadError, updateMyClientProfile);
router.put('/onboarding', authorize('CLIENT'), submitClientOnboarding);

// Routes pour les coaches
router.get('/coach', authorize('COACH'), getCoachClients);
router.get('/prospection', authorize('COACH'), getProspectiveClients);
router.get('/:id', authorize('COACH'), getClientById);

export default router;
