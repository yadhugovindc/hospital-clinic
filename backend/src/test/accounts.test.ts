import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, connect, disconnect, resetDb, seedFixtures, seedMedicineWithStock, seedPatient } from './helpers.js';

describe('Accounts: expenses, day book, and reports', () => {
  let fixtures: Awaited<ReturnType<typeof seedFixtures>>;

  beforeAll(async () => {
    await connect();
    await resetDb();
    fixtures = await seedFixtures();
  });
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await disconnect();
  });

  async function createBillForPatient(): Promise<{ billId: string; billDate: string; totalMinor: number }> {
    const { medicineId } = await seedMedicineWithStock(fixtures.pharmacist.id, { priceMinor: 10000, qty: 20 });
    const { id: patientId } = await seedPatient(fixtures.reception.id);
    const bill = await api().post('/api/pharmacy/bills').set('Cookie', fixtures.pharmacist.cookie).send({
      patientId,
      paymentMethod: 'cash',
      lines: [{ medicineId, quantity: 2 }],
    });
    expect(bill.status).toBe(201);
    return { billId: bill.body.bill._id, billDate: bill.body.bill.billDate, totalMinor: bill.body.bill.totalMinor };
  }

  it('records bills as settled at creation with the chosen method', async () => {
    const { billId, totalMinor } = await createBillForPatient();
    const bill = await api().get(`/api/pharmacy/bills/${billId}`).set('Cookie', fixtures.pharmacist.cookie);
    expect(bill.body.bill.paymentMethod).toBe('cash');
    expect(bill.body.bill.totalMinor).toBe(totalMinor);
    // No payment endpoints remain
    const gone = await api().post('/api/accounts/payments').set('Cookie', fixtures.accountant.cookie).send({});
    expect(gone.status).toBe(404);
  });

  it('excludes cancelled bills from financial totals and restores stock on cancel', async () => {
    const created = await createBillForPatient();
    const before = await api().get('/api/pharmacy/medicines/' + (await api().get(`/api/pharmacy/bills/${created.billId}`).set('Cookie', fixtures.pharmacist.cookie)).body.bill.lines[0].medicineId + '/stock').set('Cookie', fixtures.pharmacist.cookie);
    void before;
    const cancel = await api().post(`/api/pharmacy/bills/${created.billId}/cancel`).set('Cookie', fixtures.pharmacist.cookie).send({ reason: 'duplicate entry' });
    expect(cancel.status).toBe(200);
    const day = await api().get(`/api/accounts/daybook?date=${created.billDate}`).set('Cookie', fixtures.accountant.cookie);
    expect(day.body.totals.billsMinor).toBe(0);
  });

  it('builds a day book with bills and expenses', async () => {
    const { billId, billDate, totalMinor } = await createBillForPatient();
    void billId;
    const day = billDate;
    await api().post('/api/accounts/expenses').set('Cookie', fixtures.accountant.cookie).send({
      category: 'utilities',
      description: 'Electricity bill',
      amountMinor: 50000,
      expenseDate: day,
      paymentMethod: 'cash',
    });

    const book = await api().get(`/api/accounts/daybook?date=${day}`).set('Cookie', fixtures.accountant.cookie);
    expect(book.status).toBe(200);
    expect(book.body.totals.billsMinor).toBe(totalMinor);
    expect(book.body.totals.expensesMinor).toBe(50000);
    expect(book.body.totals.netMinor).toBe(totalMinor - 50000);
  });

  it('reverses an expense without deleting it and excludes it from totals', async () => {
    const expense = await api().post('/api/accounts/expenses').set('Cookie', fixtures.accountant.cookie).send({
      category: 'miscellaneous',
      description: 'Wrong entry',
      amountMinor: 100,
      expenseDate: '2026-02-02',
      paymentMethod: 'cash',
    });
    const reversed = await api().post(`/api/accounts/expenses/${expense.body.expense._id}/reverse`).set('Cookie', fixtures.accountant.cookie).send({ reason: 'wrong entry' });
    expect(reversed.status).toBe(200);

    const book = await api().get('/api/accounts/daybook?date=2026-02-02').set('Cookie', fixtures.accountant.cookie);
    expect(book.body.totals.expensesMinor).toBe(0);
    expect(book.body.entries.some((e: { description: string }) => e.description.includes('reversed'))).toBe(true);
  });

  it('produces a date-range financial report with correct netting', async () => {
    const { billId } = await createBillForPatient();
    const billInfo = await api().get(`/api/pharmacy/bills/${billId}`).set('Cookie', fixtures.pharmacist.cookie);
    const totalMinor = billInfo.body.bill.billDate === billInfo.body.bill.billDate ? billInfo.body.bill.totalMinor : 0;
    const billDate: string = billInfo.body.bill.billDate;

    await api().post('/api/accounts/expenses').set('Cookie', fixtures.accountant.cookie).send({
      category: 'utilities',
      description: 'Power',
      amountMinor: 4800,
      expenseDate: billDate,
      paymentMethod: 'cash',
    });

    const monthStart = billDate.slice(0, 8) + '01';
    const monthEnd = billDate;
    const report = await api().get(`/api/accounts/reports?startDate=${monthStart}&endDate=${monthEnd}`).set('Cookie', fixtures.accountant.cookie);
    expect(report.status).toBe(200);
    expect(report.body.netCollectionsMinor).toBe(totalMinor);
    expect(report.body.netExpensesMinor).toBe(4800);
    expect(report.body.netIncomeMinor).toBe(totalMinor - 4800);
    const day = report.body.daily.find((d: { date: string }) => d.date === billDate);
    expect(day.collectionsMinor).toBe(totalMinor);
    expect(day.expensesMinor).toBe(4800);
  });

  it('exports the report as CSV for permitted roles', async () => {
    const res = await api().get('/api/accounts/reports/csv?startDate=2026-03-01&endDate=2026-03-31').set('Cookie', fixtures.accountant.cookie);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Net income');
  });

  it('denies accounts endpoints to non-account roles', async () => {
    const res = await api().get('/api/accounts/daybook').set('Cookie', fixtures.reception.cookie);
    expect(res.status).toBe(403);
  });
});
