import { Router } from 'express';
import { DoctorsController } from './doctors.controller.js';
import { validate } from '../../middleware/validate.js';
import { createDoctorSchema, doctorQuerySchema } from './doctors.schema.js';
import { createPatientSchema, patientQuerySchema } from '../patients/patients.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

export const doctorsRouter = Router();

// All doctor routes require auth
doctorsRouter.use(requireAuth);

doctorsRouter.get('/meta/filters', asyncHandler(DoctorsController.getFilters));
doctorsRouter.get('/', validate({ query: doctorQuerySchema }), asyncHandler(DoctorsController.list));
doctorsRouter.post('/', requireRole(['admin']), validate({ body: createDoctorSchema }), asyncHandler(DoctorsController.create));
doctorsRouter.get('/:id', asyncHandler(DoctorsController.getById));

// Doctor-scoped patients
doctorsRouter.get('/:id/patients', validate({ query: patientQuerySchema }), asyncHandler(DoctorsController.getDoctorPatients));
doctorsRouter.post('/:id/patients', requireRole(['admin']), validate({ body: createPatientSchema }), asyncHandler(DoctorsController.addDoctorPatient));
doctorsRouter.delete('/:id/patients/:patientId', requireRole(['admin']), asyncHandler(DoctorsController.removeDoctorPatient));
