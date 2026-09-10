import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import {
  createTemplate,
  getCoachTemplates,
  getTemplateById,
  applyTemplate,
  updateTemplate,
  deleteTemplate,
} from '../controllers/templateController.js';

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Routes pour les coachs uniquement
router.use(authorize('COACH'));

// CRUD templates
router.post('/', createTemplate);
router.get('/', getCoachTemplates);
router.get('/:id', getTemplateById);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

// Appliquer un template à un client
router.post('/:templateId/apply', applyTemplate);

export default router;
