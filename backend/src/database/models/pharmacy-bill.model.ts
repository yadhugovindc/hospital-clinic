import mongoose, { model, Model, Schema, Types } from 'mongoose';

export type BillStatus = 'finalized' | 'cancelled';

export interface PharmacyBillLine {
  medicineId: Types.ObjectId;
  medicineNameSnapshot: string;
  batchId: Types.ObjectId;
  batchNumberSnapshot: string;
  expiryDateSnapshot: string;
  quantity: number;
  unitPriceMinor: number; // selling price per unit at time of sale
  discountPercent: number; // 0-100, may be fractional (e.g. 12.5)
  taxRatePercent: number;
  discountMinor: number;
  taxAmountMinor: number;
  lineTotalMinor: number; // after discount & tax
}

export type PharmacyBillDoc = {
  _id: Types.ObjectId;
  billNumber: string; // e.g. PH-2026-0001
  patientId: Types.ObjectId;
  patientNameSnapshot: string;
  uhidSnapshot: string;
  billDate: string; // YYYY-MM-DD
  status: BillStatus;
  /** Bills are recorded as settled at creation (single-invoice model). */
  paymentMethod: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque' | 'other';
  lines: PharmacyBillLine[];
  subtotalMinor: number; // before discount & tax
  discountTotalMinor: number;
  taxTotalMinor: number;
  totalMinor: number;
  issuedBy: Types.ObjectId;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
};

const pharmacyBillLineSchema = new Schema<PharmacyBillLine>(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    medicineNameSnapshot: { type: String, required: true, maxlength: 200 },
    batchId: { type: Schema.Types.ObjectId, ref: 'StockBatch', required: true },
    batchNumberSnapshot: { type: String, required: true, maxlength: 100 },
    expiryDateSnapshot: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, min: 0, max: 100, default: 0 },
    taxRatePercent: { type: Number, required: true, min: 0, max: 28 },
    discountMinor: { type: Number, required: true, min: 0 },
    taxAmountMinor: { type: Number, required: true, min: 0 },
    lineTotalMinor: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const pharmacyBillSchema = new Schema<PharmacyBillDoc>(
  {
    billNumber: { type: String, required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientNameSnapshot: { type: String, required: true, maxlength: 150 },
    uhidSnapshot: { type: String, required: true },
    billDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: { type: String, enum: ['finalized', 'cancelled'], default: 'finalized', required: true },
    paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other'], default: 'cash', required: true },
    lines: {
      type: [pharmacyBillLineSchema],
      validate: { validator: (l: unknown[]) => l.length > 0, message: 'A bill must contain at least one line item' },
    },
    subtotalMinor: { type: Number, required: true, min: 0 },
    discountTotalMinor: { type: Number, required: true, min: 0 },
    taxTotalMinor: { type: Number, required: true, min: 0 },
    totalMinor: { type: Number, required: true, min: 0 },
    issuedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancellationReason: { type: String, maxlength: 500 },
  },
  { timestamps: true, collection: 'pharmacyBills' },
);

pharmacyBillSchema.index({ billNumber: 1 }, { unique: true });
pharmacyBillSchema.index({ patientId: 1, billDate: -1 });
pharmacyBillSchema.index({ billDate: 1, status: 1 });
pharmacyBillSchema.index({ paymentMethod: 1 });

export const PharmacyBill = model<PharmacyBillDoc, Model<PharmacyBillDoc>>('PharmacyBill', pharmacyBillSchema);
