/**
 * Date helpers anchored to the clinic timezone stored in ClinicSettings.
 * All "business dates" (token dates, report dates, financial days) are plain
 * YYYY-MM-DD strings resolved in the clinic timezone — never UTC.
 */
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns today's business date (YYYY-MM-DD) for the given IANA timezone. */
export function clinicToday(timezone = 'Asia/Kolkata'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, dateStyle: 'short' }).format(new Date());
}

/** Formats an absolute instant as a business date in the clinic timezone. */
export function clinicDateOf(instant: Date, timezone = 'Asia/Kolkata'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, dateStyle: 'short' }).format(instant);
}

export function isValidBusinessDate(value: string): boolean {
  if (!VALID_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Start/end instants covering `date` in the clinic timezone, as UTC Date objects. */
export function businessDayRange(date: string, timezone = 'Asia/Kolkata'): { start: Date; end: Date } {
  if (!isValidBusinessDate(date)) throw new Error(`Invalid business date: ${date}`);
  const startLocal = new Date(`${date}T00:00:00`);
  const startUtc = toUtcFromFakeLocal(startLocal, timezone);
  const endUtc = new Date(startUtc.getTime() + 24 * 3600 * 1000);
  return { start: startUtc, end: endUtc };
}

/**
 * Interprets y-m-d as wall-clock time in `timezone` and gives the UTC instant.
 * Uses offset probing to handle DST transitions.
 */
function toUtcFromFakeLocal(d: Date, timezone: string): Date {
  let ts = d.getTime() - tzOffsetMs(d.getTime(), timezone);
  for (let i = 0; i < 2; i++) {
    const corrected = d.getTime() - tzOffsetMs(ts, timezone);
    if (corrected === ts) break;
    ts = corrected;
  }
  return new Date(ts);
}

/** Offset in ms of `timezone` from UTC at the given instant. */
function tzOffsetMs(utcMs: number, timezone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asUtc - utcMs;
}
