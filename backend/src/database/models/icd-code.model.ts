import mongoose, { model, Model, Schema, Types } from 'mongoose';

export interface IcdCodeDoc {
  _id: Types.ObjectId;
  code: string;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const icdSchema = new Schema<IcdCodeDoc>(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String, required: true, trim: true, maxlength: 300 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'icdCodes' },
);

icdSchema.index({ code: 1 }, { unique: true });
icdSchema.index({ description: 'text' });

export const IcdCode = model<IcdCodeDoc, Model<IcdCodeDoc>>('IcdCode', icdSchema);
