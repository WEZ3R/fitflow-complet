import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import {
  getSessionTemplates,
  getSessionTemplateById,
  createSessionTemplate,
  updateSessionTemplate,
  deleteSessionTemplate,
} from '../controllers/sessionTemplateController.js';

const router = express.Router();
router.use(authenticate);
router.use(authorize('COACH'));

router.get('/', getSessionTemplates);
router.get('/:id', getSessionTemplateById);
router.post('/', createSessionTemplate);
router.put('/:id', updateSessionTemplate);
router.delete('/:id', deleteSessionTemplate);

export default router;
