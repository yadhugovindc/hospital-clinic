import { isValidObjectId, Types, type HydratedDocument } from 'mongoose';
import { Visit, type VitalsRecord, type VisitDoc } from '../../database/models/visit.model.js';
import { Patient } from '../../database/models/patient.model.js';
import { Token } from '../../database/models/token.model.js';
import { IcdCode } from '../../database/models/icd-code.model.js';
import { recordAudit } from '../../database/models/audit-log.model.js';
import { getSettings } from '../clinic-settings/clinic.service.js';
import { clinicToday, isValidBusinessDate } from '../../shared/utils/date.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/api-error.js';
import type { Role } from '../../shared/utils/rbac.js';

export interface CreateVisitInput {
  patientId: string;
  tokenId?: string;
  doctorId?: string; // admins may specify; doctors default to themselves
  visitDate?: string;
  chiefComplaints?: string;
  clinicalNotes?: string;
  vitals?: VitalsRecord;
  examinationFindings?: string;
  diagnosis?: string;
  icdCodeIds?: string[];
  investigations?: string;
  followUpDate?: string;
  followUpNotes?: string;
}

export async function createVisit(
  input: CreateVisitInput,
  actor: { id: string; email: string; role: Role },
): Promise<VisitDoc> {
  if (!isValidObjectId(input.patientId)) throw new BadRequestError('Invalid patient id');
  const patient = await Patient.findById(input.patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  const doctorId = actor.role === 'admin' && input.doctorId ? input.doctorId : actor.id;

  if (input.tokenId) {
    if (!isValidObjectId(input.tokenId)) throw new BadRequestError('Invalid token id');
    const token = await Token.findById(input.tokenId);
    if (!token) throw new NotFoundError('Token not found');
    if (String(token.patientId) !== input.patientId) throw new BadRequestError('Token belongs to a different patient');
    if (token.status === 'waiting') {
      token.status = 'in_consultation';
      await token.save();
    }
  }

  const settings = await getSettings();
  const visitDate = input.visitDate ?? clinicToday(settings.timezone);
  if (!isValidBusinessDate(visitDate)) throw new BadRequestError('Invalid visit date');

  if (input.icdCodeIds?.length) {
    const valid = await IcdCode.countDocuments({ _id: { $in: input.icdCodeIds } });
    if (valid !== input.icdCodeIds.length) throw new BadRequestError('One or more ICD codes are invalid');
  }

  const visit = await Visit.create({
    patientId: input.patientId,
    tokenId: input.tokenId,
    doctorId,
    visitDate,
    status: 'open',
    chiefComplaints: input.chiefComplaints?.trim(),
    clinicalNotes: input.clinicalNotes?.trim(),
    vitals: input.vitals,
    examinationFindings: input.examinationFindings?.trim(),
    diagnosis: input.diagnosis?.trim(),
    icdCodeIds: input.icdCodeIds?.map((id) => new Types.ObjectId(id)),
    investigations: input.investigations?.trim(),
    followUpDate: input.followUpDate,
    followUpNotes: input.followUpNotes?.trim(),
    createdBy: new Types.ObjectId(actor.id),
  });

  recordAudit({
    actorId: new Types.ObjectId(actor.id) as never,
    actorEmail: actor.email,
    action: 'visit.create',
    entityType: 'Visit',
    entityId: String(visit._id),
    after: { patientId: input.patientId, visitDate },
  } as never);

  return visit;
}

export async function updateVisit(
  id: string,
  input: {
    chiefComplaints?: string;
    clinicalNotes?: string;
    vitals?: VitalsRecord;
    examinationFindings?: string;
    diagnosis?: string;
    icdCodeIds?: string[];
    investigations?: string;
    followUpDate?: string;
    followUpNotes?: string;
    status?: 'open' | 'completed' | 'cancelled';
  },
  actor: { id: string; email: string; role: Role },
): Promise<VisitDoc> {
  const visit = await getAuthorizedVisit(id, actor);
  if (visit.status === 'completed' && input.status !== 'completed') {
    throw new BadRequestError('Completed visits cannot be edited. Create a follow-up visit instead.');
  }
  if (visit.status === 'cancelled') throw new BadRequestError('Cancelled visits cannot be edited');

  const before: Record<string, unknown> = {
    chiefComplaints: visit.chiefComplaints,
    clinicalNotes: visit.clinicalNotes,
    vitals: visit.vitals,
    diagnosis: visit.diagnosis,
    investigations: visit.investigations,
    followUpDate: visit.followUpDate,
    status: visit.status,
  };

  const fields = [
    'chiefComplaints', 'clinicalNotes', 'vitals', 'examinationFindings',
    'diagnosis', 'investigations', 'followUpDate', 'followUpNotes',
  ] as const;
  for (const field of fields) {
    const value = input[field];
    if (value !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (visit as any)[field] = typeof value === 'string' ? value.trim() : value;
    }
  }
  if (input.icdCodeIds) {
    const valid = await IcdCode.countDocuments({ _id: { $in: input.icdCodeIds } });
    if (valid !== input.icdCodeIds.length) throw new BadRequestError('One or more ICD codes are invalid');
    visit.icdCodeIds = input.icdCodeIds.map((id) => new Types.ObjectId(id));
  }
  if (input.status) {
    visit.status = input.status;
    if (input.status === 'completed') {
      visit.updatedBy = new Types.ObjectId(actor.id);
      if (visit.tokenId) {
        await Token.updateOne({ _id: visit.tokenId, status: 'in_consultation' }, { status: 'completed' });
      }
    }
  }

  visit.updatedBy = new Types.ObjectId(actor.id);
  await visit.save();

  recordAudit({
    actorId: new Types.ObjectId(actor.id) as never,
    actorEmail: actor.email,
    action: 'visit.update',
    entityType: 'Visit',
    entityId: String(visit._id),
    before,
    after: {
      chiefComplaints: visit.chiefComplaints,
      clinicalNotes: visit.clinicalNotes,
      diagnosis: visit.diagnosis,
      status: visit.status,
    },
  } as never);

  return visit;
}

export interface VisitListQuery {
  patientId?: string;
  doctorId?: string;
  visitDate?: string;
  status?: 'open' | 'completed' | 'cancelled';
  page: number;
  limit: number;
}

export async function listVisits(q: VisitListQuery, actor: { id: string; role: Role }): Promise<{ visits: VisitDoc[]; total: number; page: number; limit: number }> {
  const filter: Record<string, unknown> = {};
  // Doctors only see their own visits unless admin.
  if (actor.role === 'doctor') filter.doctorId = actor.id;
  if (actor.role === 'admin' && q.doctorId) filter.doctorId = q.doctorId;
  if (q.patientId) {
    if (!isValidObjectId(q.patientId)) throw new BadRequestError('Invalid patient id');
    filter.patientId = q.patientId;
  }
  if (q.visitDate) {
    if (!isValidBusinessDate(q.visitDate)) throw new BadRequestError('Invalid visit date');
    filter.visitDate = q.visitDate;
  }
  if (q.status) filter.status = q.status;

  const [visits, total] = await Promise.all([
    Visit.find(filter).sort({ visitDate: -1, createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit),
    Visit.countDocuments(filter),
  ]);
  return { visits, total, page: q.page, limit: q.limit };
}

export async function getAuthorizedVisit(id: string, actor: { id: string; role: Role }): Promise<HydratedDocument<VisitDoc>> {
  if (!isValidObjectId(id)) throw new BadRequestError('Invalid visit id');
  const visit = await Visit.findById(id);
  if (!visit) throw new NotFoundError('Visit not found');
  if (actor.role === 'doctor' && String(visit.doctorId) !== actor.id) {
    throw new ForbiddenError('You may only access your own consultations');
  }
  if (actor.role !== 'admin' && actor.role !== 'doctor') {
    throw new ForbiddenError('Not authorized to access clinical records');
  }
  return visit;
}

/** Authorized clinical history for a patient. Reception/therapists see a redacted summary only. */
export async function authorizedPatientHistory(patientId: string, actor: { id: string; role: Role }): Promise<VisitDoc[]> {
  if (!isValidObjectId(patientId)) throw new BadRequestError('Invalid patient id');
  const patient = await Patient.findById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  const filter: Record<string, unknown> = { patientId };
  if (actor.role === 'doctor') {
    filter.doctorId = actor.id;
    return Visit.find(filter).sort({ visitDate: -1 }).limit(50);
  }
  if (actor.role === 'admin') {
    return Visit.find(filter).sort({ visitDate: -1 }).limit(50);
  }
  // Reception and therapists get a minimal, visit-level summary without clinical narrative
  return Visit.find(filter).select('visitDate status doctorId diagnosis followUpDate').limit(20);
}
