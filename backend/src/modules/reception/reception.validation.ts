import { z } from 'zod';
import { dateString, gender, objectId, pageNumber, pageSize, phone } from '../../shared/validation/schemas.js';

const patientBaseSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(150),
  gender,
  phone,
  dateOfBirth: dateString.optional(),
  ageYears: z.number().int().min(0).max(130).optional(),
  altPhone: phone.optional(),
  email: z.string().trim().toLowerCase().email().max(200).optional(),
  address: z.string().trim().max(500).optional(),
  registrationNotes: z.string().trim().max(1000).optional(),
});

export const createPatientSchema = patientBaseSchema.refine((d) => Boolean(d.dateOfBirth) || d.ageYears !== undefined, {
  error: 'Either date of birth or age is required',
});

export const updatePatientSchema = patientBaseSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, { error: 'No changes provided' });

export const duplicateCheckSchema = z
  .object({
    phone: phone.optional(),
    name: z.string().trim().min(2).max(150).optional(),
    gender: gender.optional(),
  })
  .refine((d) => d.phone !== undefined || (d.name !== undefined && d.gender !== undefined), {
    error: 'Provide phone, or name together with gender',
  });

export const patientSearchSchema = z.object({
  page: pageNumber,
  limit: pageSize,
  uhid: z.string().trim().max(30).optional(),
  name: z.string().trim().max(150).optional(),
  phone: z.string().trim().max(20).optional(),
  sort: z.enum(['recent', 'name']).default('recent'),
});

export const bookTokenSchema = z.object({
  patientId: objectId,
  tokenDate: dateString.optional(),
  departmentId: objectId.optional(),
  doctorId: objectId.optional(),
  note: z.string().trim().max(500).optional(),
});

export const tokenListSchema = z.object({
  tokenDate: dateString.optional(),
  status: z.enum(['waiting', 'in_consultation', 'completed', 'cancelled', 'no_show']).optional(),
  doctorId: objectId.optional(),
  patientId: objectId.optional(),
  page: pageNumber,
  limit: pageSize,
});

export const tokenStatusSchema = z.object({
  status: z.enum(['waiting', 'in_consultation', 'completed', 'cancelled', 'no_show']),
  note: z.string().trim().max(500).optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type DuplicateCheckInput = z.infer<typeof duplicateCheckSchema>;
export type PatientSearchInput = z.infer<typeof patientSearchSchema>;
export type BookTokenInput = z.infer<typeof bookTokenSchema>;
export type TokenListInput = z.infer<typeof tokenListSchema>;
export type TokenStatusInput = z.infer<typeof tokenStatusSchema>;
