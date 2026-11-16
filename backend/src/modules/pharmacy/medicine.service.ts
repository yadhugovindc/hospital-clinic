import { isValidObjectId, Types, type HydratedDocument } from 'mongoose';
import { Medicine, type MedicineDoc } from '../../database/models/medicine.model.js';
import { Supplier, type SupplierDoc } from '../../database/models/supplier.model.js';
import { recordAudit } from '../../database/models/audit-log.model.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/api-error.js';
import type { CreateMedicineInput, CreateSupplierInput } from './pharmacy.validation.js';

export async function createMedicine(input: CreateMedicineInput, actorId: string, actorEmail: string): Promise<MedicineDoc> {
  const medicine = await Medicine.create({
    ...input,
    name: input.name.trim(),
    createdBy: new Types.ObjectId(actorId),
  });
  recordAudit({
    actorId: new Types.ObjectId(actorId) as never,
    actorEmail,
    action: 'medicine.create',
    entityType: 'Medicine',
    entityId: String(medicine._id),
    after: { name: medicine.name, unit: medicine.unit },
  } as never);
  return medicine;
}

export type MedicineUpdateInput = Partial<
  Pick<
    MedicineDoc,
    'name' | 'category' | 'form' | 'strength' | 'unit' | 'isAyurvedic' | 'taxRatePercent' | 'sellingPriceMinor' | 'lowStockThreshold' | 'isActive'
  >
>;

export async function updateMedicine(id: string, input: MedicineUpdateInput, actorId: string, actorEmail: string): Promise<MedicineDoc> {
  const medicine = await mustGetMedicine(id);
  const editable = ['name', 'category', 'form', 'strength', 'unit', 'isAyurvedic', 'taxRatePercent', 'sellingPriceMinor', 'lowStockThreshold', 'isActive'] as const;
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const field of editable) {
    if (field in input && input[field] !== undefined) {
      before[field] = medicine[field];
      (medicine as unknown as Record<string, unknown>)[field] = input[field];
      after[field] = input[field];
    }
  }
  await medicine.save();
  recordAudit({
    actorId: new Types.ObjectId(actorId) as never,
    actorEmail,
    action: 'medicine.update',
    entityType: 'Medicine',
    entityId: String(medicine._id),
    before,
    after,
  } as never);
  return medicine;
}

export async function mustGetMedicine(id: string): Promise<HydratedDocument<MedicineDoc>> {
  if (!isValidObjectId(id)) throw new BadRequestError('Invalid medicine id');
  const medicine = await Medicine.findById(id);
  if (!medicine) throw new NotFoundError('Medicine not found');
  return medicine;
}

export interface MedicineQuery {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  lowStock?: boolean;
  includeInactive?: boolean;
}

export async function listMedicines(q: MedicineQuery): Promise<{ medicines: MedicineDoc[]; total: number; page: number; limit: number }> {
  const filter: Record<string, unknown> = {};
  if (!q.includeInactive) filter.isActive = true;
  if (q.category) filter.category = q.category;
  if (q.search) {
    const rx = new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { category: rx }, { form: rx }];
  }

  if (q.lowStock) {
    // Low stock = live batch totals summed via aggregation, joined per medicine.
    const results = await Medicine.aggregate<MedicineDoc & { stockRemaining: number }>([
      { $match: { isActive: true, ...(q.search ? { name: new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } : {}) } },
      {
        $lookup: {
          from: 'stockBatches',
          localField: '_id',
          foreignField: 'medicineId',
          as: 'stockBatches',
          pipeline: [{ $match: { quantityRemaining: { $gt: 0 } } }],
        },
      },
      { $addFields: { stockRemaining: { $sum: '$stockBatches.quantityRemaining' } } },
      { $match: { $expr: { $lt: ['$stockRemaining', '$lowStockThreshold'] } } },
      { $sort: { name: 1 } },
      { $skip: (q.page - 1) * q.limit },
      { $limit: q.limit },
      { $project: { stockBatches: 0 } },
    ]);
    return { medicines: results, total: results.length, page: q.page, limit: q.limit };
  }

  const [medicines, total] = await Promise.all([
    Medicine.find(filter).sort({ name: 1 }).skip((q.page - 1) * q.limit).limit(q.limit),
    Medicine.countDocuments(filter),
  ]);
  return { medicines, total, page: q.page, limit: q.limit };
}

export async function getMedicineStock(medicineId: string): Promise<{ remaining: number }> {
  if (!isValidObjectId(medicineId)) throw new BadRequestError('Invalid medicine id');
  const { StockBatch } = await import('../../database/models/stock-batch.model.js');
  const agg = await StockBatch.aggregate<{ totalInStock: number }>([
    { $match: { medicineId: new Types.ObjectId(medicineId), quantityRemaining: { $gt: 0 } } },
    { $group: { _id: null, totalInStock: { $sum: '$quantityRemaining' } } },
  ]);
  return { remaining: agg[0]?.totalInStock ?? 0 };
}

// ---------- Suppliers ----------
export async function createSupplier(input: CreateSupplierInput, actorId: string, actorEmail: string): Promise<SupplierDoc> {
  const supplier = await Supplier.create({ ...input, name: input.name.trim() });
  recordAudit({
    actorId: new Types.ObjectId(actorId) as never,
    actorEmail,
    action: 'supplier.create',
    entityType: 'Supplier',
    entityId: String(supplier._id),
    after: { name: supplier.name },
  } as never);
  return supplier;
}

export async function listSuppliers(): Promise<SupplierDoc[]> {
  return Supplier.find({ isActive: true }).sort({ name: 1 });
}

export type SupplierUpdateInput = Partial<
  Pick<SupplierDoc, 'name' | 'contactPerson' | 'phone' | 'email' | 'address' | 'gstNumber' | 'isActive'>
>;

export async function updateSupplier(id: string, input: SupplierUpdateInput, actorId: string, actorEmail: string): Promise<SupplierDoc> {
  if (!isValidObjectId(id)) throw new BadRequestError('Invalid supplier id');
  const supplier = await Supplier.findById(id);
  if (!supplier) throw new NotFoundError('Supplier not found');
  const editable = ['name', 'contactPerson', 'phone', 'email', 'address', 'gstNumber', 'isActive'] as const;
  for (const field of editable) {
    if (field in input && input[field] !== undefined) {
      (supplier as unknown as Record<string, unknown>)[field] = input[field];
    }
  }
  await supplier.save();
  recordAudit({
    actorId: new Types.ObjectId(actorId) as never,
    actorEmail,
    action: 'supplier.update',
    entityType: 'Supplier',
    entityId: id,
  } as never);
  return supplier;
}
