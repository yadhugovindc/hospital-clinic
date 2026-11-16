import mongoose, { model, Model, Schema, Types } from 'mongoose';

export type StockMovementType =
  | 'purchase'
  | 'dispense'
  | 'sale_return'
  | 'purchase_cancel'
  | 'adjustment'
  | 'correction';

export interface StockMovementDoc {
  _id: Types.ObjectId;
  medicineId: Types.ObjectId;
  batchId: Types.ObjectId;
  batchNumberSnapshot: string;
  type: StockMovementType;
  quantityChange: number; // positive adds stock, negative removes
  reason?: string;
  refBillId?: Types.ObjectId;
  refBillModel?: 'PharmacyBill' | 'Purchase';
  refPurchaseId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const stockMovementSchema = new Schema<StockMovementDoc>(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'StockBatch', required: true },
    batchNumberSnapshot: { type: String, required: true, maxlength: 100 },
    type: { type: String, enum: ['purchase', 'dispense', 'sale_return', 'purchase_cancel', 'adjustment', 'correction'], required: true },
    quantityChange: { type: Number, required: true },
    reason: { type: String, maxlength: 500 },
    refBillId: { type: Schema.Types.ObjectId, refPath: 'refBillModel' },
    refBillModel: { type: String, enum: ['PharmacyBill', 'Purchase'] },
    refPurchaseId: { type: Schema.Types.ObjectId, ref: 'Purchase' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'stockMovements' },
);

stockMovementSchema.index({ medicineId: 1, createdAt: -1 });
stockMovementSchema.index({ batchId: 1, createdAt: -1 });

export const StockMovement = model<StockMovementDoc, Model<StockMovementDoc>>('StockMovement', stockMovementSchema);
