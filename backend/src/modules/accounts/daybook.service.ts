import { PharmacyBill } from '../../database/models/pharmacy-bill.model.js';
import { ProcedureBill } from '../../database/models/procedure-models.js';
import { Expense } from '../../database/models/expense.model.js';
import { getSettings } from '../clinic-settings/clinic.service.js';
import { clinicToday, isValidBusinessDate } from '../../shared/utils/date.js';
import { BadRequestError } from '../../shared/errors/api-error.js';

export interface DayBookEntry {
  kind: 'bill' | 'expense';
  number: string;
  description: string;
  method: string;
  amountMinor: number; // signed from the clinic's cash perspective
  createdAt: Date;
}

export interface DayBook {
  date: string;
  entries: DayBookEntry[];
  totals: {
    billsMinor: number;
    expensesMinor: number;
    netMinor: number;
    byMethod: Record<string, number>;
  };
}

/**
 * Builds the day book for one business date from finalized bills (recorded as
 * settled at creation) and non-reversed expenses. Reversed expenses and
 * cancelled bills are excluded from totals.
 */
export async function getDayBook(dateInput?: string): Promise<DayBook> {
  const settings = await getSettings();
  const date = dateInput ?? clinicToday(settings.timezone);
  if (!isValidBusinessDate(date)) throw new BadRequestError('Invalid day book date');

  const [pharmacyBills, procedureBills, expenses] = await Promise.all([
    PharmacyBill.find({ billDate: date, status: 'finalized' }).sort({ createdAt: 1 }),
    ProcedureBill.find({ billDate: date, status: 'finalized' }).sort({ createdAt: 1 }),
    Expense.find({ expenseDate: date }).sort({ createdAt: 1 }),
  ]);

  const entries: DayBookEntry[] = [];
  let billsTotal = 0;
  let expensesTotal = 0;
  const byMethod: Record<string, number> = {};

  interface BillRow { billNumber: string; totalMinor: number; paymentMethod: string; createdAt: Date; source: 'pharmacy' | 'procedure' }
  const tagged: BillRow[] = [
    ...pharmacyBills.map((b): BillRow => ({ billNumber: b.billNumber, totalMinor: b.totalMinor, paymentMethod: b.paymentMethod, createdAt: b.createdAt, source: 'pharmacy' })),
    ...procedureBills.map((b): BillRow => ({ billNumber: b.billNumber, totalMinor: b.totalMinor, paymentMethod: b.paymentMethod, createdAt: b.createdAt, source: 'procedure' })),
  ].sort((a, c) => a.createdAt.getTime() - c.createdAt.getTime());

  for (const b of tagged) {
    const method = b.paymentMethod;
    entries.push({
      kind: 'bill',
      number: b.billNumber,
      description: `${b.source === 'pharmacy' ? 'Pharmacy' : 'Procedure'} bill ${b.billNumber}`,
      method,
      amountMinor: b.totalMinor,
      createdAt: b.createdAt,
    });
    billsTotal += b.totalMinor;
    byMethod[method] = (byMethod[method] ?? 0) + b.totalMinor;
  }

  for (const e of expenses) {
    const reversed = Boolean(e.reversedBy);
    entries.push({
      kind: 'expense',
      number: e.expenseNumber,
      description: `${e.category.replace(/_/g, ' ')} — ${e.description}${reversed ? ' (reversed — excluded from totals)' : ''}`,
      method: e.paymentMethod,
      amountMinor: reversed ? 0 : -e.amountMinor,
      createdAt: e.createdAt,
    });
    if (!reversed) expensesTotal += e.amountMinor;
  }

  return {
    date,
    entries,
    totals: {
      billsMinor: billsTotal,
      expensesMinor: expensesTotal,
      netMinor: billsTotal - expensesTotal,
      byMethod,
    },
  };
}

export interface FinancialReport {
  startDate: string;
  endDate: string;
  collections: { kind: string; amountMinor: number; count: number }[];
  netCollectionsMinor: number;
  expenses: { category: string; amountMinor: number; count: number }[];
  netExpensesMinor: number;
  netIncomeMinor: number;
  daily: { date: string; collectionsMinor: number; expensesMinor: number }[];
}

