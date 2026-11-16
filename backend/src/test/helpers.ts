import bcrypt from 'bcrypt';
import type { Request } from 'express';
import { createApp } from '../app.js';
import supertest from 'supertest';
import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import { User } from '../database/models/user.model.js';
import { Patient } from '../database/models/patient.model.js';
import { Medicine } from '../database/models/medicine.model.js';
import { StockBatch } from '../database/models/stock-batch.model.js';
import { Supplier } from '../database/models/supplier.model.js';
import { seedSettings } from '../database/seeds/seed-settings.js';
import Counter from '../database/models/counter.model.js';
import { Types } from 'mongoose';

let app: ReturnType<typeof createApp>;

export function api(): supertest.Agent {
  return supertest(app);
}

export async function connect(): Promise<void> {
  if (!app) app = createApp();
  await connectDatabase();
  await seedSettings();
}

export async function disconnect(): Promise<void> {
  await disconnectDatabase();
}

/** Drops all collections between tests for full isolation. */
export async function resetDb(): Promise<void> {
  const collections = await (await import('mongoose')).default.connection.db?.collections();
  if (!collections) return;
  await Promise.all(collections.map((c) => c.deleteMany({})));
  await seedSettings();
}

const PASSWORD = 'Password!23';

export async function seedUser(role: string, email: string, name = email): Promise<{ id: string; email: string; cookie: string[] }> {
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  const user = await User.create({ email, name, passwordHash, role: role as never, isActive: true });
  const res = await api().post('/api/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.text}`);
  const cookie = (res.headers['set-cookie'] ?? []) as string[];
  return { id: String(user._id), email, cookie };
}

async function login(email: string): Promise<string[]> {
  const res = await api().post('/api/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}`);
  return (res.headers['set-cookie'] ?? []) as string[];
}

export async function seedFixtures(): Promise<{
  admin: { id: string; email: string; cookie: string[] };
  reception: { id: string; email: string; cookie: string[] };
  doctor: { id: string; email: string; cookie: string[] };
  pharmacist: { id: string; email: string; cookie: string[] };
  accountant: { id: string; email: string; cookie: string[] };
  therapist: { id: string; email: string; cookie: string[] };
}> {
  const [admin, reception, doctor, pharmacist, accountant, therapist] = await Promise.all([
    seedUser('admin', 'admin@fixture.test', 'Admin F'),
    seedUser('receptionist', 'reception@fixture.test', 'Reception F'),
    seedUser('doctor', 'doctor@fixture.test', 'Doctor F'),
    seedUser('pharmacist', 'pharmacist@fixture.test', 'Pharmacist F'),
    seedUser('accountant', 'accountant@fixture.test', 'Accountant F'),
    seedUser('therapist', 'therapist@fixture.test', 'Therapist F'),
  ]);
  void login;
  return { admin, reception, doctor, pharmacist, accountant, therapist };
}

export async function seedPatient(createdBy: string): Promise<{ id: string; uhid: string }> {
  const seq = await Counter.findOneAndUpdate({ _id: 'uhid' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  const uhid = `AY-TEST-${String(seq!.seq).padStart(5, '0')}`;
  const patient = await Patient.create({
    uhid,
    name: 'Test Patient',
    gender: 'female',
    ageYears: 35,
    phone: '+91 90000 00001',
    createdBy: new Types.ObjectId(createdBy),
  });
  return { id: String(patient._id), uhid };
}

export async function seedMedicineWithStock(createdBy: string, opts?: { priceMinor?: number; qty?: number; expiryDate?: string }): Promise<{ medicineId: string; batchId: string }> {
  const medicine = await Medicine.create({
    name: `Test Medicine ${Date.now() % 100000}`,
    form: 'tablet',
    unit: 'pcs',
    sellingPriceMinor: opts?.priceMinor ?? 10000,
    taxRatePercent: 10,
    lowStockThreshold: 5,
    createdBy: new Types.ObjectId(createdBy),
  });
  const supplier = await Supplier.create({ name: `Test Supplier ${Date.now() % 100000}` });
  const batch = await StockBatch.create({
    medicineId: medicine._id,
    supplierId: supplier._id,
    batchNumber: `B-${Date.now() % 100000}`,
    expiryDate: opts?.expiryDate ?? '2030-01-01',
    quantityReceived: opts?.qty ?? 10,
    quantityRemaining: opts?.qty ?? 10,
    purchasePriceMinor: 7000,
    sellingPriceMinor: opts?.priceMinor ?? 10000,
    taxRatePercent: 10,
    createdBy: new Types.ObjectId(createdBy),
  });
  return { medicineId: String(medicine._id), batchId: String(batch._id) };
}

export function strParam(req: Request, key: string): string {
  const v = req.params[key];
  return typeof v === 'string' ? v : '';
}
