import { ClinicSettings, type ClinicSettingsDoc } from '../../database/models/clinic-settings.model.js';
import { NotFoundError } from '../../shared/errors/api-error.js';
import { recordAudit } from '../../database/models/audit-log.model.js';
import { Types } from 'mongoose';

/** Returns the singleton settings document, seeding it on first access. */
export async function getSettings() {
  await seedSettings();
  const settings = await ClinicSettings.findOne();
  if (!settings) throw new NotFoundError('Clinic settings not initialized');
  return settings;
}

export async function seedSettings(): Promise<void> {
  const exists = await ClinicSettings.countDocuments();
  if (exists === 0) {
    await ClinicSettings.create({
      clinicName: 'Ayurvedic Clinic',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      defaultTaxRatePercent: 0,
      consultationFeeMinor: 30000, // ₹300.00 default consultation charge
    });
  }
}

const EDITABLE_FIELDS = ['clinicName', 'address', 'phone', 'email', 'logoText', 'timezone', 'currency', 'gstinNumber', 'defaultTaxRatePercent', 'consultationFeeMinor', 'gstRates'] as const;
export type EditableSettings = Partial<Record<(typeof EDITABLE_FIELDS)[number], unknown>>;

export async function updateSettings(
  input: Record<string, unknown>,
  actorId: string,
  actorEmail: string,
): Promise<ClinicSettingsDoc> {
  const settings = await getSettings();
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  for (const field of EDITABLE_FIELDS) {
    if (field in input && input[field] !== undefined) {
      const current = (settings as unknown as Record<string, unknown>)[field];
      before[field] = field === 'gstRates' && current instanceof Map ? Object.fromEntries(current as Map<string, number>) : current;
      (settings as unknown as Record<string, unknown>)[field] = input[field];
      after[field] = input[field];
    }
  }
  // prefix renaming affects only new documents; nextNumber counters are never rewound
  if (input.invoicePrefixes && typeof input.invoicePrefixes === 'object') {
    const prefixes = input.invoicePrefixes as Record<string, { prefix?: string }>;
    for (const [kind, value] of Object.entries(prefixes)) {
      if (value && typeof value.prefix === 'string' && value.prefix.length <= 10) {
        const group = settings.invoicePrefixes[kind as keyof ClinicSettingsDoc['invoicePrefixes']];
        if (group) group.prefix = value.prefix;
      }
    }
  }

  settings.updatedBy = new Types.ObjectId(actorId) as never;
  await settings.save();
  recordAudit({ actorId: new Types.ObjectId(actorId) as never, actorEmail, action: 'clinic.update', entityType: 'ClinicSettings', entityId: String(settings._id), before, after } as never);
  return settings;
}
