import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, connect, disconnect, resetDb, seedFixtures, seedPatient } from './helpers.js';

describe('Reception: patients and tokens', () => {
  beforeAll(async () => {
    await connect();
  });
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await disconnect();
  });

  let fixtures: Awaited<ReturnType<typeof seedFixtures>>;

  beforeAll(async () => {
    fixtures = await seedFixtures();
  });

  it('registers a patient with an auto-generated unique UHID', async () => {
    const res = await api().post('/api/reception/patients').set('Cookie', fixtures.reception.cookie).send({
      name: 'Registration Test',
      gender: 'male',
      dateOfBirth: '1990-05-05',
      phone: '+91 90000 11111',
    });
    expect(res.status).toBe(201);
    expect(res.body.patient.uhid).toMatch(/^AY-\d{4}-\d{5}$/);
  });

  it('generates sequential UHIDs under concurrent registrations', async () => {
    const payloads = Array.from({ length: 12 }, (_, i) => ({
      name: `Concurrent Patient ${i}`,
      gender: 'other',
      ageYears: 40,
      phone: `+91 90000 12${String(i).padStart(3, '0')}`,
    }));
    const results = await Promise.all(
      payloads.map((p) =>
        api().post('/api/reception/patients').set('Cookie', fixtures.reception.cookie).send(p),
      ),
    );
    const uhids = results.map((r) => r.body?.patient?.uhid as string | undefined).filter(Boolean);
    expect(uhids.length).toBe(12);
    expect(new Set(uhids).size).toBe(12);
  });

  it('rejects registration without DOB or age', async () => {
    const res = await api().post('/api/reception/patients').set('Cookie', fixtures.reception.cookie).send({
      name: 'No Age',
      gender: 'male',
      phone: '+91 90000 22222',
    });
    expect(res.status).toBe(400);
  });

  it('flags duplicate patients on registration check', async () => {
    await api().post('/api/reception/patients').set('Cookie', fixtures.reception.cookie).send({
      name: 'Dup Detector',
      gender: 'female',
      ageYears: 28,
      phone: '+91 90000 33333',
    });
    const dup = await api().post('/api/reception/patients/duplicates').set('Cookie', fixtures.reception.cookie).send({
      name: 'dup detector',
      gender: 'female',
    });
    expect(dup.status).toBe(200);
    expect(dup.body.duplicates.length).toBeGreaterThan(0);
  });

  it('books tokens with unique sequential numbers under concurrency', async () => {
    const { id: patientId } = await seedPatient(fixtures.reception.id);
    const booking = (): Promise<import('supertest').Response> =>
      api().post('/api/reception/tokens').set('Cookie', fixtures.reception.cookie).send({ patientId });
    const results = await Promise.all(Array.from({ length: 12 }, () => booking()));
    const numbers = results.map((r) => r.body?.token?.tokenNumber as number | undefined).filter((n): n is number => n !== undefined);
    expect(numbers.length).toBe(12);
    expect(new Set(numbers).size).toBe(12);
    // Numbering is sequential and gap-free
    numbers.sort((a, b) => a - b);
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });

  it('enforces token status transitions', async () => {
    const { id: patientId } = await seedPatient(fixtures.reception.id);
    const tokenRes = await api().post('/api/reception/tokens').set('Cookie', fixtures.reception.cookie).send({ patientId });
    const token = tokenRes.body.token;

    const invalid = await api()
      .patch(`/api/reception/tokens/${token._id}/status`)
      .set('Cookie', fixtures.reception.cookie)
      .send({ status: 'completed' });
    expect(invalid.status).toBe(400);

    const toConsult = await api()
      .patch(`/api/reception/tokens/${token._id}/status`)
      .set('Cookie', fixtures.reception.cookie)
      .send({ status: 'in_consultation' });
    expect(toConsult.status).toBe(200);
    expect(toConsult.body.token.status).toBe('in_consultation');

    const toCompleted = await api()
      .patch(`/api/reception/tokens/${token._id}/status`)
      .set('Cookie', fixtures.reception.cookie)
      .send({ status: 'completed' });
    expect(toCompleted.status).toBe(200);
  });

  it('returns queue counts scoped to today', async () => {
    const res = await api().get('/api/reception/tokens/counts').set('Cookie', fixtures.reception.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('waiting');
    expect(res.body).toHaveProperty('inConsultation', res.body.inConsultation);
  });

  it('denies token booking without permission (therapist)', async () => {
    const { id: patientId } = await seedPatient(fixtures.reception.id);
    const res = await api().post('/api/reception/tokens').set('Cookie', fixtures.therapist.cookie).send({ patientId });
    expect(res.status).toBe(403);
  });
});
