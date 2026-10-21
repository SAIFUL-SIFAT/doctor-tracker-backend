import { z } from 'zod';
import { CONDITIONS, GENDERS, PATIENT_STATUSES } from '../../config/constants.js';

export const createPatientSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  age: z.coerce.number().int().min(0, 'Age must be 0 or greater').max(120, 'Age must be at most 120'),
  gender: z.enum(GENDERS, {
    errorMap: () => ({ message: 'Please select a valid gender' }),
  }),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Please enter a valid phone number'),
  email: z.string().trim().email('Please enter a valid email address').toLowerCase().optional().or(z.literal('')),
  condition: z.enum(CONDITIONS, {
    errorMap: () => ({ message: 'Please select a valid condition' }),
  }),
  status: z.enum(PATIENT_STATUSES).default('active'),
  notes: z.string().max(500, 'Notes must be under 500 characters').optional().or(z.literal('')),
  doctorId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid doctor ID').optional(),
}).strict();

export const updatePatientSchema = createPatientSchema.partial();

export const patientQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  q: z.string().optional(),
  condition: z.union([z.string(), z.array(z.string())]).optional(),
  status: z.string().optional(),
  doctorId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sort: z.string().optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
