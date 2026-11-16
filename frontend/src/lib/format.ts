// Helpers; used throughout the app.

export function titleCase(value: string | undefined | null): string {
  if (!value) return '';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function money(amountMinor: number, currency = 'INR'): string {
  const n = new Intl.NumberFormat('en-IN', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' });
  return n.format(amountMinor / 100);
}

export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function patientAge(patient: { ageYears?: number | null; dateOfBirth?: string | null }): string {
  if (patient.ageYears != null) return `${patient.ageYears} yrs`;
  if (patient.dateOfBirth) {
    const dob = new Date(patient.dateOfBirth);
    const age = Math.floor((Date.now() - dob.getTime()) / (365 * 24 * 3600 * 1000));
    return `${age} yrs`;
  }
  return '—';
}
