import { z } from 'zod';
import { dateString, pageNumber, pageSize } from '../../shared/validation/schemas.js';
import { EXPENSE_CATEGORIES_NAMESPACE } from './category-namespace.js';

export const paymentMethodEnum = z.enum(['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other']);

export const createExpenseSchema = z.object({
  category: EXPENSE_CATEGORIES_NAMESPACE,
  description: z.string().trim().min(3, 'Description is required').max(500),
  amountMinor: z.number().int().positive('Amount must be positive'),
  expenseDate: dateString,
  paymentMethod: paymentMethodEnum,
  reference: z.string().trim().max(200).optional(),
});

export const expenseListSchema = z.object({
  page: pageNumber,
  limit: pageSize,
  expenseDate: dateString.optional(),
  category: EXPENSE_CATEGORIES_NAMESPACE.optional(),
});

export const reverseExpenseSchema = z.object({
  reason: z.string().trim().min(3, 'Reason is required').max(500),
});

export const dateRangeSchema = z
  .object({
    startDate: dateString,
    endDate: dateString,
  })
  .superRefine((val, ctx) => {
    if (val.endDate < val.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must not precede start date' });
    }
  });

export const daybookSchema = z.object({ date: dateString.optional() });

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
