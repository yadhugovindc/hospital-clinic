import mongoose, { model, Model, Schema, Types } from 'mongoose';

export interface InvoicePrefixConfig {
  pharmacy: { prefix: string; nextNumber: number };
  procedure: { prefix: string; nextNumber: number };
  purchase: { prefix: string; nextNumber: number };
  expense: { prefix: string; nextNumber: number };
}

export interface ClinicSettingsDoc {
  _id: Types.ObjectId;
  clinicName: string;
  address?: string;
  phone?: string;
  email?: string;
  logoText?: string;
  currency: string; // e.g. "INR"
  timezone: string; // e.g. "Asia/Kolkata" — used for daily queues, reports, financial dates
  gstinNumber?: string;
  gstRates: Record<string, number>; // configurable GST slabs, e.g. { "gst5": 5, "gst12": 12 }
  defaultTaxRatePercent: number;
  invoicePrefixes: InvoicePrefixConfig;
  consultationFeeMinor: number;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const prefixGroup = (prefix: string) => ({ prefix, nextNumber: 1 });

const clinicSettingsSchema = new Schema<ClinicSettingsDoc>(
  {
    clinicName: { type: String, required: true, maxlength: 200 },
    address: { type: String, maxlength: 500 },
    phone: { type: String, maxlength: 20 },
    email: { type: String, lowercase: true, trim: true, maxlength: 200 },
    logoText: { type: String, maxlength: 30 },
    currency: { type: String, default: 'INR', maxlength: 3 },
    timezone: { type: String, default: 'Asia/Kolkata', maxlength: 60 },
    gstinNumber: { type: String, uppercase: true, maxlength: 20 },
    gstRates: {
      type: Schema.Types.Mixed,
      default: { gst0: 0, gst5: 5, gst12: 12, gst18: 18, gst28: 28 },
    },
    defaultTaxRatePercent: { type: Number, min: 0, max: 28, default: 0 },
    consultationFeeMinor: { type: Number, min: 0, default: 0 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'clinicSettings' },
);

clinicSettingsSchema.add({
  invoicePrefixes: {
    pharmacy: { prefix: { type: String, default: 'PH' }, nextNumber: { type: Number, default: 1, min: 1 } },
    procedure: { prefix: { type: String, default: 'PR' }, nextNumber: { type: Number, default: 1, min: 1 } },
    purchase: { prefix: { type: String, default: 'PUR' }, nextNumber: { type: Number, default: 1, min: 1 } },
    expense: { prefix: { type: String, default: 'EXP' }, nextNumber: { type: Number, default: 1, min: 1 } },
  },
});

clinicSettingsSchema.index({ clinicName: 1 });

export const ClinicSettings = model<ClinicSettingsDoc, Model<ClinicSettingsDoc>>('ClinicSettings', clinicSettingsSchema);
