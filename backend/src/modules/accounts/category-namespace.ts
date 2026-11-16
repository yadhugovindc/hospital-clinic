import { z } from 'zod';
import type { ExpenseCategory } from '../../database/models/expense.model.js';

export const EXPENSE_CATEGORIES = [
  'salary',
  'rent',
  'utilities',
  'purchase',
  'maintenance',
  'marketing',
  'miscellaneous',
  'other',
] as const satisfies readonly ExpenseCategory[];

export const EXPENSE_CATEGORIES_NAMESPACE = z.enum(EXPENSE_CATEGORIES);
