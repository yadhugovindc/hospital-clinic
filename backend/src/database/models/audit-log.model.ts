import mongoose, { model, Model, Schema, Types } from 'mongoose';

export interface AuditLogDoc {
  _id: Types.ObjectId;
  actorId?: Types.ObjectId;
  actorEmail?: string;
  action: string; // e.g. "user.create", "bill.cancel", "stock.adjust"
  entityType: string; // e.g. "User", "PharmacyBill"
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
}

const auditSchema = new Schema<AuditLogDoc>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorEmail: { type: String },
    action: { type: String, required: true, maxlength: 100 },
    entityType: { type: String, required: true, maxlength: 60 },
    entityId: { type: String },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ip: { type: String, maxlength: 60 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'auditLogs' },
);

auditSchema.index({ createdAt: -1 });
auditSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditSchema.index({ actorId: 1, createdAt: -1 });

export const AuditLog = model<AuditLogDoc, Model<AuditLogDoc>>('AuditLog', auditSchema);

/** Fire-and-forget audit write. Failures are logged, never thrown into request paths. */
export function recordAudit(entry: Omit<AuditLogDoc, '_id' | 'createdAt'>): void {
  AuditLog.create(entry).catch((err) => {
    // Avoid circular import; log inline.
    // eslint-disable-next-line no-console
    console.error('audit write failed', err);
  });
}
