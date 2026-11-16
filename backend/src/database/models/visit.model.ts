import mongoose, { model, Model, Schema, Types } from 'mongoose';
import type { TokenStatus } from './token.model.js';

export interface VitalsRecord {
  temperatureC?: number;
  pulseBpm?: number;
  respRate?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  weightKg?: number;
  heightCm?: number;
  spo2?: number;
}

export interface VisitDoc {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  tokenId?: Types.ObjectId;
  doctorId: Types.ObjectId;
  visitDate: string; // YYYY-MM-DD clinic timezone
  status: 'open' | 'completed' | 'cancelled';
  chiefComplaints?: string;
  clinicalNotes?: string;
  vitals?: VitalsRecord;
  examinationFindings?: string;
  diagnosis?: string;
  icdCodeIds?: Types.ObjectId[];
  investigations?: string;
  followUpDate?: string;
  followUpNotes?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const vitalsSchema = new Schema<VitalsRecord>(
  {
    temperatureC: { type: Number, min: 25, max: 45 },
    pulseBpm: { type: Number, min: 0, max: 300 },
    respRate: { type: Number, min: 0, max: 100 },
    bpSystolic: { type: Number, min: 0, max: 400 },
    bpDiastolic: { type: Number, min: 0, max: 350 },
    weightKg: { type: Number, min: 0, max: 500 },
    heightCm: { type: Number, min: 0, max: 260 },
    spo2: { type: Number, min: 0, max: 100 },
  },
  { _id: false },
);

const visitSchema = new Schema<VisitDoc>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    tokenId: { type: Schema.Types.ObjectId, ref: 'Token' },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    visitDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: { type: String, enum: ['open', 'completed', 'cancelled'], default: 'open', required: true },
    chiefComplaints: { type: String, maxlength: 2000 },
    clinicalNotes: { type: String, maxlength: 5000 },
    vitals: { type: vitalsSchema },
    examinationFindings: { type: String, maxlength: 2000 },
    diagnosis: { type: String, maxlength: 1000 },
    icdCodeIds: [{ type: Schema.Types.ObjectId, ref: 'IcdCode' }],
    investigations: { type: String, maxlength: 2000 },
    followUpDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    followUpNotes: { type: String, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'visits' },
);

visitSchema.index({ patientId: 1, visitDate: -1 });
visitSchema.index({ doctorId: 1, visitDate: -1 });
visitSchema.index({ visitDate: 1, status: 1 });

export const Visit = model<VisitDoc, Model<VisitDoc>>('Visit', visitSchema);
export type { TokenStatus };
