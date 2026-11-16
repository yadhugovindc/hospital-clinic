import { Types, isValidObjectId } from 'mongoose';
import { StockBatch, type StockBatchDoc } from '../../database/models/stock-batch.model.js';
import { StockMovement, type StockMovementDoc } from '../../database/models/stock-movement.model.js';
import { Medicine } from '../../database/models/medicine.model.js';
import { recordAudit } from '../../database/models/audit-log.model.js';
import { getSettings } from '../clinic-settings/clinic.service.js';
import { clinicToday } from '../../shared/utils/date.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/api-error.js';
import type { FilterQuery } from 'mongoose';

/** Live stock levels per batch, optionally filtered by medicine. */
export async function listStock(q: { page: number; limit: number; medicineId?: string }): Promise<{
  batches: (StockBatchDoc & { medicineName?: string })[];
  total: number;
  page: number;
  limit: number;
}> {
  const filter: FilterQuery<StockBatchDoc> = { quantityRemaining: { $gt: 0 } };
  if (q.medicineId) {
    if (!isValidObjectId(q.medicineId)) throw new BadRequestError('Invalid medicine id');
    filter.medicineId = q.medicineId;
  }
  const [batches, total] = await Promise.all([
    StockBatch.find(filter)
      .sort({ medicineId: 1, expiryDate: 1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate('medicineId', 'name form unit'),
    StockBatch.countDocuments(filter),
  ]);
  return { batches, total, page: q.page, limit: q.limit };
}

/** Batches that expire within N days (or are already expired). */
export async function expiryReport(opts: { withinDays: number; includeExpired: boolean; page: number; limit: number }): Promise<{
  batches: (StockBatchDoc & { medicineName?: string })[];
  total: number;
  page: number;
  limit: number;
}> {
  const settings = await getSettings();
  const today = clinicToday(settings.timezone);
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() + opts.withinDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const filter: FilterQuery<StockBatchDoc> = { quantityRemaining: { $gt: 0 } };
  if (opts.includeExpired) {
    filter.expiryDate = { $lte: cutoffStr };
  } else {
    filter.expiryDate = { $gt: today, $lte: cutoffStr };
  }

  const [batches, total] = await Promise.all([
    StockBatch.find(filter)
      .sort({ expiryDate: 1 })
      .skip((opts.page - 1) * opts.limit)
      .limit(opts.limit)
      .populate('medicineId', 'name form unit lowStockThreshold'),
    StockBatch.countDocuments(filter),
  ]);
  return { batches, total, page: opts.page, limit: opts.limit };
}

/**
 * Manual stock adjustment with a mandatory reason; recorded as a StockMovement
 * plus an audit entry. Refuses to drive stock negative.
 */
export async function adjustStock(
  input: { batchId: string; quantityChange: number; reason: string },
  actor: { id: string; email: string },
): Promise<{ batch: StockBatchDoc }> {
  if (!isValidObjectId(input.batchId)) throw new BadRequestError('Invalid batch id');
  const batch = await StockBatch.findById(input.batchId);
  if (!batch) throw new NotFoundError('Stock batch not found');

  const nextQty = batch.quantityRemaining + input.quantityChange;
  if (nextQty < 0) {
    throw new BadRequestError(`Adjustment would drive stock negative (current: ${batch.quantityRemaining})`);
  }

  batch.quantityRemaining = nextQty;
  await batch.save();

  await StockMovement.create({
    medicineId: batch.medicineId,
    batchId: batch._id,
    batchNumberSnapshot: batch.batchNumber,
    type: 'adjustment',
    quantityChange: input.quantityChange,
    reason: input.reason,
    createdBy: new Types.ObjectId(actor.id),
  });

  recordAudit({
    actorId: new Types.ObjectId(actor.id) as never,
    actorEmail: actor.email,
    action: 'stock.adjust',
    entityType: 'StockBatch',
    entityId: String(batch._id),
    before: { quantityRemaining: batch.quantityRemaining - input.quantityChange },
    after: { quantityRemaining: nextQty, reason: input.reason },
  } as never);

  return { batch };
}

export async function listMovements(query: { page: number; limit: number; medicineId?: string }): Promise<{
  movements: (StockMovementDoc & { medicineName?: string })[];
  total: number;
  page: number;
  limit: number;
}> {
  const filter: Record<string, unknown> = {};
  if (query.medicineId) {
    if (!isValidObjectId(query.medicineId)) throw new BadRequestError('Invalid medicine id');
    filter.medicineId = query.medicineId;
  }
  const [movements, total] = await Promise.all([
    StockMovement.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate('medicineId', 'name'),
    StockMovement.countDocuments(filter),
  ]);
  return { movements, total, page: query.page, limit: query.limit };
}
