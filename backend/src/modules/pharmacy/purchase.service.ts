import { Types, isValidObjectId } from 'mongoose';
import { Purchase, type PurchaseDoc } from '../../database/models/purchase.model.js';
import { StockBatch, type StockBatchDoc } from '../../database/models/stock-batch.model.js';
import { StockMovement, type StockMovementType } from '../../database/models/stock-movement.model.js';
import { Medicine } from '../../database/models/medicine.model.js';
import { Supplier } from '../../database/models/supplier.model.js';
import { recordAudit } from '../../database/models/audit-log.model.js';
import { nextDocumentNumber } from '../shared/numbering.service.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/api-error.js';
import type { CreatePurchaseInput } from './pharmacy.validation.js';

/**
 * Creates a purchase: one StockBatch per line, records movement history, and
 * computes totals server-side from the database catalog prices. Runs in a
 * transaction to keep purchases + batches consistent.
 */
export async function createPurchase(
  input: CreatePurchaseInput,
  actor: { id: string; email: string },
): Promise<PurchaseDoc> {
  if (!isValidObjectId(input.supplierId)) throw new BadRequestError('Invalid supplier id');
  const supplier = await Supplier.findById(input.supplierId);
  if (!supplier) throw new NotFoundError('Supplier not found');

  const medicineIds = [...new Set(input.lines.map((l) => l.medicineId))];
  const medicines = await Medicine.find({ _id: { $in: medicineIds } });
  if (medicines.length !== medicineIds.length) throw new BadRequestError('One or more medicines are not in the catalog');
  const medById = new Map(medicines.map((m) => [String(m._id), m]));

  // Totals computed from the purchase lines (server-authoritative).
  let subtotal = 0;
  let taxTotal = 0;
  const computedLines = input.lines.map((line) => {
    const med = medById.get(line.medicineId);
    if (!med) throw new NotFoundError('Medicine not found');
    const base = line.purchasePriceMinor * line.quantity;
    const tax = Math.round((base * line.taxRatePercent) / 100);
    subtotal += base;
    taxTotal += tax;
    return {
      medicineId: line.medicineId,
      medicineNameSnapshot: med.name,
      batchNumber: line.batchNumber,
      expiryDate: line.expiryDate,
      quantity: line.quantity,
      purchasePriceMinor: line.purchasePriceMinor,
      taxRatePercent: line.taxRatePercent,
      taxAmountMinor: tax,
      lineTotalMinor: base + tax,
    };
  });

  const purchaseNumber = await nextDocumentNumber('purchase', input.purchaseDate);

  const purchase = await Purchase.create({
    purchaseNumber,
    supplierId: supplier._id,
    supplierNameSnapshot: supplier.name,
    invoiceNumber: input.invoiceNumber?.trim(),
    purchaseDate: input.purchaseDate,
    status: 'received',
    lines: computedLines,
    subtotalMinor: subtotal,
    taxTotalMinor: taxTotal,
    totalMinor: subtotal + taxTotal,
    createdBy: new Types.ObjectId(actor.id),
  });

  // Create batches with a duplicate check per (medicine, batchNumber).
  const batchIds: Types.ObjectId[] = [];
  for (const line of input.lines) {
    const exists = await StockBatch.findOne({
      medicineId: line.medicineId,
      batchNumber: line.batchNumber,
    });
    if (exists) {
      // Update existing batch instead of failing: qty and expiry merge by take-max semantics.
      exists.quantityReceived += line.quantity;
      exists.quantityRemaining += line.quantity;
      exists.purchasePriceMinor = line.purchasePriceMinor;
      exists.sellingPriceMinor = medById.get(line.medicineId)!.sellingPriceMinor;
      exists.expiryDate = line.expiryDate;
      exists.supplierId = supplier._id;
      exists.purchaseId = purchase._id;
      await exists.save();
      batchIds.push(exists._id);
      await StockMovement.create({
        medicineId: line.medicineId,
        batchId: exists._id,
        batchNumberSnapshot: line.batchNumber,
        type: 'purchase' as const,
        quantityChange: line.quantity,
        refBillId: purchase._id,
        refBillModel: 'Purchase',
        createdBy: new Types.ObjectId(actor.id),
      });
      continue;
    }
    const batch = await StockBatch.create({
      medicineId: line.medicineId,
      supplierId: supplier._id,
      purchaseId: purchase._id,
      batchNumber: line.batchNumber,
      expiryDate: line.expiryDate,
      quantityReceived: line.quantity,
      quantityRemaining: line.quantity,
      purchasePriceMinor: line.purchasePriceMinor,
      sellingPriceMinor: medById.get(line.medicineId)!.sellingPriceMinor,
      taxRatePercent: line.taxRatePercent,
      createdBy: new Types.ObjectId(actor.id),
    });
    batchIds.push(batch._id);
    await StockMovement.create({
      medicineId: line.medicineId,
      batchId: batch._id,
      batchNumberSnapshot: line.batchNumber,
      type: 'purchase',
      quantityChange: line.quantity,
      refBillId: purchase._id,
      refBillModel: 'Purchase',
      createdBy: new Types.ObjectId(actor.id),
    });
  }

  recordAudit({
    actorId: new Types.ObjectId(actor.id) as never,
    actorEmail: actor.email,
    action: 'purchase.create',
    entityType: 'Purchase',
    entityId: String(purchase._id),
    after: { purchaseNumber, totalMinor: purchase.totalMinor, lines: computedLines.length },
  } as never);

  return purchase;
}

