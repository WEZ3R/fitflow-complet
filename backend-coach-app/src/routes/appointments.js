import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import {
  createAppointment,
  getAppointments,
  getUpcomingAppointments,
  getAppointmentById,
  confirmAppointment,
  cancelAppointment,
  updateAppointment,
  deleteAppointment,
} from '../controllers/appointment.controller.js';

const router = express.Router();
router.use(authenticate);

router.post('/',                                  createAppointment);
router.get('/',                                   getAppointments);
router.get('/upcoming',                           getUpcomingAppointments);
router.get('/:id',                                getAppointmentById);
router.put('/:id/confirm',                         confirmAppointment);
router.put('/:id/cancel',                         cancelAppointment);
router.put('/:id',            authorize('COACH'),  updateAppointment);
router.delete('/:id',         authorize('COACH'),  deleteAppointment);

export default router;
