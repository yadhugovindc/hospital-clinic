import mongoose, { model, Model, Schema, Types } from 'mongoose';

export type ExpenseCategory =
  | 'salary'
  | 'rent'
  | 'utilities'
  | 'purchase'
  | 'maintenance'
  | 'marketing'
  | 'miscellaneous'
  | 'other';

export interface ExpenseDoc {
  _id: Types.ObjectId;
  expenseNumber: string;
  category: ExpenseCategory;
  description: string;
  amountMinor: number;
  expenseDate: string; // YYYY-MM-DD
  paymentMethod: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque' | 'other';
  reference?: string;
  recordedBy: Types.ObjectId;
  reversedBy?: Types.ObjectId;
  reversalReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<ExpenseDoc>(
  {
    expenseNumber: { type: String, required: true },
    category: {
      type: String,
      enum: ['salary', 'rent', 'utilities', 'purchase', 'maintenance', 'marketing', 'miscellaneous', 'other'],
      required: true,
    },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    amountMinor: { type: Number, required: true, min: 1 },
    expenseDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other'], required: true },
    reference: { type: String, maxlength: 200 },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reversedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reversalReason: { type: String, maxlength: 500 },
  },
  { timestamps: true, collection: 'expenses' },
);

expenseSchema.index({ expenseDate: 1, category: 1 });
expenseSchema.index({ expenseNumber: 1 }, { unique: true });

export const Expense = model<ExpenseDoc, Model<ExpenseDoc>>('Expense', expenseSchema);
