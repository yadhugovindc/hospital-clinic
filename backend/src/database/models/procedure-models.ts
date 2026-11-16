import mongoose, { model, Model, Schema, Types } from 'mongoose';

// ---------- ProcedureCatalog ----------
export interface ProcedureCatalogDoc {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  defaultSessionDurationMinutes: number;
  priceMinor: number;
  taxRatePercent: number;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const catalogSchema = new Schema<ProcedureCatalogDoc>(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    defaultSessionDurationMinutes: { type: Number, required: true, min: 5, max: 600 },
    priceMinor: { type: Number, required: true, min: 0 },
    taxRatePercent: { type: Number, min: 0, max: 28, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'procedureCatalog' },
);

export const ProcedureCatalog = model<ProcedureCatalogDoc, Model<ProcedureCatalogDoc>>('ProcedureCatalog', catalogSchema);

// ---------- ProcedurePlan ----------
export interface ProcedurePlanItem {
  procedureId: Types.ObjectId;
  nameSnapshot: string;
  sessionsPlanned: number;
  sessionsCompleted: number;
  unitPriceMinor: number; // sanitized history at plan creation
  taxRatePercent: number;
}

export interface ProcedurePlanDoc {
  _id: Types.ObjectId;
  planNumber: string;
  patientId: Types.ObjectId;
  uhidSnapshot: string;
  planDate: string;
  startDate: string;
  endDate?: string;
  items: ProcedurePlanItem[];
  status: 'active' | 'completed' | 'cancelled';
  assignedTherapistId?: Types.ObjectId;
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const planItemSchema = new Schema<ProcedurePlanItem>(
  {
    procedureId: { type: Schema.Types.ObjectId, ref: 'ProcedureCatalog', required: true },
    nameSnapshot: { type: String, required: true },
    sessionsPlanned: { type: Number, required: true, min: 1 },
    sessionsCompleted: { type: Number, required: true, min: 0, default: 0 },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    taxRatePercent: { type: Number, required: true, min: 0, max: 28 },
  },
  { _id: false },
);

const planSchema = new Schema<ProcedurePlanDoc>(
  {
    planNumber: { type: String, required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    uhidSnapshot: { type: String, required: true },
    planDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    startDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    endDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    items: {
      type: [planItemSchema],
      validate: { validator: (i: unknown[]) => i.length > 0, message: 'A plan must contain at least one procedure' },
    },
    status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active', required: true },
    assignedTherapistId: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'procedurePlans' },
);

planSchema.index({ planNumber: 1 }, { unique: true });
planSchema.index({ patientId: 1, planDate: -1 });
planSchema.index({ status: 1, startDate: -1 });

export const ProcedurePlan = model<ProcedurePlanDoc, Model<ProcedurePlanDoc>>('ProcedurePlan', planSchema);

// ---------- ProcedureSession ----------
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'missed' | 'rescheduled';

export interface ProcedureSessionDoc {
  _id: Types.ObjectId;
  planId: Types.ObjectId;
  procedureId: Types.ObjectId;
  procedureNameSnapshot: string;
  patientId: Types.ObjectId;
  scheduledDate: string; // YYYY-MM-DD
  sessionIndex: number; // occurrence within the plan item
  status: SessionStatus;
  assignedTherapistId?: Types.ObjectId;
  notes?: string; // completed-session notes
  rescheduledTo?: string;
  completedAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<ProcedureSessionDoc>(
  {
    planId: { type: Schema.Types.ObjectId, ref: 'ProcedurePlan', required: true },
    procedureId: { type: Schema.Types.ObjectId, ref: 'ProcedureCatalog', required: true },
    procedureNameSnapshot: { type: String, required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    scheduledDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    sessionIndex: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled', 'missed', 'rescheduled'], default: 'scheduled', required: true },
    assignedTherapistId: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, maxlength: 1000 },
    rescheduledTo: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    completedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'procedureSessions' },
);

sessionSchema.index({ planId: 1, procedureId: 1, sessionIndex: 1 }, { unique: true });
sessionSchema.index({ scheduledDate: 1, status: 1 });
sessionSchema.index({ assignedTherapistId: 1, scheduledDate: 1 });
sessionSchema.index({ patientId: 1 });

export const ProcedureSession = model<ProcedureSessionDoc, Model<ProcedureSessionDoc>>('ProcedureSession', sessionSchema);

// ---------- ProcedureBill ----------
export interface ProcedureBillLine {
  planId: Types.ObjectId;
  procedureId: Types.ObjectId;
  nameSnapshot: string;
  sessionsCount: number; // number of sessions being charged
  unitPriceMinor: number;
  discountPercent: number;
  taxRatePercent: number;
  discountMinor: number;
  taxAmountMinor: number;
  lineTotalMinor: number;
}

export interface ProcedureBillDoc {
  _id: Types.ObjectId;
  billNumber: string;
  patientId: Types.ObjectId;
  uhidSnapshot: string;
  patientNameSnapshot: string;
  billDate: string;
  status: 'finalized' | 'cancelled';
  /** Bills are recorded as settled at creation (single-invoice model). */
  paymentMethod: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque' | 'other';
  lines: ProcedureBillLine[];
  subtotalMinor: number;
  discountTotalMinor: number;
  taxTotalMinor: number;
  totalMinor: number;
  issuedBy: Types.ObjectId;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const pbLineSchema = new Schema<ProcedureBillLine>(
  {
    planId: { type: Schema.Types.ObjectId, ref: 'ProcedurePlan', required: true },
    procedureId: { type: Schema.Types.ObjectId, ref: 'ProcedureCatalog', required: true },
    nameSnapshot: { type: String, required: true },
    sessionsCount: { type: Number, required: true, min: 1 },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, min: 0, max: 100, default: 0 },
    taxRatePercent: { type: Number, required: true, min: 0, max: 28 },
    discountMinor: { type: Number, required: true, min: 0 },
    taxAmountMinor: { type: Number, required: true, min: 0 },
    lineTotalMinor: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const procedureBillSchema = new Schema<ProcedureBillDoc>(
  {
    billNumber: { type: String, required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    uhidSnapshot: { type: String, required: true },
    patientNameSnapshot: { type: String, required: true },
    billDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: { type: String, enum: ['finalized', 'cancelled'], default: 'finalized', required: true },
    paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other'], default: 'cash', required: true },
    lines: {
      type: [pbLineSchema],
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
  { timestamps: true, collection: 'procedureBills' },
);

procedureBillSchema.index({ billNumber: 1 }, { unique: true });
procedureBillSchema.index({ patientId: 1, billDate: -1 });
procedureBillSchema.index({ billDate: 1, status: 1 });

export const ProcedureBill = model<ProcedureBillDoc, Model<ProcedureBillDoc>>('ProcedureBill', procedureBillSchema);
