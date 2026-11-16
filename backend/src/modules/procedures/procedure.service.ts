import { Types, isValidObjectId } from 'mongoose';
import {
  ProcedureCatalog,
  ProcedurePlan,
  ProcedureSession,
  ProcedureBill,
  type ProcedureCatalogDoc,
  type ProcedurePlanDoc,
  type ProcedureSessionDoc,
  type ProcedureBillDoc,
} from '../../database/models/procedure-models.js';
import { Patient } from '../../database/models/patient.model.js';
import { recordAudit } from '../../database/models/audit-log.model.js';
import { nextDocumentNumber } from '../shared/numbering.service.js';
import { getSettings } from '../clinic-settings/clinic.service.js';
import { clinicToday, isValidBusinessDate } from '../../shared/utils/date.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/api-error.js';

// ---------- Catalog ----------
export async function createCatalogItem(
  input: { name: string; description?: string; defaultSessionDurationMinutes: number; priceMinor: number; taxRatePercent: number },
  actor: { id: string; email: string },
): Promise<ProcedureCatalogDoc> {
  const existing = await ProcedureCatalog.findOne({ name: input.name.trim() });
  if (existing) throw new ConflictError('A procedure with this name already exists');
  const item = await ProcedureCatalog.create({
    ...input,
    name: input.name.trim(),
    createdBy: new Types.ObjectId(actor.id),
  });
  recordAudit({
    actorId: new Types.ObjectId(actor.id) as never,
    actorEmail: actor.email,
    action: 'procedure_catalog.create',
    entityType: 'ProcedureCatalog',
    entityId: String(item._id),
    after: { name: item.name, priceMinor: item.priceMinor },
  } as never);
  return item;
}

export async function listCatalog(includeInactive = false): Promise<ProcedureCatalogDoc[]> {
  const filter = includeInactive ? {} : { isActive: true };
  return ProcedureCatalog.find(filter).sort({ name: 1 });
}

export async function updateCatalogItem(
  id: string,
  input: Partial<{ name: string; description: string; defaultSessionDurationMinutes: number; priceMinor: number; taxRatePercent: number; isActive: boolean }>,
  actor: { id: string; email: string },
): Promise<ProcedureCatalogDoc> {
  if (!isValidObjectId(id)) throw new BadRequestError('Invalid procedure id');
  const item = await ProcedureCatalog.findById(id);
  if (!item) throw new NotFoundError('Procedure not found');
  const before: Record<string, unknown> = {};
  for (const field of ['name', 'description', 'defaultSessionDurationMinutes', 'priceMinor', 'taxRatePercent', 'isActive'] as const) {
    if (field in input && input[field] !== undefined) {
      before[field] = item[field];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (item as any)[field] = input[field];
    }
  }
  // Historical prices on plans and finalized bills are never rewritten:
  // prices are stamped at plan creation (unitPriceMinor snapshot).
  await item.save();
  recordAudit({
    actorId: new Types.ObjectId(actor.id) as never,
    actorEmail: actor.email,
    action: 'procedure_catalog.update',
    entityType: 'ProcedureCatalog',
    entityId: id,
    before,
    after: input,
  } as never);
  return item;
}

// ---------- Plans ----------
export interface CreatePlanInput {
  patientId: string;
  startDate: string;
  endDate?: string;
  items: Array<{ procedureId: string; sessionsPlanned: number }>;
  assignedTherapistId?: string;
  notes?: string;
}

/**
 * Creates a therapy plan plus its scheduled sessions in one operation.
 * Prices are stamped from the catalog into plan items (historical snapshot).
 */
