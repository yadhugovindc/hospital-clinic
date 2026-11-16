import { isValidObjectId, Types } from 'mongoose';
import { Token, type TokenDoc, type TokenStatus } from '../../database/models/token.model.js';
import { Patient } from '../../database/models/patient.model.js';
import { nextNumber } from '../../database/models/counter.model.js';
import { recordAudit } from '../../database/models/audit-log.model.js';
import { getSettings } from '../clinic-settings/clinic.service.js';
import { clinicToday, isValidBusinessDate } from '../../shared/utils/date.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/api-error.js';

export interface BookTokenInput {
  patientId: string;
  tokenDate?: string; // defaults to today in clinic timezone
  departmentId?: string;
  doctorId?: string;
  note?: string;
}

/** Books a token with an atomically allocated number unique per clinic day. */
export async function bookToken(input: BookTokenInput, actorId: string, actorEmail: string): Promise<TokenDoc> {
  const settings = await getSettings();
  const tokenDate = input.tokenDate ?? clinicToday(settings.timezone);
  if (!isValidBusinessDate(tokenDate)) throw new BadRequestError('Invalid token date');
  if (!isValidObjectId(input.patientId)) throw new BadRequestError('Invalid patient id');

  const patient = await Patient.findById(input.patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  const seq = await nextNumber(`token:${tokenDate}`);
  const token = await Token.create({
    tokenDate,
    tokenNumber: seq,
    patientId: patient._id,
    departmentId: input.departmentId ? new Types.ObjectId(input.departmentId) : undefined,
    doctorId: input.doctorId ? new Types.ObjectId(input.doctorId) : undefined,
    status: 'waiting',
    note: input.note?.trim(),
    createdBy: new Types.ObjectId(actorId),
  });

  recordAudit({
    actorId: new Types.ObjectId(actorId) as never,
    actorEmail,
    action: 'token.book',
    entityType: 'Token',
    entityId: String(token._id),
    after: { tokenDate, tokenNumber: seq, patientId: String(patient._id) },
  } as never);

  return token;
}

export interface QueueQuery {
  tokenDate?: string;
  status?: TokenStatus;
  doctorId?: string;
  patientId?: string;
  page: number;
  limit: number;
}

export async function listTokens(q: QueueQuery): Promise<{ tokens: (TokenDoc & { patient?: unknown })[]; total: number; page: number; limit: number }> {
  const settings = await getSettings();
  const filter: Record<string, unknown> = { tokenDate: q.tokenDate ?? clinicToday(settings.timezone) };
  if (q.status) filter.status = q.status;
  if (q.doctorId) {
    if (!isValidObjectId(q.doctorId)) throw new BadRequestError('Invalid doctor id');
    filter.doctorId = q.doctorId;
  }
  if (q.patientId) {
    if (!isValidObjectId(q.patientId)) throw new BadRequestError('Invalid patient id');
    filter.patientId = q.patientId;
  }

  const [tokens, total] = await Promise.all([
    Token.find(filter).sort({ tokenNumber: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).populate('patientId', 'name uhid phone gender ageYears dateOfBirth'),
    Token.countDocuments(filter),
  ]);
  return { tokens, total, page: q.page, limit: q.limit };
}

export async function listQueueCounts(tokenDate?: string): Promise<{ tokenDate: string; waiting: number; inConsultation: number; completed: number; cancelled: number; noShow: number }> {
  const settings = await getSettings();
  const date = tokenDate ?? clinicToday(settings.timezone);
  const counts = await Token.aggregate<{ _id: string; count: number }>([
    { $match: { tokenDate: date } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  return {
    tokenDate: date,
    waiting: byStatus['waiting'] ?? 0,
    inConsultation: byStatus['in_consultation'] ?? 0,
    completed: byStatus['completed'] ?? 0,
    cancelled: byStatus['cancelled'] ?? 0,
    noShow: byStatus['no_show'] ?? 0,
  };
}

const VALID_TRANSITIONS: Record<TokenStatus, TokenStatus[]> = {
  waiting: ['in_consultation', 'cancelled', 'no_show'],
  in_consultation: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export async function updateTokenStatus(
  id: string,
  status: TokenStatus,
  actorId: string,
  actorEmail: string,
): Promise<TokenDoc> {
  if (!isValidObjectId(id)) throw new BadRequestError('Invalid token id');
  const token = await Token.findById(id);
  if (!token) throw new NotFoundError('Token not found');

  if (!VALID_TRANSITIONS[token.status].includes(status)) {
    throw new BadRequestError(`Cannot move a ${token.status} token to ${status}`);
  }
  const before = token.status;
  token.status = status;
  await token.save();

  recordAudit({
    actorId: new Types.ObjectId(actorId) as never,
    actorEmail,
    action: 'token.status',
    entityType: 'Token',
    entityId: String(token._id),
    before: { status: before },
    after: { status },
  } as never);

  return token;
}

export async function cancelToken(id: string, note: string, actorId: string, actorEmail: string): Promise<TokenDoc> {
  return updateTokenStatus(id, 'cancelled', actorId, actorEmail);
}
