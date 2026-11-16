import { Types, isValidObjectId } from 'mongoose';
import { PharmacyBill, type PharmacyBillDoc, type PharmacyBillLine } from '../../database/models/pharmacy-bill.model.js';
import { StockBatch, type StockBatchDoc } from '../../database/models/stock-batch.model.js';
import { StockMovement } from '../../database/models/stock-movement.model.js';
import { Medicine } from '../../database/models/medicine.model.js';
import { Patient } from '../../database/models/patient.model.js';
import { recordAudit } from '../../database/models/audit-log.model.js';
import { getSettings } from '../clinic-settings/clinic.service.js';
import { nextDocumentNumber } from '../shared/numbering.service.js';
import { clinicToday } from '../../shared/utils/date.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/api-error.js';
import type { CreateBillInput } from './pharmacy.validation.js';

export interface BatchAllocation {
  batchId: Types.ObjectId;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  sellingPriceMinor: number;
}

interface ComputedLine {
  medicineId: Types.ObjectId;
  medicineName: string;
  unitPriceMinor: number;
  taxRatePercent: number;
  discountPercent: number;
  quantity: number;
  allocations: BatchAllocation[];
}

/**
 * Allocates each requested quantity across stock batches in strict
 * earliest-expiry-first (FEFO) order, skipping expired and empty batches.
 */
async function allocateFefo(medicineId: string, quantity: number, today: string): Promise<BatchAllocation[]> {
  const batches = (await StockBatch.find({
    medicineId,
    quantityRemaining: { $gt: 0 },
    expiryDate: { $gte: today },
  }).sort({ expiryDate: 1 })) as unknown as StockBatchDoc[];

  let remaining = quantity;
  const allocations: BatchAllocation[] = [];
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.quantityRemaining);
    allocations.push({
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      quantity: take,
      sellingPriceMinor: batch.sellingPriceMinor,
    });
    remaining -= take;
  }
  if (remaining > 0) {
    throw new ConflictError(`Insufficient unexpired stock for medicine ${String(medicineId)}: short by ${remaining}`);
  }
  return allocations;
}

/**
 * Race-safe decrement: conditional update requires the batch to still hold the
 * quantity. If a concurrent request consumed stock first, the update fails,
 * all applied steps are compensated, and the caller can safely retry — stock
 * can never go negative.
 */
async function decrementBatches(allocations: BatchAllocation[]): Promise<void> {
  const done: Array<{ batchId: Types.ObjectId; quantity: number }> = [];
  try {
    for (const alloc of allocations) {
      const result = await StockBatch.updateOne(
        { _id: alloc.batchId, quantityRemaining: { $gte: alloc.quantity } },
        { $inc: { quantityRemaining: -alloc.quantity } },
      );
      if (result.modifiedCount !== 1) {
        throw new ConflictError('Stock changed during billing; retry the request');
      }
      done.push({ batchId: alloc.batchId, quantity: alloc.quantity });
    }
  } catch (err) {
    // Compensate already-applied decrements.
    for (const step of done) {
      await StockBatch.updateOne({ _id: step.batchId }, { $inc: { quantityRemaining: step.quantity } });
    }
    throw err;
  }
}

