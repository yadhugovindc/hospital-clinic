import mongoose, { model, Model, Schema, Types } from 'mongoose';

export interface StockBatchDoc {
  _id: Types.ObjectId;
  medicineId: Types.ObjectId;
  supplierId?: Types.ObjectId;
  purchaseId?: Types.ObjectId;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  quantityReceived: number; // units
  quantityRemaining: number; // units, always >= 0
  purchasePriceMinor: number;
  sellingPriceMinor: number;
  taxRatePercent: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const stockBatchSchema = new Schema<StockBatchDoc>(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier' },
    purchaseId: { type: Schema.Types.ObjectId, ref: 'Purchase' },
    batchNumber: { type: String, required: true, trim: true, maxlength: 100 },
    expiryDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    quantityReceived: { type: Number, required: true, min: 1 },
    quantityRemaining: { type: Number, required: true, min: 0 },
    purchasePriceMinor: { type: Number, required: true, min: 0 },
    sellingPriceMinor: { type: Number, required: true, min: 0 },
    taxRatePercent: { type: Number, min: 0, max: 28, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'stockBatches' },
);

// Uniqueness: one medicine cannot have the same batch number twice.
stockBatchSchema.index({ medicineId: 1, batchNumber: 1 }, { unique: true });
// FIFO dispensing: filter by medicine then sort ascending by expiry.
stockBatchSchema.index({ medicineId: 1, expiryDate: 1, quantityRemaining: 1 });
stockBatchSchema.index({ expiryDate: 1 });

export const StockBatch = model<StockBatchDoc, Model<StockBatchDoc>>('StockBatch', stockBatchSchema);
