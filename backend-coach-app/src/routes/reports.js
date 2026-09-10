import express from 'express';
import { createReport, getMyReports } from '../controllers/report.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Signaler est ouvert à tout compte actif, quel que soit son rôle : un client peut
// signaler un coach, un coach peut signaler un client.
router.post('/', authenticate, createReport);
router.get('/mine', authenticate, getMyReports);

export default router;