/** Date-range financial report over bills and expenses. */
export async function getFinancialReport(startDate: string, endDate: string): Promise<FinancialReport> {
  if (!isValidBusinessDate(startDate) || !isValidBusinessDate(endDate)) {
    throw new BadRequestError('Invalid report date range');
  }
  if (endDate < startDate) throw new BadRequestError('End date must not precede start date');

  const expenseMatch = { expenseDate: { $gte: startDate, $lte: endDate }, reversedBy: { $exists: false } };

  const [dailyExpenses, collectionsByType, expensesByCategory] = await Promise.all([
    Expense.aggregate([
      { $match: expenseMatch },
      { $group: { _id: '$expenseDate', amount: { $sum: '$amountMinor' } } },
      { $sort: { _id: 1 } },
    ]),
    Promise.all([
      PharmacyBill.aggregate([
        { $match: { billDate: { $gte: startDate, $lte: endDate }, status: 'finalized' } },
        { $group: { _id: null, amount: { $sum: '$totalMinor' }, count: { $sum: 1 } } },
      ]),
      ProcedureBill.aggregate([
        { $match: { billDate: { $gte: startDate, $lte: endDate }, status: 'finalized' } },
        { $group: { _id: null, amount: { $sum: '$totalMinor' }, count: { $sum: 1 } } },
      ]),
    ]),
    Expense.aggregate([
      { $match: expenseMatch },
      { $group: { _id: '$category', amount: { $sum: '$amountMinor' }, count: { $sum: 1 } } },
    ]),
  ]);

  const pharmacyTotal = collectionsByType[0]?.[0]?.amount ?? 0;
  const procedureTotal = collectionsByType[1]?.[0]?.amount ?? 0;
  const pharmacyCount = collectionsByType[0]?.[0]?.count ?? 0;
  const procedureCount = collectionsByType[1]?.[0]?.count ?? 0;

  const collections = [
    { kind: 'pharmacy_bill', amountMinor: pharmacyTotal, count: pharmacyCount },
    { kind: 'procedure_bill', amountMinor: procedureTotal, count: procedureCount },
  ].filter((c) => c.count > 0);

  const expenses = (expensesByCategory as { _id: string; amount: number; count: number }[]).map((r) => ({
    category: r._id,
    amountMinor: r.amount,
    count: r.count,
  }));

  const netCollections = pharmacyTotal + procedureTotal;
  const netExpenses = expenses.reduce((s, r) => s + r.amountMinor, 0);

  const dailyMap = new Map<string, { date: string; collectionsMinor: number; expensesMinor: number }>();
  for (const billType of [0, 1] as const) {
    for (const row of (await collectionsByDate(billType, startDate, endDate)) as { _id: string; amount: number }[]) {
      const entry = dailyMap.get(row._id) ?? { date: row._id, collectionsMinor: 0, expensesMinor: 0 };
      entry.collectionsMinor += row.amount;
      dailyMap.set(row._id, entry);
    }
  }
  for (const row of dailyExpenses as { _id: string; amount: number }[]) {
    const entry = dailyMap.get(row._id) ?? { date: row._id, collectionsMinor: 0, expensesMinor: 0 };
    entry.expensesMinor = row.amount;
    dailyMap.set(row._id, entry);
  }

  return {
    startDate,
    endDate,
    collections,
    netCollectionsMinor: netCollections,
    expenses,
    netExpensesMinor: netExpenses,
    netIncomeMinor: netCollections - netExpenses,
    daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

async function collectionsByDate(which: 0 | 1, startDate: string, endDate: string): Promise<{ _id: string; amount: number }[]> {
  const Model = which === 0 ? PharmacyBill : ProcedureBill;
  return Model.aggregate([
    { $match: { billDate: { $gte: startDate, $lte: endDate }, status: 'finalized' } },
    { $group: { _id: '$billDate', amount: { $sum: '$totalMinor' } } },
    { $sort: { _id: 1 } },
  ]);
}

export async function todayCollections(): Promise<{ date: string; netMinor: number }> {
  const book = await getDayBook();
  return { date: book.date, netMinor: book.totals.netMinor };
}
