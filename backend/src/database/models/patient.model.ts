import mongoose, { model, Model, Schema, Types } from 'mongoose';

export interface PatientDoc {
  _id: Types.ObjectId;
  uhid: string; // e.g. AY-2026-00001
  name: string;
  dateOfBirth?: Date;
  ageYears?: number; // used when DOB unknown
  gender: 'male' | 'female' | 'other';
  phone: string;
  altPhone?: string;
  email?: string;
  address?: string;
  registrationNotes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const patientSchema = new Schema<PatientDoc>(
  {
    uhid: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    dateOfBirth: { type: Date },
    ageYears: { type: Number, min: 0, max: 130 },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    phone: { type: String, required: true, trim: true },
    altPhone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: { type: String, maxlength: 500 },
    registrationNotes: { type: String, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'patients' },
);

patientSchema.index({ uhid: 1 }, { unique: true });
patientSchema.index({ phone: 1 });
patientSchema.index({ name: 'text' });
patientSchema.index({ createdAt: -1 });

export const Patient = model<PatientDoc, Model<PatientDoc>>('Patient', patientSchema);