export async function createPlan(input: CreatePlanInput, actor: { id: string; email: string }): Promise<ProcedurePlanDoc> {
  if (!isValidObjectId(input.patientId)) throw new BadRequestError('Invalid patient id');
  const patient = await Patient.findById(input.patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  if (!isValidBusinessDate(input.startDate)) throw new BadRequestError('Invalid start date');
  if (input.endDate && !isValidBusinessDate(input.endDate)) throw new BadRequestError('Invalid end date');
  if (input.endDate && input.endDate < input.startDate) throw new BadRequestError('End date must not precede start date');

  const procedureIds = [...new Set(input.items.map((i) => i.procedureId))];
  const procedures = await ProcedureCatalog.find({ _id: { $in: procedureIds }, isActive: true });
  if (procedures.length !== procedureIds.length) {
    throw new BadRequestError('One or more procedures are not in the active catalog');
  }
  const byId = new Map(procedures.map((p) => [String(p._id), p]));

  const settings = await getSettings();
  const planDate = clinicToday(settings.timezone);

  const items = input.items.map((item) => {
    const procedure = byId.get(item.procedureId)!;
    if (item.sessionsPlanned < 1) throw new BadRequestError('Each plan item needs at least one session');
    return {
      procedureId: procedure._id,
      nameSnapshot: procedure.name,
      sessionsPlanned: item.sessionsPlanned,
      sessionsCompleted: 0,
      unitPriceMinor: procedure.priceMinor,
      taxRatePercent: procedure.taxRatePercent,
    };
  });

  const planNumber = await nextDocumentNumber('procedure', planDate);

  const plan = await ProcedurePlan.create({
    planNumber,
    patientId: patient._id,
    uhidSnapshot: patient.uhid,
    planDate,
    startDate: input.startDate,
    endDate: input.endDate,
    items,
    status: 'active',
    assignedTherapistId: input.assignedTherapistId ? new Types.ObjectId(input.assignedTherapistId) : undefined,
    notes: input.notes?.trim(),
    createdBy: new Types.ObjectId(actor.id),
  });

  // Schedule every session as 'scheduled' with sequential session indexes.
  const sessionsToInsert: Array<Record<string, unknown>> = [];
  for (const item of items) {
    for (let index = 1; index <= item.sessionsPlanned; index++) {
      sessionsToInsert.push({
        planId: plan._id,
        procedureId: item.procedureId,
        procedureNameSnapshot: item.nameSnapshot,
        patientId: patient._id,
        scheduledDate: input.startDate,
        sessionIndex: index,
        status: 'scheduled',
        assignedTherapistId: plan.assignedTherapistId,
        createdBy: new Types.ObjectId(actor.id),
      });
    }
  }
  await ProcedureSession.insertMany(sessionsToInsert);

  recordAudit({
    actorId: new Types.ObjectId(actor.id) as never,
    actorEmail: actor.email,
    action: 'procedure_plan.create',
    entityType: 'ProcedurePlan',
    entityId: String(plan._id),
    after: { planNumber, items: items.length },
  } as never);

  return plan;
}

export async function listPlans(q: { page: number; limit: number; patientId?: string; status?: string; therapistId?: string }): Promise<{
  plans: ProcedurePlanDoc[];
  total: number;
  page: number;
  limit: number;
}> {
  const filter: Record<string, unknown> = {};
  if (q.patientId) {
    if (!isValidObjectId(q.patientId)) throw new BadRequestError('Invalid patient id');
    filter.patientId = q.patientId;
  }
  if (q.status && ['active', 'completed', 'cancelled'].includes(q.status)) filter.status = q.status;
  if (q.therapistId) {
    if (!isValidObjectId(q.therapistId)) throw new BadRequestError('Invalid therapist id');
    filter.assignedTherapistId = q.therapistId;
  }
  const [plans, total] = await Promise.all([
    ProcedurePlan.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).populate('patientId', 'name uhid'),
    ProcedurePlan.countDocuments(filter),
  ]);
  return { plans, total, page: q.page, limit: q.limit };
}

export async function getPlan(id: string): Promise<{ plan: ProcedurePlanDoc; sessions: ProcedureSessionDoc[] }> {
  if (!isValidObjectId(id)) throw new BadRequestError('Invalid plan id');
  const plan = await ProcedurePlan.findById(id).populate('patientId', 'name uhid phone');
  if (!plan) throw new NotFoundError('Plan not found');
  const sessions = await ProcedureSession.find({ planId: id }).sort({ procedureId: 1, sessionIndex: 1 });
  return { plan, sessions };
}

