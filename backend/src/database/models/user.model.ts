import mongoose, { model, Model, Schema } from 'mongoose';
import type { Role } from '../../shared/utils/rbac.js';

export interface UserDoc {
  _id: mongoose.Types.ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'receptionist', 'doctor', 'pharmacist', 'therapist', 'accountant'], required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'users' },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, isActive: 1 });

export const User = model<UserDoc, Model<UserDoc>>('User', userSchema);
