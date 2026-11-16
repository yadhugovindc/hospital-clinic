import { z } from 'zod';
import { email, password, pageNumber, pageSize } from '../../shared/validation/schemas.js';

export const roleEnum = z.enum(['admin', 'receptionist', 'doctor', 'pharmacist', 'therapist', 'accountant']);

export const createSchema = z.object({
  email,
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  password,
  role: roleEnum,
});

export const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    role: roleEnum.optional(),
    password: password.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { error: 'No changes provided' });

export const statusSchema = z.object({ isActive: z.boolean({ error: 'isActive must be a boolean' }) });

export const listUsersQuerySchema = z.object({
  page: pageNumber,
  limit: pageSize,
  role: z.enum(['all', 'admin', 'receptionist', 'doctor', 'pharmacist', 'therapist', 'accountant']).default('all'),
  search: z.string().trim().max(100).optional(),
});