// ---------- Sessions ----------
export interface UpdateSessionInput {
  status?: 'scheduled' | 'completed' | 'cancelled' | 'missed' | 'rescheduled';
  scheduledDate?: string; // for rescheduling
  notes?: string;
  assignedTherapistId?: string;
}

const SESSION_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['completed', 'cancelled', 'missed', 'rescheduled'],
  completed: ['cancelled'], // explicit reversal workflow only
  cancelled: ['rescheduled'],
  missed: ['rescheduled', 'completed'],
  rescheduled: [],
};

/**
 * Updates a session with guarded transitions. Completing a session increments
 * the plan item's sessionsCompleted; rescheduling moves the session to a new
 * date keeping its position. Financial records are never edited here.
 */
export async function updateSession(
  id: string,
  input: UpdateSessionInput,
  actor: { id: string; email: string },
): Promise<ProcedureSessionDoc> {
  if (!isValidObjectId(id)) throw new BadRequestError('Invalid session id');
  const session = await ProcedureSession.findById(id);
  if (!session) throw new NotFoundError('Session not found');

  const beforeStatus = session.status;
  const beforeDate = session.scheduledDate;

  if (input.assignedTherapistId) {
    if (!isValidObjectId(input.assignedTherapistId)) throw new BadRequestError('Invalid therapist id');
    session.assignedTherapistId = new Types.ObjectId(input.assignedTherapistId);
  }

  if (input.scheduledDate) {
    if (!isValidBusinessDate(input.scheduledDate)) throw new BadRequestError('Invalid session date');
    // Rescheduling to a future/replacement date is the explicit correction path.
    session.rescheduledTo = input.scheduledDate;
    input.status = input.status && SESSION_TRANSITIONS[session.status]?.includes(input.status) ? input.status : 'rescheduled';
  }

  if (input.status && input.status !== session.status) {
    const allowed = SESSION_TRANSITIONS[session.status] ?? [];
    if (!allowed.includes(input.status)) {
      // Completing a rescheduled session directly is allowed as a special case.
      if (!(input.status === 'completed' && session.status === 'rescheduled')) {
        throw new BadRequestError(`Cannot change session status from ${session.status} to ${input.status}`);
      }
    }
    if (session.status === 'completed' && input.status === 'cancelled' && (!input.notes || input.notes.length < 3)) {
      throw new BadRequestError('Cancelling a completed session requires a documented reason');
    }
    session.status = input.status;
    if (input.status === 'completed') {
      session.completedAt = new Date();
      session.notes = input.notes?.trim() ?? session.notes;
      // Bump plan completed count atomically.
      await ProcedurePlan.updateOne(
        { _id: session.planId, 'items.procedureId': session.procedureId },
        { $inc: { 'items.$.sessionsCompleted': 1 } },
      );
    }
    if (input.status === 'rescheduled') {
      if (!input.scheduledDate) throw new BadRequestError('Rescheduling requires a new date');
      session.scheduledDate = input.scheduledDate;
      session.rescheduledTo = undefined;
    }
  } else if (input.scheduledDate && input.status !== 'completed') {
    // Pure date move without explicit status: treat as reschedule.
    if (beforeStatus === 'completed') throw new BadRequestError('Completed sessions cannot be rescheduled');
    session.scheduledDate = input.scheduledDate;
    session.status = 'rescheduled';
    session.rescheduledTo = undefined;
  }

  if (input.notes !== undefined && session.status !== 'completed') {
    session.notes = input.notes.trim();
  }

  await session.save();

  recordAudit({
    actorId: new Types.ObjectId(actor.id) as never,
    actorEmail: actor.email,
    action: 'procedure_session.update',
    entityType: 'ProcedureSession',
    entityId: String(session._id),
    before: { status: beforeStatus, scheduledDate: beforeDate },
    after: { status: session.status, scheduledDate: session.scheduledDate },
  } as never);

  return session;
}

