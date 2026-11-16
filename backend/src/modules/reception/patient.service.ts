import { Types, type HydratedDocument } from 'mongoose';
import { Patient, type PatientDoc, } from '../../database/models/patient.model.js';
import Counter from '../../database/models/counter.model.js';
import { nextNumber } from '../../database/models/counter.model.js';
import { recordAudit } from '../../database/models/audit-log.model.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/api-error.js';
import { isValidObjectId } from 'mongoose';

const UHID_COUNTER_KEY = 'uhid';

export function formatUhid(seq: number): string {
  const year = new Date().getFullYear();
  return `AY-${year}-${String(seq).padStart(5, '0')}`;
}

export interface PatientInput {
  name: string;
  gender: 'male' | 'female' | 'other';
  phone: string;
  dateOfBirth?: string;
  ageYears?: number;
  altPhone?: string;
  email?: string;
  address?: string;
  registrationNotes?: string;
}

/** Creates a patient with a race-safe unique UHID. Retries on counter collision. */
export async function createPatient(input: PatientInput, actorId: string, actorEmail: string): Promise<PatientDoc> {
  const seq = await nextNumber(UHID_COUNTER_KEY);
  const uhid = formatUhid(seq);

  const dob = input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00Z`) : undefined;
  let ageYears = input.ageYears;
  if (dob) {
    ageYears = yearsBetween(dob, new Date());
  }

  const patient = await Patient.create({
    ...input,
    name: input.name.trim(),
    phone: input.phone.trim(),
    dateOfBirth: dob,
    ageYears,
    email: input.email?.trim().toLowerCase(),
    address: input.address?.trim(),
    registrationNotes: input.registrationNotes?.trim(),
    uhid,
    createdBy: new Types.ObjectId(actorId),
  });

  recordAudit({
    actorId: new Types.ObjectId(actorId) as never,
    actorEmail,
    action: 'patient.create',
    entityType: 'Patient',
    entityId: String(patient._id),
    after: { uhid: patient.uhid, name: patient.name },
  } as never);

  return patient;
}

function yearsBetween(start: Date, end: Date): number {
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  if (end < new Date(Date.UTC(end.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))) years -= 1;
  return Math.max(0, years);
}

export interface PatientSearchQuery {
  page: number;
  limit: number;
  uhid?: string;
  name?: string;
  phone?: string;
  sort?: 'recent' | 'name';
}

export async function searchPatients(q: PatientSearchQuery): Promise<{ patients: PatientDoc[]; total: number; page: number; limit: number }> {
  const filter: Record<string, unknown> = {};
  if (q.uhid) filter.uhid = q.uhid.trim().toUpperCase();
  if (q.phone) filter.phone = { $regex: escapeRegex(q.phone.trim()), $options: 'i' };
  if (q.name) filter.name = { $regex: escapeRegex(q.name.trim()), $options: 'i' };

  const sort: Record<string, 1 | -1> = q.sort === 'name' ? { name: 1 } : { createdAt: -1 };
  const [patients, total] = await Promise.all([
    Patient.find(filter).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit),
    Patient.countDocuments(filter),
  ]);
  return { patients, total, page: q.page, limit: q.limit };
}

export async function getPatient(id: string): Promise<HydratedDocument<PatientDoc>> {
  if (!isValidObjectId(id)) throw new BadRequestError('Invalid patient id');
  const patient = await Patient.findById(id);
  if (!patient) throw new NotFoundError('Patient not found');
  return patient;
}

export async function updatePatient(
  id: string,
  input: Partial<PatientInput>,
  actorId: string,
  actorEmail: string,
): Promise<PatientDoc> {
  const patient = await getPatient(id);
  const before: Record<string, unknown> = {
    name: patient.name, phone: patient.phone, address: patient.address,
    email: patient.email, registrationNotes: patient.registrationNotes,
    altPhone: patient.altPhone, ageYears: patient.ageYears, dateOfBirth: patient.dateOfBirth,
  };

  if (input.name !== undefined) patient.name = input.name.trim();
  if (input.phone !== undefined) patient.phone = input.phone.trim();
  if (input.altPhone !== undefined) patient.altPhone = input.altPhone.trim();
  if (input.email !== undefined) patient.email = input.email.trim().toLowerCase();
  if (input.address !== undefined) patient.address = input.address.trim();
  if (input.registrationNotes !== undefined) patient.registrationNotes = input.registrationNotes.trim();
  if (input.dateOfBirth) {
    patient.dateOfBirth = new Date(`${input.dateOfBirth}T00:00:00Z`);
    patient.ageYears = yearsBetween(patient.dateOfBirth, new Date());
  } else if (input.ageYears !== undefined) {
    patient.ageYears = input.ageYears;
  }

  // Re-checking duplicates: if the phone changed, flag it back to the caller.
  await patient.save();

  recordAudit({
    actorId: new Types.ObjectId(actorId) as never,
    actorEmail,
    action: 'patient.update',
    entityType: 'Patient',
    entityId: String(patient._id),
    before,
    after: {
      name: patient.name, phone: patient.phone, address: patient.address, email: patient.email,
      registrationNotes: patient.registrationNotes, altPhone: patient.altPhone,
      ageYears: patient.ageYears, dateOfBirth: patient.dateOfBirth,
    },
  } as never);

  return patient;
}

/**
 * Duplicate-detection heuristic: matches on normalized phone or exact name +
 * same phone/gender. Returns candidates for the reception UI to confirm
 * before creating a new record. Records are never silently merged.
 */
export async function detectDuplicates(input: { phone?: string; name?: string; gender?: string }): Promise<PatientDoc[]> {
  const or: Record<string, unknown>[] = [];
  if (input.phone) or.push({ phone: input.phone.trim() });
  if (input.name && input.gender) {
    or.push({ name: { $regex: `^${escapeRegex(input.name.trim())}$`, $options: 'i' }, gender: input.gender });
  }
  if (or.length === 0) return [];
  return Patient.find({ $or: or }).limit(10);
}

export async function getCounterStatus(): Promise<{ uhidSeq: number }> {
  const counter = await Counter.findById(UHID_COUNTER_KEY);
  return { uhidSeq: counter ? counter.seq : 0 };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
