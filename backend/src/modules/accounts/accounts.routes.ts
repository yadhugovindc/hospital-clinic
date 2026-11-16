import { asyncHandler } from '../../shared/utils/async-handler.js';
import { getUser } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { guard } from '../../shared/middleware/auth.js';
import { Router } from 'express';
import {
  createExpenseHandler,
  dayBookHandler,
  listExpensesHandler,
  reportCsvHandler,
  reportHandler,
  reverseExpenseHandler,
} from './accounts.controller.js';
import {
  createExpenseSchema,
  daybookSchema,
  expenseListSchema,
  reverseExpenseSchema,
  dateRangeSchema,
} from './accounts.validation.js';

export const accountsRouter = Router();

// Expenses
accountsRouter.post('/expenses', guard('accounts:write'), validate(createExpenseSchema), asyncHandler(createExpenseHandler));
accountsRouter.get('/expenses', guard('accounts:read'), validate(expenseListSchema, 'query'), asyncHandler(listExpensesHandler));
accountsRouter.post('/expenses/:id/reverse', guard('accounts:write'), validate(reverseExpenseSchema), asyncHandler(reverseExpenseHandler));

// Day book / reports
accountsRouter.get('/daybook', guard('accounts:read'), validate(daybookSchema, 'query'), asyncHandler(dayBookHandler));
accountsRouter.get('/reports', guard('reports:read'), validate(dateRangeSchema, 'query'), asyncHandler(reportHandler));
accountsRouter.get('/reports/csv', guard('reports:read'), validate(dateRangeSchema, 'query'), asyncHandler(reportCsvHandler));

void getUser;
