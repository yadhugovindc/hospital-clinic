import mongoose, { model, Model, Schema, Types } from 'mongoose';

export interface MedicineDoc {
  _id: Types.ObjectId;
  name: string;
  category?: string; // e.g. "Churna", "Kwath", "Taila"
  form: string; // tablet, capsule, churna, oil, syrup, ...
  strength?: string; // e.g. "500 mg"
  unit: string; // pcs, ml, gm
  isAyurvedic: boolean;
  taxRatePercent: number; // default zero-rated
  sellingPriceMinor: number; // paise
  lowStockThreshold: number; // in units
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const medicineSchema = new Schema<MedicineDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, trim: true, maxlength: 100 },
    form: { type: String, required: true, trim: true, maxlength: 60 },
    strength: { type: String, trim: true, maxlength: 60 },
    unit: { type: String, required: true, trim: true, maxlength: 20 },
    isAyurvedic: { type: Boolean, default: true },
    taxRatePercent: { type: Number, min: 0, max: 28, default: 0 },
    sellingPriceMinor: { type: Number, required: true, min: 0 },
    lowStockThreshold: { type: Number, min: 0, default: 10 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'medicines' },
);

medicineSchema.index({ name: 1 });
medicineSchema.index({ name: 'text' });
medicineSchema.index({ category: 1 });

export const Medicine = model<MedicineDoc, Model<MedicineDoc>>('Medicine', medicineSchema);
