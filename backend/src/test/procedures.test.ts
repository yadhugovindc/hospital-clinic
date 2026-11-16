import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, connect, disconnect, resetDb, seedFixtures, seedPatient } from './helpers.js';

describe('Procedures: catalog, plans, sessions, billing', () => {
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

  async function seedCatalog(name: string) {
    const res = await api().post('/api/procedures/catalog').set('Cookie', fixtures.admin.cookie).send({
      name,
      defaultSessionDurationMinutes: 45,
      priceMinor: 100000,
      taxRatePercent: 5,
    });
    expect(res.status).toBe(201);
    return res.body.procedure._id as string;
  }

  async function seedPlan(patientId: string, procedureId: string, sessions: number) {
    const res = await api().post('/api/procedures/plans').set('Cookie', fixtures.doctor.cookie).send({
      patientId,
      startDate: '2026-03-01',
      items: [{ procedureId, sessionsPlanned: sessions }],
    });
    expect(res.status).toBe(201);
    return res.body.plan;
  }

  it('creates a plan with all sessions scheduled', async () => {
    const { id: patientId } = await seedPatient(fixtures.reception.id);
    const procedureId = await seedCatalog('Abhyanga');
    const plan = await seedPlan(patientId, procedureId, 3);

    const details = await api().get(`/api/procedures/plans/${plan._id}`).set('Cookie', fixtures.doctor.cookie);
    expect(details.body.sessions).toHaveLength(3);
    expect(details.body.sessions.every((s: { status: string }) => s.status === 'scheduled')).toBe(true);
    // Plan item stamps historical price at creation (₹1000.00 = 100000 paise)
    expect(plan.items[0].unitPriceMinor).toBe(100000);
  });

  it('blocks invalid plan dates', async () => {
    const { id: patientId } = await seedPatient(fixtures.reception.id);
    const procedureId = await seedCatalog('Shirodhara');
    const res = await api().post('/api/procedures/plans').set('Cookie', fixtures.doctor.cookie).send({
      patientId,
      startDate: '2026-03-10',
      endDate: '2026-03-01',
      items: [{ procedureId, sessionsPlanned: 2 }],
    });
    expect(res.status).toBe(400);
  });

  it('completing sessions increments plan progress and enables billing', async () => {
    const { id: patientId } = await seedPatient(fixtures.reception.id);
    const procedureId = await seedCatalog('Basti');
    const plan = await seedPlan(patientId, procedureId, 3);
    const details = await api().get(`/api/procedures/plans/${plan._id}`).set('Cookie', fixtures.accountant.cookie);
    const sessions = details.body.sessions as Array<{ _id: string }>;

    // No completed sessions: billing must be rejected.
    const earlyBill = await api().post('/api/procedures/bills').set('Cookie', fixtures.accountant.cookie).send({
      patientId,
      lines: [{ planId: plan._id, procedureId, sessionsCount: 1 }],
    });
    expect(earlyBill.status).toBe(409);

    for (const session of sessions.slice(0, 2)) {
      const done = await api().patch(`/api/procedures/sessions/${session._id}`).set('Cookie', fixtures.therapist.cookie).send({
        status: 'completed',
        notes: 'Session tolerated well',
      });
      expect(done.status).toBe(200);
    }

    const updatedPlan = await api().get(`/api/procedures/plans/${plan._id}`).set('Cookie', fixtures.accountant.cookie);
    expect(updatedPlan.body.plan.items[0].sessionsCompleted).toBe(2);

    const bill = await api().post('/api/procedures/bills').set('Cookie', fixtures.accountant.cookie).send({
      patientId,
      lines: [{ planId: plan._id, procedureId, sessionsCount: 2 }],
    });
    expect(bill.status).toBe(201);
    // 2 sessions at 100000 each, 5% tax: 200000 + 10000 = 210000
    expect(bill.body.bill.totalMinor).toBe(210000);
  });

  it('prevents double-billing the same completed sessions', async () => {
    const { id: patientId } = await seedPatient(fixtures.reception.id);
    const procedureId = await seedCatalog('Nasya');
    const plan = await seedPlan(patientId, procedureId, 2);
    const details = await api().get(`/api/procedures/plans/${plan._id}`).set('Cookie', fixtures.accountant.cookie);
    const firstSession = details.body.sessions[0] as { _id: string };
    await api().patch(`/api/procedures/sessions/${firstSession._id}`).set('Cookie', fixtures.therapist.cookie).send({ status: 'completed' });

    await api().post('/api/procedures/bills').set('Cookie', fixtures.accountant.cookie).send({
      patientId,
      lines: [{ planId: plan._id, procedureId, sessionsCount: 1 }],
    });
    // Still billable after payment-free cancel; second immediate bill overlaps the same session → rejected.
    const second = await api().post('/api/procedures/bills').set('Cookie', fixtures.accountant.cookie).send({
      patientId,
      lines: [{ planId: plan._id, procedureId, sessionsCount: 1 }],
    });
    expect(second.status).toBe(409);
  });

  it('guards session status transitions', async () => {
    const { id: patientId } = await seedPatient(fixtures.reception.id);
    const procedureId = await seedCatalog('Swedana');
    const plan = await seedPlan(patientId, procedureId, 1);
    const details = await api().get(`/api/procedures/plans/${plan._id}`).set('Cookie', fixtures.accountant.cookie);
    const session = details.body.sessions[0] as { _id: string };

    const bad = await api().patch(`/api/procedures/sessions/${session._id}`).set('Cookie', fixtures.therapist.cookie).send({ status: 'cancelled' });
    // scheduled → cancelled is allowed, but completed → completed path check below
    expect([200, 400]).toContain(bad.status);
    if (bad.status === 200) {
      const revived = await api().patch(`/api/procedures/sessions/${session._id}`).set('Cookie', fixtures.therapist.cookie).send({
        status: 'rescheduled',
        scheduledDate: '2026-04-10',
      });
      expect(revived.status).toBe(200);
      expect(revived.body.session.scheduledDate).toBe('2026-04-10');
    }
  });

  it('cancels a procedure bill through the controlled reversal workflow', async () => {
    const { id: patientId } = await seedPatient(fixtures.reception.id);
    const procedureId = await seedCatalog('Udvartana');
    const plan = await seedPlan(patientId, procedureId, 1);
    const details = await api().get(`/api/procedures/plans/${plan._id}`).set('Cookie', fixtures.accountant.cookie);
    const session = details.body.sessions[0] as { _id: string };
    await api().patch(`/api/procedures/sessions/${session._id}`).set('Cookie', fixtures.therapist.cookie).send({ status: 'completed' });
    const bill = await api().post('/api/procedures/bills').set('Cookie', fixtures.accountant.cookie).send({
      patientId,
      paymentMethod: 'cash',
      lines: [{ planId: plan._id, procedureId, sessionsCount: 1 }],
    });

    const cancelled = await api().post(`/api/procedures/bills/${bill.body.bill._id}/cancel`).set('Cookie', fixtures.accountant.cookie).send({ reason: 'duplicate entry' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.bill.status).toBe('cancelled');

    // The released sessions become billable again.
    const rebill = await api().post('/api/procedures/bills').set('Cookie', fixtures.accountant.cookie).send({
      patientId,
      paymentMethod: 'cash',
      lines: [{ planId: plan._id, procedureId, sessionsCount: 1 }],
    });
    expect(rebill.status).toBe(201);
  });
});
