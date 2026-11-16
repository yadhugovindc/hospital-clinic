// Shared money helpers.
// All money amounts are stored as integers in minor currency units (paise).
// Avoids floating point rounding errors entirely.

/** Rounds a float amount (e.g. 12.99 rupees) to nearest minor unit. Dangerous if used on aggregated floats; prefer integer math end-to-end. */
export function roundToMinorUnit(decimalAmount: number): number {
  return Math.round(decimalAmount * 100);
}

/** Adds amounts guaranteed to be integers in minor units. Throws on non-integer input so a caller bug surfaces early. */
export function addMinor(...amounts: number[]): number {
  let total = 0;
  for (const amount of amounts) {
    if (!Number.isSafeInteger(amount)) {
      throw new TypeError(`Money amounts must be integers in minor units, got: ${amount}`);
    }
    total += amount;
  }
  return total;
}

/**
 * Allocates a discount across lines whose line totals sum to `totalAmount` such
 * that the sum of allocations equals exactly `discountAmount` (largest-remainder).
 */
export function allocateAmount(totalAmount: number, discountAmount: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  if (sumWeights <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => Math.floor((discountAmount * w) / sumWeights));
  let remainder = discountAmount - raw.reduce((a, b) => a + b, 0);
  // Distribute remainder one unit at a time to the numerically largest parts.
  const order = weights
    .map((w, i) => [i, (discountAmount * w) / sumWeights - Math.floor((discountAmount * w) / sumWeights)] as const)
    .sort((a, b) => b[1] - a[1]);
  let k = 0;
  while (remainder > 0) {
    const idx = order[k % order.length]![0];
    raw[idx] = raw[idx]! + 1;
    remainder -= 1;
    k += 1;
  }
  return raw;
}

/** Formats a paise amount as a currency string using clinic currency symbol (default INR ₹). */
export function formatMoney(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount / 100);
}

/** Percent for display, e.g. taxRate stored as 5 => "5%". Rates are stored as percent integers (or decimals up to 2dp). */
export function formatPercent(rate: number): string {
  return `${rate}%`;
}
