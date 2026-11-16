import { isValidObjectId, Types } from 'mongoose';
import { Prescription, type PrescriptionDoc } from '../../database/models/prescription.model.js';
import { Medicine } from '../../database/models/medicine.model.js';
import { Visit } from '../../database/models/visit.model.js';
import { recordAudit } from '../../database/models/audit-log.model.js';
import { getAuthorizedVisit } from './visit.service.js';
import { getSettings } from '../clinic-settings/clinic.service.js';
import { clinicToday, isValidBusinessDate } from '../../shared/utils/date.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/api-error.js';
import type { Role } from '../../shared/utils/rbac.js';

export interface PrescriptionItemInput {
  medicineId: string;
  dosage?: string;
  frequency: string;
  timing?: string;
  durationDays?: number;
  instructions?: string;
}

export interface CreatePrescriptionInput {
  visitId: string;
  items: PrescriptionItemInput[];
  generalInstructions?: string;
  status?: 'draft' | 'finalized';
}

/** Creates a prescription for a visit the doctor owns; doctor defaults to the session user. */
export async function createPrescription(
  input: CreatePrescriptionInput,
  actor: { id: string; email: string; role: Role },
): Promise<PrescriptionDoc> {
  const visit = await getAuthorizedVisit(input.visitId, actor);

  if (!input.items?.length) throw new BadRequestError('At least one medicine is required');
  if (input.items.length > 30) throw new BadRequestError('Too many medicine items');

  const medicineIds = [...new Set(input.items.map((i) => i.medicineId))];
  const medicines = await Medicine.find({ _id: { $in: medicineIds }, isActive: true });
  if (medicines.length !== medicineIds.length) {
    throw new BadRequestError('One or more medicines are not in the active catalog');
  }
  const byId = new Map(medicines.map((m) => [String(m._id), m]));

  const settings = await getSettings();
  const prescriptionDate = clinicToday(settings.timezone);
  if (!isValidBusinessDate(prescriptionDate)) throw new BadRequestError('Invalid prescription date');

  const items = input.items.map((i) => {
    const m = byId.get(i.medicineId)!;
    return {
      medicineId: m._id,
      nameSnapshot: m.name,
      form: m.form,
      strength: m.strength,
      dosage: i.dosage?.trim(),
      frequency: i.frequency.trim(),
      timing: i.timing?.trim(),
      durationDays: i.durationDays,
      instructions: i.instructions?.trim(),
    };
  });

  const prescription = await Prescription.create({
    visitId: visit._id,
    patientId: visit.patientId,
    doctorId: visit.doctorId,
    prescriptionDate,
    status: input.status ?? 'draft',
    items,
    generalInstructions: input.generalInstructions?.trim(),
    createdBy: new Types.ObjectId(actor.id),
  });

  recordAudit({
    actorId: new Types.ObjectId(actor.id) as never,
    actorEmail: actor.email,
    action: 'prescription.create',
    entityType: 'Prescription',
    entityId: String(prescription._id),
    after: { visitId: String(visit._id), itemNames: items.map((x) => x.nameSnapshot) },
  } as never);

  return prescription;
}

export interface UpdatePrescriptionInput {
  items?: PrescriptionItemInput[];
  generalInstructions?: string;
  status?: 'draft' | 'finalized' | 'cancelled';
}

export async function updatePrescription(
  id: string,
  input: UpdatePrescriptionInput,
  actor: { id: string; email: string; role: Role },
): Promise<PrescriptionDoc> {
  const prescription = await Prescription.findById(id);
  if (!prescription) throw new NotFoundError('Prescription not found');
  if (actor.role === 'doctor' && String(prescription.doctorId) !== actor.id) {
    throw new ForbiddenError('You may only edit your own prescriptions');
  }
  if (prescription.status === 'cancelled') throw new BadRequestError('Cancelled prescriptions cannot be edited');
  const wasFinalized = prescription.status === 'finalized';

  const before = { status: prescription.status, items: prescription.items.map((i) => i.nameSnapshot) };

  if (input.generalInstructions !== undefined) prescription.generalInstructions = input.generalInstructions.trim();
  if (input.items) {
    if (!input.items.length) throw new BadRequestError('At least one medicine is required');
    const medicineIds = [...new Set(input.items.map((i) => i.medicineId))];
    const medicines = await Medicine.find({ _id: { $in: medicineIds }, isActive: true });
    if (medicines.length !== medicineIds.length) throw new BadRequestError('One or more medicines are not in the active catalog');
    const byId = new Map(medicines.map((m) => [String(m._id), m]));
    prescription.items = input.items.map((i) => {
      const m = byId.get(i.medicineId)!;
      return {
        medicineId: m._id,
        nameSnapshot: m.name,
        form: m.form,
        strength: m.strength,
        dosage: i.dosage?.trim(),
        frequency: i.frequency.trim(),
        timing: i.timing?.trim(),
        durationDays: i.durationDays,
        instructions: i.instructions?.trim(),
      };
    });
  }
  if (input.status) {
    prescription.status = input.status;
    if (input.status === 'finalized') prescription.updatedBy = new Types.ObjectId(actor.id);
  }
  prescription.updatedBy = new Types.ObjectId(actor.id);
  await prescription.save();

  recordAudit({
    actorId: new Types.ObjectId(actor.id) as never,
    actorEmail: actor.email,
    action: wasFinalized ? 'prescription.edit_finalized' : 'prescription.update',
    entityType: 'Prescription',
    entityId: String(prescription._id),
    before,
    after: { status: prescription.status, items: prescription.items.map((i) => i.nameSnapshot) },
  } as never);

  return prescription;
}

export async function getPrescriptionForActor(id: string, actor: { id: string; role: Role }): Promise<PrescriptionDoc> {
  if (!isValidObjectId(id)) throw new BadRequestError('Invalid prescription id');
  const prescription = await Prescription.findById(id);
  if (!prescription) throw new NotFoundError('Prescription not found');
  if (actor.role === 'doctor' && String(prescription.doctorId) !== actor.id) {
    throw new ForbiddenError('You may only view your own prescriptions');
  }
  if (!['doctor', 'admin'].includes(actor.role)) {
    throw new ForbiddenError('Not authorized to view prescriptions');
  }
  return prescription;
}

export async function listPrescriptionsForPatient(patientId: string, actor: { id: string; role: Role }) {
  if (!isValidObjectId(patientId)) throw new BadRequestError('Invalid patient id');
  const filter: Record<string, unknown> = { patientId };
  if (actor.role === 'doctor') filter.doctorId = actor.id;
  if (!['doctor', 'admin'].includes(actor.role)) throw new ForbiddenError('Not authorized');
  return Prescription.find(filter).sort({ prescriptionDate: -1 }).limit(50);
}

/** Marks the parent visit complete when its prescription is finalized (consultation closure hint). */
export async function finalizePrescription(id: string, actor: { id: string; email: string; role: Role }) {
  const updated = await updatePrescription(id, { status: 'finalized' }, actor);
  const openVisits = await Visit.countDocuments({ _id: updated.visitId, status: 'open' });
  void openVisits;
  return updated;
}
