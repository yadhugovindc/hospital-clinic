import { z } from 'zod';

/**
 * A money amount in minor currency units (paise). Must be a non-negative safe integer.
 */
export const minorMoney = z
  .number({ error: 'Amount must be a number' })
  .int('Amount must be an integer number of minor units (paise)')
  .nonnegative('Amount must not be negative');

/** Non-negative integer, e.g. quantities. */
export const nonNegInt = z.number({ error: 'Quantity must be a number' }).int('Quantity must be an integer').nonnegative('Quantity must not be negative');

/** Positive integer */
export const posInt = z.number({ error: 'Value must be a number' }).int('Value must be an integer').positive('Value must be positive');

export const objectId = z
  .string({ error: 'Id is required' })
  .regex(/^[a-fA-F0-9]{24}$/, 'Not a valid MongoDB ObjectId');

export const dateString = z
  .string({ error: 'Date is required' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export const pageNumber = z.coerce.number().int().positive().default(1);
export const pageSize = z.coerce.number().int().positive().max(200).default(20);

export const phone = z
  .string({ error: 'Phone number is required' })
  .trim()
  .regex(/^[+]?[\d][\d\s-]{5,19}$/, 'Phone number is not valid');

export const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Email is not valid')
  .max(200);

export const gender = z.enum(['male', 'female', 'other'], { error: 'Gender is required' });

export const password = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

export const paginatedQuery = z.object({
  page: pageNumber,
  limit: pageSize,
});

export const idParams = z.object({ id: objectId });
