import mongoose, { model, Model, Schema, Types } from 'mongoose';

export interface PrescriptionItem {
  medicineId: Types.ObjectId;
  nameSnapshot: string;
  form?: string;
  strength?: string;
  dosage?: string; // e.g. "1 tablet"
  frequency: string; // e.g. "twice daily after food (BD)"
  timing?: string; // before/after food
  durationDays?: number;
  instructions?: string;
}

export interface PrescriptionDoc {
  _id: Types.ObjectId;
  visitId: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  prescriptionDate: string; // YYYY-MM-DD
  status: 'draft' | 'finalized' | 'cancelled';
  items: PrescriptionItem[];
  generalInstructions?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const prescriptionItemSchema = new Schema<PrescriptionItem>(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    nameSnapshot: { type: String, required: true, maxlength: 200 },
    form: { type: String, maxlength: 60 },
    strength: { type: String, maxlength: 60 },
    dosage: { type: String, maxlength: 100 },
    frequency: { type: String, required: true, maxlength: 120 },
    timing: { type: String, maxlength: 100 },
    durationDays: { type: Number, min: 1, max: 365 },
    instructions: { type: String, maxlength: 500 },
  },
  { _id: false },
);

const prescriptionSchema = new Schema<PrescriptionDoc>(
  {
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    prescriptionDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: { type: String, enum: ['draft', 'finalized', 'cancelled'], default: 'draft', required: true },
    items: {
      type: [prescriptionItemSchema],
      validate: {
        validator: (items: unknown[]) => items.length > 0,
        message: 'A prescription must contain at least one medicine item',
      },
    },
    generalInstructions: { type: String, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'prescriptions' },
);

prescriptionSchema.index({ visitId: 1 });
prescriptionSchema.index({ patientId: 1, prescriptionDate: -1 });
prescriptionSchema.index({ doctorId: 1, prescriptionDate: -1 });

export const Prescription = model<PrescriptionDoc, Model<PrescriptionDoc>>('Prescription', prescriptionSchema);