export async function createPharmacyBill(
  input: CreateBillInput,
  actor: { id: string; email: string },
): Promise<PharmacyBillDoc> {
  if (!isValidObjectId(input.patientId)) throw new BadRequestError('Invalid patient id');
  const patient = await Patient.findById(input.patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  const settings = await getSettings();
  const today = clinicToday(settings.timezone);

  const medicineIds = [...new Set(input.lines.map((l) => l.medicineId))];
  const medicines = await Medicine.find({ _id: { $in: medicineIds }, isActive: true });
  if (medicines.length !== medicineIds.length) {
    throw new BadRequestError('One or more medicines are not in the active catalog');
  }
  const medById = new Map(medicines.map((m) => [String(m._id), m]));

  // Server-authoritative pricing from the catalog; client sends quantity + discount only.
  const computed: ComputedLine[] = [];
  for (const line of input.lines) {
    const med = medById.get(line.medicineId);
    if (!med) throw new NotFoundError('Medicine not found');
    const allocations = await allocateFefo(String(med._id), line.quantity, today);
    computed.push({
      medicineId: med._id,
      medicineName: med.name,
      unitPriceMinor: med.sellingPriceMinor,
      taxRatePercent: med.taxRatePercent,
      discountPercent: line.discountPercent,
      quantity: line.quantity,
      allocations,
    });
  }

  // Compute bill totals from allocations (mixed prices across batches are possible).
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  const billLines: PharmacyBillLine[] = [];
  const paymentMethod = (input.paymentMethod ?? 'cash') as PharmacyBillDoc['paymentMethod'];

  for (const line of computed) {
    for (const alloc of line.allocations) {
      const lineSubtotal = alloc.sellingPriceMinor * alloc.quantity;
      const discount = Math.min(lineSubtotal, Math.round((lineSubtotal * line.discountPercent) / 100));
      const taxable = lineSubtotal - discount;
      const tax = Math.round((taxable * line.taxRatePercent) / 100);
      subtotal += lineSubtotal;
      discountTotal += discount;
      taxTotal += tax;
      billLines.push({
        medicineId: line.medicineId,
        medicineNameSnapshot: line.medicineName,
        batchId: alloc.batchId,
        batchNumberSnapshot: alloc.batchNumber,
        expiryDateSnapshot: alloc.expiryDate,
        quantity: alloc.quantity,
        unitPriceMinor: alloc.sellingPriceMinor,
        discountPercent: line.discountPercent,
        taxRatePercent: line.taxRatePercent,
        discountMinor: discount,
        taxAmountMinor: tax,
        lineTotalMinor: taxable + tax,
      });
    }
  }
  const total = subtotal - discountTotal + taxTotal;

  const billNumber = await nextDocumentNumber('pharmacy', today);

  // Decrement stock AFTER numbering; compensation rolls back on conflict.
  for (const line of computed) {
    await decrementBatches(line.allocations);
  }

  try {
    const bill = await PharmacyBill.create({
      billNumber,
      patientId: patient._id,
      patientNameSnapshot: patient.name,
      uhidSnapshot: patient.uhid,
      billDate: today,
      status: 'finalized',
      paymentMethod,
      lines: billLines,
      subtotalMinor: subtotal,
      discountTotalMinor: discountTotal,
      taxTotalMinor: taxTotal,
      totalMinor: total,
      issuedBy: new Types.ObjectId(actor.id),
    });

    // Movement ledger entries corresponding exactly to the applied decrements.
    for (const line of computed) {
      for (const alloc of line.allocations) {
        await StockMovement.create({
          medicineId: line.medicineId,
          batchId: alloc.batchId,
          batchNumberSnapshot: alloc.batchNumber,
          type: 'dispense',
          quantityChange: -alloc.quantity,
          refBillId: bill._id,
          refBillModel: 'PharmacyBill',
          createdBy: new Types.ObjectId(actor.id),
        });
      }
    }

    recordAudit({
      actorId: new Types.ObjectId(actor.id) as never,
      actorEmail: actor.email,
      action: 'pharmacy_bill.create',
      entityType: 'PharmacyBill',
      entityId: String(bill._id),
      after: { billNumber, totalMinor: total, lines: billLines.length },
    } as never);

    return bill;
  } catch (err) {
    // Bill creation failed: restore the stock that was reserved.
    for (const line of computed) {
      for (const alloc of line.allocations) {
        await StockBatch.updateOne({ _id: alloc.batchId }, { $inc: { quantityRemaining: alloc.quantity } });
      }
    }
    throw err;
  }
}

/**
 * Controlled cancellation: restores stock and keeps the invoice snapshot for
 * audit. Cancelled bills are excluded from financial totals.
 */
export async function cancelPharmacyBill(
  id: string,
  reason: string,
  actor: { id: string; email: string },
): Promise<PharmacyBillDoc> {
  if (!isValidObjectId(id)) throw new BadRequestError('Invalid bill id');
  const bill = await PharmacyBill.findById(id);
  if (!bill) throw new NotFoundError('Bill not found');
  if (bill.status === 'cancelled') throw new BadRequestError('Bill is already cancelled');

  bill.status = 'cancelled';
  bill.cancelledAt = new Date();
  bill.cancelledBy = new Types.ObjectId(actor.id);
  bill.cancellationReason = reason.slice(0, 500);
  await bill.save();

  // Restore stock per original line (controlled reversal path only).
  for (const line of bill.lines) {
    const restored = await StockBatch.findOneAndUpdate(
      { _id: line.batchId },
      { $inc: { quantityRemaining: line.quantity } },
      { new: true },
    );
    if (restored) {
      await StockMovement.create({
        medicineId: line.medicineId,
        batchId: line.batchId,
        batchNumberSnapshot: line.batchNumberSnapshot,
        type: 'sale_return',
        quantityChange: line.quantity,
        reason: `Bill ${bill.billNumber} cancelled: ${reason}`.slice(0, 500),
        refBillId: bill._id,
        refBillModel: 'PharmacyBill',
        createdBy: new Types.ObjectId(actor.id),
      });
    }
  }

  recordAudit({
    actorId: new Types.ObjectId(actor.id) as never,
    actorEmail: actor.email,
    action: 'pharmacy_bill.cancel',
    entityType: 'PharmacyBill',
    entityId: String(bill._id),
    before: { status: 'finalized' },
    after: { status: 'cancelled', reason },
  } as never);

  return bill;
}

export interface BillQuery {
  page: number;
  limit: number;
  patientId?: string;
  billDate?: string;
}

export async function listBills(q: BillQuery): Promise<{ bills: PharmacyBillDoc[]; total: number; page: number; limit: number }> {
  const filter: Record<string, unknown> = {};
  if (q.patientId) {
    if (!isValidObjectId(q.patientId)) throw new BadRequestError('Invalid patient id');
    filter.patientId = q.patientId;
  }
  if (q.billDate) filter.billDate = q.billDate;
  const [bills, total] = await Promise.all([
    PharmacyBill.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit),
    PharmacyBill.countDocuments(filter),
  ]);
  return { bills, total, page: q.page, limit: q.limit };
}

export async function getBill(id: string): Promise<PharmacyBillDoc> {
  if (!isValidObjectId(id)) throw new BadRequestError('Invalid bill id');
  const bill = await PharmacyBill.findById(id).populate('issuedBy', 'name');
  if (!bill) throw new NotFoundError('Bill not found');
  return bill;
}