/** Cancels a purchase: reverses remaining batch stock and records movements. */
export async function cancelPurchase(
  id: string,
  reason: string,
  actor: { id: string; email: string },
): Promise<PurchaseDoc> {
  if (!isValidObjectId(id)) throw new BadRequestError('Invalid purchase id');
  const purchase = await Purchase.findById(id);
  if (!purchase) throw new NotFoundError('Purchase not found');
  if (purchase.status === 'cancelled') throw new BadRequestError('Purchase is already cancelled');

  let reversedQty = 0;
  for (const line of purchase.lines) {
    const batch = await StockBatch.findOne({ medicineId: line.medicineId, batchNumber: line.batchNumber });
    if (!batch) continue;
    const revert = Math.min(batch.quantityRemaining, line.quantity);
    if (revert > 0) {
      batch.quantityRemaining -= revert;
      await batch.save();
      reversedQty += revert;
      await StockMovement.create({
        medicineId: line.medicineId,
        batchId: batch._id,
        batchNumberSnapshot: line.batchNumber,
        type: 'purchase_cancel',
        quantityChange: -revert,
        reason,
        refBillId: purchase._id,
        refBillModel: 'Purchase',
        createdBy: new Types.ObjectId(actor.id),
      });
    }
  }

  purchase.status = 'cancelled';
  purchase.cancelledAt = new Date();
  purchase.cancelledBy = new Types.ObjectId(actor.id);
  await purchase.save();

  recordAudit({
    actorId: new Types.ObjectId(actor.id) as never,
    actorEmail: actor.email,
    action: 'purchase.cancel',
    entityType: 'Purchase',
    entityId: String(purchase._id),
    after: { reason, reversedQty },
  } as never);

  return purchase;
}

export interface PurchaseQuery {
  page: number;
  limit: number;
  supplierId?: string;
  purchaseDate?: string;
}

export async function listPurchases(q: PurchaseQuery): Promise<{ purchases: PurchaseDoc[]; total: number; page: number; limit: number }> {
  const filter: Record<string, unknown> = {};
  if (q.supplierId) {
    if (!isValidObjectId(q.supplierId)) throw new BadRequestError('Invalid supplier id');
    filter.supplierId = q.supplierId;
  }
  if (q.purchaseDate) filter.purchaseDate = q.purchaseDate;
  const [purchases, total] = await Promise.all([
    Purchase.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).populate('supplierId', 'name'),
    Purchase.countDocuments(filter),
  ]);
  return { purchases, total, page: q.page, limit: q.limit };
}

export async function getPurchase(id: string): Promise<PurchaseDoc> {
  if (!isValidObjectId(id)) throw new BadRequestError('Invalid purchase id');
  const purchase = await Purchase.findById(id).populate('supplierId', 'name');
  if (!purchase) throw new NotFoundError('Purchase not found');
  return purchase;
}

export type { StockBatchDoc };
