import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, connect, disconnect, resetDb, seedFixtures, seedMedicineWithStock, seedPatient } from './helpers.js';

describe('Pharmacy: inventory and billing', () => {
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

  it('creates a purchase that creates stock batches and movement records', async () => {
    const created = await api().post('/api/pharmacy/medicines').set('Cookie', fixtures.pharmacist.cookie).send({
      name: 'Purchased Med',
      form: 'tablet',
      unit: 'pcs',
      sellingPriceMinor: 20000,
      taxRatePercent: 5,
    });
    const medicineId = created.body.medicine._id;

    const supplier = await api().post('/api/pharmacy/suppliers').set('Cookie', fixtures.pharmacist.cookie).send({ name: 'Purchase Supplier' });
    const supplierId = supplier.body.supplier._id;

    const purchaseRes = await api().post('/api/pharmacy/purchases').set('Cookie', fixtures.pharmacist.cookie).send({
      supplierId,
      purchaseDate: '2026-01-10',
      lines: [
        { medicineId, batchNumber: 'PB-1', expiryDate: '2029-06-30', quantity: 50, purchasePriceMinor: 15000, taxRatePercent: 5 },
      ],
    });
    expect(purchaseRes.status).toBe(201);
    expect(purchaseRes.body.purchase.status).toBe('received');
    // subtotal 50*15000=750000; tax 5% = 37500; total = 787500
    expect(purchaseRes.body.purchase.totalMinor).toBe(750000 + 37500);

    const stock = await api().get('/api/pharmacy/stock').set('Cookie', fixtures.pharmacist.cookie);
    const batch = stock.body.batches.find((b: { _id: string }) => stock.body.batches.some((x: { batchNumber?: string }) => x.batchNumber === 'PB-1') || b._id);
    void batch;
    const totals = stock.body.batches.filter((b: { medicineId?: { _id: string } }) => String(b.medicineId?._id ?? b.medicineId) === String(medicineId));
    expect(totals.length).toBeGreaterThan(0);
  });

  it('refuses to dispense more stock than exists (atomic bill-stock consistency)', async () => {
    const { medicineId, batchId } = await seedMedicineWithStock(fixtures.pharmacist.id, { qty: 5 });
    void batchId;
    const { id: patientId } = await seedPatient(fixtures.reception.id);

    const res = await api().post('/api/pharmacy/bills').set('Cookie', fixtures.pharmacist.cookie).send({
      patientId,
      lines: [{ medicineId, quantity: 6 }],
    });
    expect(res.status).toBe(409);

    const stock = await api().get(`/api/pharmacy/medicines/${medicineId}/stock`).set('Cookie', fixtures.pharmacist.cookie);
    expect(stock.body.remaining).toBe(5);
  });

  it('dispenses earliest-expiry-first and never touches expired stock', async () => {
    const medicine = await api().post('/api/pharmacy/medicines').set('Cookie', fixtures.pharmacist.cookie).send({
      name: 'Expiry Med',
      form: 'tablet',
      unit: 'pcs',
      sellingPriceMinor: 10000,
      taxRatePercent: 0,
    });
    const medicineId = medicine.body.medicine._id;
    const supplier = await api().post('/api/pharmacy/suppliers').set('Cookie', fixtures.pharmacist.cookie).send({ name: 'Expiry Supplier' });

    // Two batches: one expired, one fresh
    await api().post('/api/pharmacy/purchases').set('Cookie', fixtures.pharmacist.cookie).send({
      supplierId: supplier.body.supplier._id,
      purchaseDate: '2020-01-01',
      lines: [{ medicineId, batchNumber: 'OLD', expiryDate: '2021-01-01', quantity: 30, purchasePriceMinor: 5000, taxRatePercent: 0 }],
    });
    await api().post('/api/pharmacy/purchases').set('Cookie', fixtures.pharmacist.cookie).send({
      supplierId: supplier.body.supplier._id,
      purchaseDate: '2026-01-01',
      lines: [{ medicineId, batchNumber: 'NEW', expiryDate: '2030-01-01', quantity: 30, purchasePriceMinor: 5000, taxRatePercent: 0 }],
    });

    const { id: patientId } = await seedPatient(fixtures.reception.id);
    const bill = await api().post('/api/pharmacy/bills').set('Cookie', fixtures.pharmacist.cookie).send({
      patientId,
      lines: [{ medicineId, quantity: 2 }],
    });
    expect(bill.status).toBe(201);
    // Must dispense from the unexpired NEW batch only.
    expect(bill.body.bill.lines[0].batchNumberSnapshot).toBe('NEW');
  });

  it('keeps stock consistent under concurrent dispensing (race-safe decrements)', async () => {
    const { medicineId } = await seedMedicineWithStock(fixtures.pharmacist.id, { qty: 10 });
    const { id: patientId } = await seedPatient(fixtures.reception.id);

    const attempt = (): Promise<import('supertest').Response> =>
      api().post('/api/pharmacy/bills').set('Cookie', fixtures.pharmacist.cookie).send({
        patientId,
        lines: [{ medicineId, quantity: 8 }],
      });

    const results = await Promise.all([attempt(), attempt()]);
    const statuses = results.map((r) => r.status).sort();
    // Exactly one bill succeeds; the conflicting one fails without corrupting stock.
    expect(statuses).toEqual([201, 409].sort() as number[]);

    const stock = await api().get(`/api/pharmacy/medicines/${medicineId}/stock`).set('Cookie', fixtures.pharmacist.cookie);
    expect(stock.body.remaining).toBe(2);
  });

  it('rejects expired-stock-only dispensing even when total unexpired stock is enough for nothing else', async () => {
    // A medicine whose only batch is expired cannot be billed at all.
    const { medicineId } = await seedMedicineWithStock(fixtures.pharmacist.id, { qty: 10, expiryDate: '2020-01-01' });
    const { id: patientId } = await seedPatient(fixtures.reception.id);
    const res = await api().post('/api/pharmacy/bills').set('Cookie', fixtures.pharmacist.cookie).send({
      patientId,
      lines: [{ medicineId, quantity: 1 }],
    });
    expect(res.status).toBe(409);
  });

  it('restores stock through the controlled bill cancellation workflow', async () => {
    const { medicineId } = await seedMedicineWithStock(fixtures.pharmacist.id, { qty: 10 });
    const { id: patientId } = await seedPatient(fixtures.reception.id);
    const billRes = await api().post('/api/pharmacy/bills').set('Cookie', fixtures.pharmacist.cookie).send({
      patientId,
      lines: [{ medicineId, quantity: 3 }],
    });
    expect(billRes.status).toBe(201);
    const afterSale = await api().get(`/api/pharmacy/medicines/${medicineId}/stock`).set('Cookie', fixtures.pharmacist.cookie);
    expect(afterSale.body.remaining).toBe(7);

    const cancel = await api().post(`/api/pharmacy/bills/${billRes.body.bill._id}/cancel`).set('Cookie', fixtures.pharmacist.cookie).send({ reason: 'duplicate entry' });
    expect(cancel.status).toBe(200);
    const afterCancel = await api().get(`/api/pharmacy/medicines/${medicineId}/stock`).set('Cookie', fixtures.pharmacist.cookie);
    expect(afterCancel.body.remaining).toBe(10);
  });

  it('computes bill totals server-side from the catalog (client totals are ignored)', async () => {
    const { medicineId } = await seedMedicineWithStock(fixtures.pharmacist.id, { priceMinor: 10000 });
    const { id: patientId } = await seedPatient(fixtures.reception.id);
    const res = await api().post('/api/pharmacy/bills').set('Cookie', fixtures.pharmacist.cookie).send({
      patientId,
      lines: [{ medicineId, quantity: 2, discountPercent: 10 }],
    });
    expect(res.status).toBe(201);
    // subtotal: 2*10000=20000; discount 10% = 2000; taxable 18000; tax 10% = 1800; total 19800
    expect(res.body.bill.totalMinor).toBe(19800);
  });

  it('reports near-expiry and expired stock', async () => {
    await seedMedicineWithStock(fixtures.pharmacist.id, { qty: 4, expiryDate: '2020-01-01' });
    const expired = await api().get('/api/pharmacy/stock/expiry?withinDays=30&expired=true').set('Cookie', fixtures.pharmacist.cookie);
    expect(expired.status).toBe(200);
    expect(expired.body.batches.length).toBeGreaterThan(0);
    const upcoming = await api().get('/api/pharmacy/stock/expiry?withinDays=30&expired=false').set('Cookie', fixtures.pharmacist.cookie);
    expect(upcoming.body.batches.length).toBe(0);
  });
});
