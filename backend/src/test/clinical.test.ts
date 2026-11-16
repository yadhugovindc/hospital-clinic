import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, connect, disconnect, resetDb, seedFixtures, seedPatient } from './helpers.js';

describe('Clinical: visits and prescriptions', () => {
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

  it('creates and completes a visit, moving the linked token', async () => {
    const { id: patientId } = await seedPatient(fixtures.reception.id);
    const token = await api().post('/api/reception/tokens').set('Cookie', fixtures.reception.cookie).send({ patientId });
    const tokenId = token.body.token._id;

    const visit = await api().post('/api/doctor/visits').set('Cookie', fixtures.doctor.cookie).send({
      patientId,
      tokenId,
      chiefComplaints: 'Headache, insomnia',
      vitals: { bpSystolic: 120, bpDiastolic: 80, pulseBpm: 72 },
      diagnosis: 'Vata vyadhi (nervous disorder)',
    });
    expect(visit.status).toBe(201);
    expect(visit.body.visit.status).toBe('open');
    expect(visit.body.visit.doctorId).toBe(fixtures.doctor.id);

    const tokenAfter = await api().get('/api/reception/tokens').set('Cookie', fixtures.reception.cookie);
    const linked = tokenAfter.body.tokens.find((t: { _id: string }) => t._id === tokenId);
    expect(linked.status).toBe('in_consultation');

    const complete = await api().patch(`/api/doctor/visits/${visit.body.visit._id}`).set('Cookie', fixtures.doctor.cookie).send({
      status: 'completed',
      followUpDate: '2026-04-01',
    });
    expect(complete.status).toBe(200);
    expect(complete.body.visit.status).toBe('completed');
  });

  it("blocks doctors from accessing another doctor's visit", async () => {
    const { id: patientId } = await seedPatient(fixtures.reception.id);
    const visit = await api().post('/api/doctor/visits').set('Cookie', fixtures.doctor.cookie).send({ patientId });

    await api().post('/api/users').set('Cookie', fixtures.admin.cookie).send({
      email: 'doctor2@clinical.test',
      name: 'Doctor 2',
      password: 'Password!23',
      role: 'doctor',
    });
    const login = await api().post('/api/auth/login').send({ email: 'doctor2@clinical.test', password: 'Password!23' });
    const otherCookie = (login.headers['set-cookie'] ?? []) as string[];

    const denied = await api().get(`/api/doctor/visits/${visit.body.visit._id}`).set('Cookie', otherCookie);
    expect(denied.status).toBe(403);
  });

  it('prevents receptionists from reading clinical narratives', async () => {
    const { id: patientId } = await seedPatient(fixtures.reception.id);
    await api().post('/api/doctor/visits').set('Cookie', fixtures.doctor.cookie).send({
      patientId,
      clinicalNotes: 'Private clinical note',
    });
    const res = await api().get(`/api/doctor/patients/${patientId}/history`).set('Cookie', fixtures.reception.cookie);
    expect(res.status).toBe(403);
  });

  it('validates prescription medicines against the catalog and stores snapshots', async () => {
    const { id: patientId } = await seedPatient(fixtures.reception.id);
    const visit = await api().post('/api/doctor/visits').set('Cookie', fixtures.doctor.cookie).send({ patientId });
    const visitId = visit.body.visit._id;

    const bad = await api().post(`/api/doctor/visits/${visitId}/prescriptions`).set('Cookie', fixtures.doctor.cookie).send({
      visitId,
      items: [{ medicineId: '000000000000000000000000', frequency: 'twice daily' }],
    });
    expect(bad.status).toBe(400);

    const med = await api().post('/api/pharmacy/medicines').set('Cookie', fixtures.pharmacist.cookie).send({
      name: 'Rx Med',
      form: 'tablet',
      unit: 'pcs',
      sellingPriceMinor: 10000,
    });
    const ok = await api().post(`/api/doctor/visits/${visitId}/prescriptions`).set('Cookie', fixtures.doctor.cookie).send({
      visitId,
      items: [{ medicineId: med.body.medicine._id, frequency: 'twice daily after food', durationDays: 14 }],
      generalInstructions: 'Follow pathya (diet restrictions)',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.prescription.items[0].nameSnapshot).toBe('Rx Med');

    const finalize = await api().patch(`/api/doctor/prescriptions/${ok.body.prescription._id}`).set('Cookie', fixtures.doctor.cookie).send({ status: 'finalized' });
    expect(finalize.status).toBe(200);
    expect(finalize.body.prescription.status).toBe('finalized');
  });

  it('lists visits for the owning doctor', async () => {
    const { id: patientId } = await seedPatient(fixtures.reception.id);
    await api().post('/api/doctor/visits').set('Cookie', fixtures.doctor.cookie).send({ patientId });
    const list = await api().get('/api/doctor/visits').set('Cookie', fixtures.doctor.cookie);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
  });
});
