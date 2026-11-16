import { z } from 'zod';

export const updateSettingsSchema = z
  .object({
    clinicName: z.string().trim().min(2).max(200).optional(),
    address: z.string().trim().max(500).optional(),
    phone: z.string().trim().max(20).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    logoText: z.string().trim().max(30).optional(),
    timezone: z.string().trim().max(60).optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    gstinNumber: z.string().trim().toUpperCase().max(20).optional(),
    defaultTaxRatePercent: z.number().min(0).max(28).optional(),
    consultationFeeMinor: z.number().int().min(0).optional(),
    gstRates: z.record(z.string(), z.number().min(0).max(28)).optional(),
    invoicePrefixes: z
      .record(
        z.enum(['pharmacy', 'procedure', 'purchase', 'expense']),
        z.object({ prefix: z.string().trim().min(1).max(10) }).partial(),
      )
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { error: 'No changes provided' });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
