import { z } from 'zod';
import { dateString, minorMoney, nonNegInt, objectId, pageNumber, pageSize } from '../../shared/validation/schemas.js';

export const createMedicineSchema = z.object({
  name: z.string().trim().min(1, 'Medicine name is required').max(200),
  category: z.string().trim().max(100).optional(),
  form: z.string().trim().min(1).max(60),
  strength: z.string().trim().max(60).optional(),
  unit: z.string().trim().min(1).max(20),
  isAyurvedic: z.boolean().default(true),
  taxRatePercent: z.number().min(0).max(28).default(0),
  sellingPriceMinor: minorMoney,
  lowStockThreshold: nonNegInt.default(10),
});

export const updateMedicineSchema = createMedicineSchema.partial().refine((d) => Object.keys(d).length > 0, { error: 'No changes provided' });

export const medicineQuerySchema = z.object({
  page: pageNumber,
  limit: pageSize,
  search: z.string().trim().max(150).optional(),
  category: z.string().trim().max(100).optional(),
  lowStock: z.enum(['true', 'false']).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2).max(200),
  contactPerson: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  address: z.string().trim().max(500).optional(),
  gstNumber: z.string().trim().toUpperCase().max(20).optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial().refine((d) => Object.keys(d).length > 0, { error: 'No changes provided' });

export const purchaseLineSchema = z
  .object({
    medicineId: objectId,
    batchNumber: z.string().trim().min(1, 'Batch number is required').max(100),
    expiryDate: dateString,
    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
    purchasePriceMinor: minorMoney,
    taxRatePercent: z.number().min(0).max(28).default(0),
  })
  .strict();

export const createPurchaseSchema = z.object({
  supplierId: objectId,
  invoiceNumber: z.string().trim().max(100).optional(),
  purchaseDate: dateString,
  lines: z.array(purchaseLineSchema).min(1, 'At least one line is required').max(100),
});

export const adjustStockSchema = z.object({
  batchId: objectId,
  quantityChange: z.number().int().refine((n) => n !== 0, 'Adjustment cannot be zero'),
  reason: z.string().trim().min(3, 'Reason is required').max(500),
});

export const stockQuerySchema = z.object({
  page: pageNumber,
  limit: pageSize,
  medicineId: objectId.optional(),
  includeDifferent: z.enum(['zero', 'all']).default('all'),
});

export const expiryQuerySchema = z.object({
  withinDays: z.coerce.number().int().min(1).max(365).default(30),
  page: pageNumber,
  limit: pageSize,
  expired: z.enum(['true', 'false']).default('false'),
});

export const billLineSchema = z
  .object({
    medicineId: objectId,
    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
    discountPercent: z.number().min(0).max(100).default(0),
  })
  .strict();

export const createBillSchema = z.object({
  patientId: objectId,
  paymentMethod: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other']).default('cash'),
  lines: z.array(billLineSchema).min(1, 'At least one medicine line is required').max(50),
});

export const billQuerySchema = z.object({
  page: pageNumber,
  limit: pageSize,
  patientId: objectId.optional(),
  billDate: dateString.optional(),
});

export type CreateMedicineInput = z.infer<typeof createMedicineSchema>;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type CreateBillInput = z.infer<typeof createBillSchema>;