export async function listSessions(q: {
  page: number;
  limit: number;
  scheduledDate?: string;
  therapistId?: string;
  status?: string;
  patientId?: string;
}): Promise<{ sessions: ProcedureSessionDoc[]; total: number; page: number; limit: number }> {
  const filter: Record<string, unknown> = {};
  if (q.scheduledDate) {
    if (!isValidBusinessDate(q.scheduledDate)) throw new BadRequestError('Invalid session date');
    filter.scheduledDate = q.scheduledDate;
  }
  if (q.therapistId) {
    if (!isValidObjectId(q.therapistId)) throw new BadRequestError('Invalid therapist id');
    filter.assignedTherapistId = q.therapistId;
  }
  if (q.status && ['scheduled', 'completed', 'cancelled', 'missed', 'rescheduled'].includes(q.status)) filter.status = q.status;
  if (q.patientId) {
    if (!isValidObjectId(q.patientId)) throw new BadRequestError('Invalid patient id');
    filter.patientId = q.patientId;
  }
  const [sessions, total] = await Promise.all([
    ProcedureSession.find(filter).sort({ scheduledDate: 1, sessionIndex: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).populate('patientId', 'name uhid'),
    ProcedureSession.countDocuments(filter),
  ]);
  return { sessions, total, page: q.page, limit: q.limit };
}

// ---------- Billing ----------
export interface CreateProcedureBillInput {
  patientId: string;
  paymentMethod?: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque' | 'other';
  lines: Array<{ planId: string; procedureId: string; sessionsCount: number; discountPercent?: number }>;
}

/**
 * Creates a procedure bill from plan items. Prices come from the plan's
 * historical snapshots (never the live catalog). Only completed and not-yet-
 * billed sessions are chargeable; this is expressed as sessionsCount against
 * the plan item's sessionsCompleted and a linked bill check per plan item.
 */
export async function createProcedureBill(input: CreateProcedureBillInput, actor: { id: string; email: string }): Promise<ProcedureBillDoc> {
  if (!isValidObjectId(input.patientId)) throw new BadRequestError('Invalid patient id');
  const patient = await Patient.findById(input.patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  const settings = await getSettings();
  const today = clinicToday(settings.timezone);

  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  const lines = [];

  for (const line of input.lines) {
    if (!isValidObjectId(line.planId) || !isValidObjectId(line.procedureId)) {
      throw new BadRequestError('Invalid plan or procedure id');
    }
    if (line.sessionsCount < 1) throw new BadRequestError('sessionsCount must be at least 1');
    const plan = await ProcedurePlan.findById(line.planId);
    if (!plan) throw new NotFoundError('Plan not found');
    if (String(plan.patientId) !== input.patientId) {
      throw new BadRequestError('Plan does not belong to the bill patient');
    }
    const item = plan.items.find((i) => String(i.procedureId) === line.procedureId);
    if (!item) throw new BadRequestError('Procedure is not part of this plan');

    // Chargeable sessions: completed and not yet covered by an active bill.
    const previouslyBilled = await ProcedureBill.findOne({
      status: 'finalized',
      lines: { $elemMatch: { planId: plan._id, procedureId: item.procedureId } },
      billDate: { $lte: today },
      createdAt: { $lt: new Date() },
      // partial-coverage is not tracked per line; bills charge completed totals so far
    });
    const covered = previouslyBilled instanceof ProcedureBill ? billCoverage(previouslyBilled, line.procedureId) : 0;
    const chargeable = item.sessionsCompleted - covered;
    if (chargeable <= 0) {
      throw new ConflictError(`No unbilled completed sessions for ${item.nameSnapshot}`);
    }
    const sessionsToCharge = Math.min(chargeable, line.sessionsCount);

    const lineSubtotal = item.unitPriceMinor * sessionsToCharge;
    const discountPercent = Math.max(0, Math.min(100, line.discountPercent ?? 0));
    const discount = Math.min(lineSubtotal, Math.round((lineSubtotal * discountPercent) / 100));
    const taxable = lineSubtotal - discount;
    const tax = Math.round((taxable * item.taxRatePercent) / 100);

    subtotal += lineSubtotal;
    discountTotal += discount;
    taxTotal += tax;

    lines.push({
      planId: plan._id,
      procedureId: item.procedureId,
      nameSnapshot: item.nameSnapshot,
      sessionsCount: sessionsToCharge,
      unitPriceMinor: item.unitPriceMinor,
      discountPercent,
      taxRatePercent: item.taxRatePercent,
      discountMinor: discount,
      taxAmountMinor: tax,
      lineTotalMinor: taxable + tax,
    });
  }

  const billNumber = await nextDocumentNumber('procedure', today);
  const bill = await ProcedureBill.create({
    billNumber,
    patientId: patient._id,
    uhidSnapshot: patient.uhid,
    patientNameSnapshot: patient.name,
    billDate: today,
    status: 'finalized',
    paymentMethod: input.paymentMethod ?? 'cash',
    lines,
    subtotalMinor: subtotal,
    discountTotalMinor: discountTotal,
    taxTotalMinor: taxTotal,
    totalMinor: subtotal - discountTotal + taxTotal,
    issuedBy: new Types.ObjectId(actor.id),
  });

  recordAudit({
    actorId: new Types.ObjectId(actor.id) as never,
    actorEmail: actor.email,
    action: 'procedure_bill.create',
    entityType: 'ProcedureBill',
    entityId: String(bill._id),
    after: { billNumber, totalMinor: bill.totalMinor },
  } as never);

  return bill;
}

function billCoverage(bill: ProcedureBillDoc, procedureId: string): number {
  const procedureKey = String(procedureId);
  return bill.lines.reduce((sum, line) => sum + (String(line.procedureId) === procedureKey ? line.sessionsCount : 0), 0);
}

export async function cancelProcedureBill(id: string, reason: string, actor: { id: string; email: string }): Promise<ProcedureBillDoc> {
  if (!isValidObjectId(id)) throw new BadRequestError('Invalid bill id');
  const bill = await ProcedureBill.findById(id);
  if (!bill) throw new NotFoundError('Bill not found');
  if (bill.status === 'cancelled') throw new BadRequestError('Bill is already cancelled');

  bill.status = 'cancelled';
  bill.cancelledAt = new Date();
  bill.cancelledBy = new Types.ObjectId(actor.id);
  bill.cancellationReason = reason.slice(0, 500);
  await bill.save();

  recordAudit({
    actorId: new Types.ObjectId(actor.id) as never,
    actorEmail: actor.email,
    action: 'procedure_bill.cancel',
    entityType: 'ProcedureBill',
    entityId: String(bill._id),
    before: { status: 'finalized' },
    after: { status: 'cancelled', reason },
  } as never);
  return bill;
}

export async function listProcedureBills(q: { page: number; limit: number; patientId?: string }): Promise<{ bills: ProcedureBillDoc[]; total: number; page: number; limit: number }> {
  const filter: Record<string, unknown> = {};
  if (q.patientId) {
    if (!isValidObjectId(q.patientId)) throw new BadRequestError('Invalid patient id');
    filter.patientId = q.patientId;
  }
  const [bills, total] = await Promise.all([
    ProcedureBill.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit),
    ProcedureBill.countDocuments(filter),
  ]);
  return { bills, total, page: q.page, limit: q.limit };
}

export async function getProcedureBill(id: string): Promise<ProcedureBillDoc> {
  if (!isValidObjectId(id)) throw new BadRequestError('Invalid bill id');
  const bill = await ProcedureBill.findById(id).populate('issuedBy', 'name');
  if (!bill) throw new NotFoundError('Bill not found');
  return bill;
}
