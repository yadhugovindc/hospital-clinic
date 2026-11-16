import { Types } from 'mongoose';
import { Expense, type ExpenseCategory, type ExpenseDoc } from '../../database/models/expense.model.js';
import { recordAudit } from '../../database/models/audit-log.model.js';
import { nextDocumentNumber } from '../shared/numbering.service.js';
import { getSettings } from '../clinic-settings/clinic.service.js';
import { clinicToday, isValidBusinessDate } from '../../shared/utils/date.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/api-error.js';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'salary', 'rent', 'utilities', 'purchase', 'maintenance', 'marketing', 'miscellaneous', 'other',
];

export interface ExpenseInput {
  category: ExpenseCategory;
  description: string;
  amountMinor: number;
  expenseDate: string;
  paymentMethod: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque' | 'other';
  reference?: string;
}

export async function createExpense(input: ExpenseInput, actor: { id: string; email: string }): Promise<ExpenseDoc> {
  if (!EXPENSE_CATEGORIES.includes(input.category)) throw new BadRequestError('Invalid expense category');
  if (input.amountMinor <= 0) throw new BadRequestError('Expense amount must be positive');
  if (!isValidBusinessDate(input.expenseDate)) throw new BadRequestError('Invalid expense date');

  const expenseNumber = await nextDocumentNumber('expense', input.expenseDate);
  const expense = await Expense.create({
    ...input,
    description: input.description.trim(),
    expenseNumber,
    recordedBy: new Types.ObjectId(actor.id),
  });

  recordAudit({
    actorId: new Types.ObjectId(actor.id) as never,
    actorEmail: actor.email,
    action: 'expense.create',
    entityType: 'Expense',
    entityId: String(expense._id),
    after: { expenseNumber, category: input.category, amountMinor: input.amountMinor },
  } as never);

  return expense;
}

export async function listExpenses(q: { page: number; limit: number; expenseDate?: string; category?: ExpenseCategory }): Promise<{
  expenses: ExpenseDoc[];
  total: number;
  page: number;
  limit: number;
}> {
  const filter: Record<string, unknown> = {};
  if (q.expenseDate) filter.expenseDate = q.expenseDate;
  if (q.category) filter.category = q.category;
  const [expenses, total] = await Promise.all([
    Expense.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).populate('recordedBy', 'name'),
    Expense.countDocuments(filter),
  ]);
  return { expenses, total, page: q.page, limit: q.limit };
}

/**
 * Reversal workflow: expenses are never deleted or edited. A reversal stamps
 * reversedBy/reversalReason, and the day book excludes reversed expenses.
 */
export async function reverseExpense(id: string, reason: string, actor: { id: string; email: string }): Promise<ExpenseDoc> {
  const expense = await Expense.findById(id);
  if (!expense) throw new NotFoundError('Expense not found');
  if (expense.reversedBy) throw new BadRequestError('Expense is already reversed');
  if (reason.trim().length < 3) throw new BadRequestError('A reversal reason is required');

  expense.reversedBy = new Types.ObjectId(actor.id);
  expense.reversalReason = reason.trim().slice(0, 500);
  await expense.save();

  recordAudit({
    actorId: new Types.ObjectId(actor.id) as never,
    actorEmail: actor.email,
    action: 'expense.reverse',
    entityType: 'Expense',
    entityId: String(expense._id),
    after: { reason },
  } as never);

  return expense;
}

export async function todayExpenseTotal(): Promise<{ date: string; totalMinor: number }> {
  const settings = await getSettings();
  const today = clinicToday(settings.timezone);
  const agg = await Expense.aggregate<{ total: number }>([
    { $match: { expenseDate: today, reversedBy: { $exists: false } } },
    { $group: { _id: null, total: { $sum: '$amountMinor' } } },
  ]);
  return { date: today, totalMinor: agg[0]?.total ?? 0 };
}
