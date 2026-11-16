import { z } from 'zod';
import { dateString, objectId, pageNumber, pageSize } from '../../shared/validation/schemas.js';

export const vitalsSchema = z
  .object({
    temperatureC: z.number().min(25).max(45).optional(),
    pulseBpm: z.number().int().min(0).max(300).optional(),
    respRate: z.number().int().min(0).max(100).optional(),
    bpSystolic: z.number().int().min(0).max(400).optional(),
    bpDiastolic: z.number().int().min(0).max(350).optional(),
    weightKg: z.number().min(0).max(500).optional(),
    heightCm: z.number().min(0).max(260).optional(),
    spo2: z.number().int().min(0).max(100).optional(),
  })
  .strict();

export const createVisitSchema = z
  .object({
    patientId: objectId,
    tokenId: objectId.optional(),
    doctorId: objectId.optional(), // admins only; enforced in service
    visitDate: dateString.optional(),
    chiefComplaints: z.string().trim().max(2000).optional(),
    clinicalNotes: z.string().trim().max(5000).optional(),
    vitals: vitalsSchema.optional(),
    examinationFindings: z.string().trim().max(2000).optional(),
    diagnosis: z.string().trim().max(1000).optional(),
    icdCodeIds: z.array(objectId).max(10).optional(),
    investigations: z.string().trim().max(2000).optional(),
    followUpDate: dateString.optional(),
    followUpNotes: z.string().trim().max(500).optional(),
  })
  .strict();

export const updateVisitSchema = createVisitSchema.partial().extend({
  status: z.enum(['open', 'completed', 'cancelled']).optional(),
});

export const visitListSchema = z.object({
  page: pageNumber,
  limit: pageSize,
  patientId: objectId.optional(),
  doctorId: objectId.optional(),
  visitDate: dateString.optional(),
  status: z.enum(['open', 'completed', 'cancelled']).optional(),
});

export const prescriptionItemSchema = z
  .object({
    medicineId: objectId,
    dosage: z.string().trim().max(100).optional(),
    frequency: z.string().trim().min(1, 'Frequency is required').max(120),
    timing: z.string().trim().max(100).optional(),
    durationDays: z.number().int().min(1).max(365).optional(),
    instructions: z.string().trim().max(500).optional(),
  })
  .strict();

export const createPrescriptionSchema = z.object({
  visitId: objectId,
  items: z.array(prescriptionItemSchema).min(1, 'At least one medicine is required').max(30),
  generalInstructions: z.string().trim().max(1000).optional(),
  status: z.enum(['draft', 'finalized']).optional(),
});

export const updatePrescriptionSchema = z
  .object({
    items: z.array(prescriptionItemSchema).min(1).max(30).optional(),
    generalInstructions: z.string().trim().max(1000).optional(),
    status: z.enum(['draft', 'finalized', 'cancelled']).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { error: 'No changes provided' });

export const createIcdCodeSchema = z.object({
  code: z.string().trim().min(2).max(12),
  description: z.string().trim().min(3).max(300),
});

export type CreateVisitInput = z.infer<typeof createVisitSchema>;
export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;
export type VisitListInput = z.infer<typeof visitListSchema>;
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
export type UpdatePrescriptionInput = z.infer<typeof updatePrescriptionSchema>;
