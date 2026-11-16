import { z } from 'zod';
import { dateString, minorMoney, nonNegInt, objectId, pageNumber, pageSize } from '../../shared/validation/schemas.js';

export const zodObjectId = objectId;

export const createCatalogItemSchema = z.object({
  name: z.string().trim().min(2, 'Procedure name is required').max(200),
  description: z.string().trim().max(1000).optional(),
  defaultSessionDurationMinutes: z.coerce.number().int().min(5, 'Duration must be at least 5 minutes').max(600),
  priceMinor: minorMoney,
  taxRatePercent: z.number().min(0).max(28).default(0),
});

export const updateCatalogItemSchema = createCatalogItemSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const procedureItemPlanSchema = z.object({
  procedureId: objectId,
  sessionsPlanned: z.number().int().min(1, 'At least one session per procedure').max(60),
});

export const createPlanSchema = z.object({
  patientId: objectId,
  startDate: dateString,
  endDate: dateString.optional(),
  items: z.array(procedureItemPlanSchema).min(1, 'At least one procedure is required').max(10),
  assignedTherapistId: objectId.optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const planListSchema = z.object({
  page: pageNumber,
  limit: pageSize,
  patientId: objectId.optional(),
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
  therapistId: objectId.optional(),
});

export const sessionUpdateSchema = z
  .object({
    status: z.enum(['scheduled', 'completed', 'cancelled', 'missed', 'rescheduled']).optional(),
    scheduledDate: dateString.optional(),
    notes: z.string().trim().max(1000).optional(),
    assignedTherapistId: objectId.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { error: 'No changes provided' });

export const sessionListSchema = z.object({
  page: pageNumber,
  limit: pageSize,
  scheduledDate: dateString.optional(),
  therapistId: objectId.optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'missed', 'rescheduled']).optional(),
  patientId: objectId.optional(),
});

export const procedureBillLineSchema = z.object({
  planId: objectId,
  procedureId: objectId,
  sessionsCount: nonNegInt,
  discountPercent: z.number().min(0).max(100).default(0),
});

export const createProcedureBillSchema = z.object({
  patientId: objectId,
  paymentMethod: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other']).default('cash'),
  lines: z.array(procedureBillLineSchema).min(1, 'At least one bill line is required').max(20),
});

export type CreateCatalogInput = z.infer<typeof createCatalogItemSchema>;
export type CreatePlanInputSchema = z.infer<typeof createPlanSchema>;
export type SessionUpdateInput = z.infer<typeof sessionUpdateSchema>;
export type CreateProcBillInput = z.infer<typeof createProcedureBillSchema>;
