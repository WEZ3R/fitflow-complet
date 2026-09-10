import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { searchGyms, searchGymsInDb, getGymsInBbox, getGymById } from '../controllers/gyms.controller.js';

const router = Router();

router.use(authenticate);

router.get('/search', searchGyms);
router.get('/db-search', searchGymsInDb);
// Avant '/:id', sinon Express prendrait 'bbox' pour un identifiant.
router.get('/bbox', getGymsInBbox);
router.get('/:id', getGymById);

export default router;
