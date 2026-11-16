import mongoose, { model, Model, Schema, Types } from 'mongoose';

export interface DepartmentDoc {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<DepartmentDoc>(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 120 },
    description: { type: String, maxlength: 500 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'departments' },
);

export const Department = model<DepartmentDoc, Model<DepartmentDoc>>('Department', departmentSchema);
