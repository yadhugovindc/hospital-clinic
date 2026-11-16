import mongoose, { model, Model, Schema, Types } from 'mongoose';

export interface PurchaseLine {
  medicineId: Types.ObjectId;
  medicineNameSnapshot: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  purchasePriceMinor: number;
  taxRatePercent: number;
  taxAmountMinor: number;
  lineTotalMinor: number; // qty * price + tax
}

export type PurchaseStatus = 'received' | 'cancelled';

export interface PurchaseDoc {
  _id: Types.ObjectId;
  purchaseNumber: string; // e.g. PUR-2026-0001
  supplierId: Types.ObjectId;
  supplierNameSnapshot: string;
  invoiceNumber?: string;
  purchaseDate: string; // YYYY-MM-DD
  status: PurchaseStatus;
  lines: PurchaseLine[];
  subtotalMinor: number;
  taxTotalMinor: number;
  totalMinor: number;
  createdBy: Types.ObjectId;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseLineSchema = new Schema<PurchaseLine>(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    medicineNameSnapshot: { type: String, required: true, maxlength: 200 },
    batchNumber: { type: String, required: true, maxlength: 100 },
    expiryDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    quantity: { type: Number, required: true, min: 1 },
    purchasePriceMinor: { type: Number, required: true, min: 0 },
    taxRatePercent: { type: Number, required: true, min: 0, max: 28 },
    taxAmountMinor: { type: Number, required: true, min: 0 },
    lineTotalMinor: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const purchaseSchema = new Schema<PurchaseDoc>(
  {
    purchaseNumber: { type: String, required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    supplierNameSnapshot: { type: String, required: true, maxlength: 200 },
    invoiceNumber: { type: String, trim: true, maxlength: 100 },
    purchaseDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: { type: String, enum: ['received', 'cancelled'], default: 'received', required: true },
    lines: {
      type: [purchaseLineSchema],
      validate: { validator: (l: unknown[]) => l.length > 0, message: 'A purchase must contain at least one line' },
    },
    subtotalMinor: { type: Number, required: true, min: 0 },
    taxTotalMinor: { type: Number, required: true, min: 0 },
    totalMinor: { type: Number, required: true, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'purchases' },
);

purchaseSchema.index({ purchaseNumber: 1 }, { unique: true });
purchaseSchema.index({ supplierId: 1, purchaseDate: -1 });
purchaseSchema.index({ purchaseDate: -1 });

export const Purchase = model<PurchaseDoc, Model<PurchaseDoc>>('Purchase', purchaseSchema);
