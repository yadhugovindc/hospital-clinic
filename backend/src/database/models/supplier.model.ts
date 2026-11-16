import mongoose, { model, Model, Schema, Types } from 'mongoose';

export interface SupplierDoc {
  _id: Types.ObjectId;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const supplierSchema = new Schema<SupplierDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    contactPerson: { type: String, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 20 },
    email: { type: String, lowercase: true, trim: true, maxlength: 200 },
    address: { type: String, maxlength: 500 },
    gstNumber: { type: String, trim: true, uppercase: true, maxlength: 20 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'suppliers' },
);

supplierSchema.index({ name: 'text' });

export const Supplier = model<SupplierDoc, Model<SupplierDoc>>('Supplier', supplierSchema);
