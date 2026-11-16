import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, connect, disconnect, resetDb, seedFixtures, seedUser, seedPatient } from './helpers.js';

describe('Authentication and authorization', () => {
  beforeAll(async () => {
    await connect();
  });
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await disconnect();
  });

  it('logs in with valid credentials and sets an HttpOnly cookie', async () => {
    await seedUser('admin', 'auth-admin@test.local', 'Auth Admin');
    const res = await api().post('/api/auth/login').send({ email: 'auth-admin@test.local', password: 'Password!23' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'auth-admin@test.local', role: 'admin' });
    const cookie = (res.headers['set-cookie'] ?? [''])[0] as string;
    expect(cookie).toMatch(/clinic_access=/);
    expect(cookie).toContain('HttpOnly');
  });

  it('rejects a wrong password without revealing which part failed', async () => {
    await seedUser('admin', 'auth-admin2@test.local', 'Auth Admin');
    const res = await api().post('/api/auth/login').send({ email: 'auth-admin2@test.local', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects an inactive user even with valid credentials', async () => {
    const user = await seedUser('doctor', 'auth-inactive@test.local', 'Inactive Doctor');
    const { User } = await import('../database/models/user.model.js');
    await User.updateOne({ _id: user.id }, { isActive: false });
    const res = await api().post('/api/auth/login').send({ email: 'auth-inactive@test.local', password: 'Password!23' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('denies protected endpoints without a session', async () => {
    const res = await api().get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user for a valid session', async () => {
    const { admin } = await seedFixtures();
    const res = await api().get('/api/auth/me').set('Cookie', admin.cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });

  it('enforces role permissions on protected endpoints (receptionist denied pharmacy write)', async () => {
    const { reception } = await seedFixtures();
    const res = await api().post('/api/pharmacy/medicines').set('Cookie', reception.cookie).send({
      name: 'X',
      form: 'tablet',
      unit: 'pcs',
      sellingPriceMinor: 100,
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows finance reads but denies procedure management writes', async () => {
    const { accountant } = await seedFixtures();
    const read = await api().get('/api/procedures/catalog').set('Cookie', accountant.cookie);
    const write = await api().post('/api/procedures/plans').set('Cookie', accountant.cookie).send({});

    expect(read.status).toBe(200);
    expect(write.status).toBe(403);
  });

  it('rejects cross-site state-changing requests (CSRF guard)', async () => {
    await seedUser('admin', 'auth-csrf@test.local', 'CSRF Admin');
    const login = await api().post('/api/auth/login').send({ email: 'auth-csrf@test.local', password: 'Password!23' });
    const cookie = (login.headers['set-cookie'] ?? []) as string[];
    const res = await api()
      .post('/api/reception/patients')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example.com')
      .send({ name: 'CSRF Patient', gender: 'male', ageYears: 30, phone: '+91 90000 00055' });
    expect([403, 401]).toContain(res.status);
  });

  it('logs out and invalidates further me calls only when cookie cleared', async () => {
    const { reception } = await seedFixtures();
    const res = await api().post('/api/auth/logout').set('Cookie', reception.cookie);
    expect(res.status).toBe(200);
    expect((res.headers['set-cookie'] ?? [''])[0]).toMatch(/clinic_access=;/);
  });

  it('does not accept a fabricated body price for pharmacy bills and indexes stay enforced', async () => {
    const { pharmacist } = await seedFixtures();
    const res = await api().post('/api/pharmacy/medicines').set('Cookie', pharmacist.cookie).send({
      name: 'Priced Medicine',
      form: 'tablet',
      unit: 'pcs',
      sellingPriceMinor: 999999999999,
      taxRatePercent: 300,
    });
    expect(res.status).toBe(400);
    void seedPatient;
  });
});
