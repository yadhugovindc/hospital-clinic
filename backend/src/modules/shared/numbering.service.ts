import { ClinicSettings } from '../../database/models/clinic-settings.model.js';

export type NumberKind = 'pharmacy' | 'procedure' | 'purchase' | 'expense';

/**
 * Atomically allocates the next sequential number for a document type
 * (concurrency-safe via $inc) and formats it as PREFIX-YYYY-000001.
 * The year is stamped from the issue date so numbering rolls per document
 * type, and sequences are never derived by counting documents.
 */
export async function nextDocumentNumber(kind: NumberKind, issueDate: string): Promise<string> {
  const settings = await ClinicSettings.findOne();
  if (!settings) throw new Error('Clinic settings not initialized');

  const group = settings.invoicePrefixes[kind] ?? { prefix: kind.toUpperCase(), nextNumber: 1 };
  const prefix = group.prefix || kind.toUpperCase();
  const year = issueDate.slice(0, 4);

  // Atomic increment directly in the settings document.
  const updated = await ClinicSettings.findOneAndUpdate(
    {},
    { $inc: { [`invoicePrefixes.${kind}.nextNumber`]: 1 } },
    { new: true },
  );
  const seq = (updated?.invoicePrefixes[kind]?.nextNumber ?? 1) - 1;
  if (seq < 1) throw new Error(`Failed to allocate ${kind} number`);
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
}
