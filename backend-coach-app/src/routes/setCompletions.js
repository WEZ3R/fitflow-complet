import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  toggleSetCompletion,
  updateSetCompletion,
  getSetCompletions,
  getSessionSetCompletions,
  deleteSetCompletion,
} from '../controllers/setCompletions.controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Toggle set completion (on/off)
router.post('/toggle', toggleSetCompletion);

// Update set completion (reps/weight)
router.put('/', updateSetCompletion);

// Get set completions for an exercise
router.get('/exercise/:exerciseId', getSetCompletions);

// Get all set completions for a session
router.get('/session/:sessionId', getSessionSetCompletions);

// Delete a set completion
router.delete('/:exerciseId/:setNumber', deleteSetCompletion);

export default router;
