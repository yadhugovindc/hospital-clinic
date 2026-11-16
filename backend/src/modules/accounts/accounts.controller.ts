import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { getUser } from '../../shared/middleware/auth.js';
import { query, strParam } from '../../shared/utils/request-helpers.js';
import * as expenseService from './expense.service.js';
import * as daybookService from './daybook.service.js';
import type { CreateExpenseInput } from './accounts.validation.js';
import { getSettings } from '../clinic-settings/clinic.service.js';
import { clinicToday } from '../../shared/utils/date.js';

export const createExpenseHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const expense = await expenseService.createExpense(req.body as CreateExpenseInput, actor);
  res.status(201).json({ expense });
});

export const listExpensesHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = query<{
    page: number;
    limit: number;
    expenseDate?: string;
    category?: import('../../database/models/expense.model.js').ExpenseCategory;
  }>(req);
  res.json(await expenseService.listExpenses(q));
});

export const reverseExpenseHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const { reason } = req.body as { reason: string };
  const expense = await expenseService.reverseExpense(strParam(req, 'id'), reason, actor);
  res.json({ expense });
});

export const dayBookHandler = asyncHandler(async (req: Request, res: Response) => {
  const { date } = query<{ date?: string }>(req);
  res.json(await daybookService.getDayBook(date));
});

export const reportHandler = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = query<{ startDate: string; endDate: string }>(req);
  res.json(await daybookService.getFinancialReport(startDate, endDate));
});

/** CSV export for a date-range report (permitted reports only). */
export const reportCsvHandler = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = query<{ startDate: string; endDate: string }>(req);
  const report = await daybookService.getFinancialReport(startDate, endDate);

  const esc = (value: string | number): string => {
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const fmt = (amountMinor: number, currency: string): string => (amountMinor / 100).toFixed(2) + ' ' + currency;

  const settings = await getSettings();
  const today = clinicToday(settings.timezone);
  const currency = settings.currency;

  const lines: string[] = [
    'Date,Collections (net),Expenses (net),Net',
    ...report.daily.map((d) =>
      [d.date, fmt(d.collectionsMinor, currency), fmt(d.expensesMinor, currency), fmt(d.collectionsMinor - d.expensesMinor, currency)]
        .map(esc)
        .join(','),
    ),
    '',
    'Section,Detail,Amount',
    ...report.collections.map((p) => ['Bill', esc(p.kind), fmt(p.amountMinor, currency)].join(',')),
    ...report.expenses.map((e) => ['Expense', esc(e.category), fmt(e.amountMinor, currency)].join(',')),
    ['Summary', 'Net collections', fmt(report.netCollectionsMinor, currency)].join(','),
    ['Summary', 'Net expenses', fmt(report.netExpensesMinor, currency)].join(','),
    ['Summary', 'Net income', fmt(report.netIncomeMinor, currency)].join(','),
  ];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="financial-report-${startDate}_to_${endDate}-${today}.csv"`);
  res.send('﻿' + lines.join('\r\n'));
});
