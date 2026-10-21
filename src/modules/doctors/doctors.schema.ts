import { z } from 'zod';
import { SPECIALIZATIONS } from '../../config/constants.js';

export const createDoctorSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  specialization: z.enum(SPECIALIZATIONS, {
    errorMap: () => ({ message: 'Please select a valid specialization' }),
  }),
  hospital: z.string().trim().min(2, 'Hospital must be at least 2 characters').max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Please enter a valid phone number'),
  email: z.string().trim().email('Please enter a valid email address').toLowerCase().max(120),
}).strict();

export const doctorQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  q: z.string().optional(),
  specialization: z.union([z.string(), z.array(z.string())]).optional(),
  hospital: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sort: z.string().optional(),
});

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
