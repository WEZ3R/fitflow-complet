import express from 'express';
import {
  listReports, getReport, dismissReport,
  getUserFile,
  suspendUser, unsuspendUser, scheduleDeletion, cancelDeletion,
  listAppeals, reviewAppeal,
} from '../controllers/admin.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Le rôle est exigé une fois pour tout le routeur : aucune route d'administration
// ne peut être ajoutée plus bas en oubliant sa protection.
router.use(authenticate, authorize('ADMIN'));

// Signalements
router.get('/reports', listReports);
router.get('/reports/:id', getReport);
router.put('/reports/:id/dismiss', dismissReport);

// Fiche de modération
router.get('/users/:id', getUserFile);

// Sanctions
router.post('/users/:id/suspend', suspendUser);
router.post('/users/:id/unsuspend', unsuspendUser);
router.post('/users/:id/schedule-deletion', scheduleDeletion);
router.post('/users/:id/cancel-deletion', cancelDeletion);

// Recours
router.get('/appeals', listAppeals);
router.put('/appeals/:id', reviewAppeal);

export default router;
