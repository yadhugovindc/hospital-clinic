import mongoose, { model, Model, Schema, Types } from 'mongoose';

export type TokenStatus = 'waiting' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show';

export interface TokenDoc {
  _id: Types.ObjectId;
  tokenDate: string; // YYYY-MM-DD in clinic timezone
  tokenNumber: number;
  patientId: Types.ObjectId;
  departmentId?: Types.ObjectId;
  doctorId?: Types.ObjectId;
  status: TokenStatus;
  note?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const tokenSchema = new Schema<TokenDoc>(
  {
    tokenDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    tokenNumber: { type: Number, required: true, min: 1 },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['waiting', 'in_consultation', 'completed', 'cancelled', 'no_show'],
      default: 'waiting',
      required: true,
    },
    note: { type: String, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'tokens' },
);

// Unique token number within a given clinic day.
tokenSchema.index({ tokenDate: 1, tokenNumber: 1 }, { unique: true });
tokenSchema.index({ tokenDate: 1, status: 1 });
tokenSchema.index({ doctorId: 1, tokenDate: 1, status: 1 });
tokenSchema.index({ patientId: 1, tokenDate: 1 });

export const Token = model<TokenDoc, Model<TokenDoc>>('Token', tokenSchema);
