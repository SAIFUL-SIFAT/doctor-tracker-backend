import { Router } from 'express';
import { PatientsController } from './patients.controller.js';
import { validate } from '../../middleware/validate.js';
import { updatePatientSchema, patientQuerySchema } from './patients.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

export const patientsRouter = Router();

patientsRouter.use(requireAuth);

patientsRouter.get('/', validate({ query: patientQuerySchema }), asyncHandler(PatientsController.list));
patientsRouter.get('/:id', asyncHandler(PatientsController.getById));
patientsRouter.patch('/:id', requireRole(['admin']), validate({ body: updatePatientSchema }), asyncHandler(PatientsController.update));
patientsRouter.delete('/:id', requireRole(['admin']), asyncHandler(PatientsController.delete));
