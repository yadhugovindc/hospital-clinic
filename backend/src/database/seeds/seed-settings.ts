import { ClinicSettings } from '../models/clinic-settings.model.js';

/** Seeds the singleton settings document if missing. Idempotent; never overwrites existing settings. */
export async function seedSettings(): Promise<void> {
  const count = await ClinicSettings.countDocuments();
  if (count === 0) {
    await ClinicSettings.create({
      clinicName: 'Ayurvedic Clinic',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      defaultTaxRatePercent: 0,
      consultationFeeMinor: 30000,
    });
  }
}
