import { z } from 'zod';
import { email, password } from '../../shared/validation/schemas.js';

export const loginSchema = z.object({ email, password });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: password,
});

export type LoginInput = z.infer<typeof loginSchema>;
