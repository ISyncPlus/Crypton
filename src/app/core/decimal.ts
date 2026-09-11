/**
 * Minimal exact decimal arithmetic on strings, backed by BigInt with 18 fractional digits.
 * The server is authoritative for all money maths; the client only needs exact comparisons,
 * sums/differences (e.g. "max" = available - fee) and truncation to an asset's precision.
 */
const SCALE = 18;
const FACTOR = 10n ** BigInt(SCALE);

export type DecimalInput = string | number | null | undefined;

const PATTERN = /^\s*([+-])?(\d*)(?:\.(\d*))?\s*$/;

export function isDecimal(value: DecimalInput): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  const text = typeof value === 'number' ? numberToPlain(value) : value;
  const match = PATTERN.exec(text);
  return !!match && (match[2]?.length ?? 0) + (match[3]?.length ?? 0) > 0;
}

export function toUnits(value: DecimalInput): bigint {
  if (value === null || value === undefined || value === '') {
    return 0n;
  }

  const text = typeof value === 'number' ? numberToPlain(value) : value;
  const match = PATTERN.exec(text);
  if (!match || (match[2] ?? '') + (match[3] ?? '') === '') {
    throw new Error(`Invalid decimal: ${value}`);
  }

  const sign = match[1] === '-' ? -1n : 1n;
  const whole = BigInt(match[2] || '0');
  const fraction = (match[3] ?? '').slice(0, SCALE).padEnd(SCALE, '0');
  return sign * (whole * FACTOR + BigInt(fraction || '0'));
}

export function fromUnits(units: bigint): string {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const whole = abs / FACTOR;
  const fraction = (abs % FACTOR).toString().padStart(SCALE, '0').replace(/0+$/, '');
  return `${negative && abs !== 0n ? '-' : ''}${whole}${fraction ? '.' + fraction : ''}`;
}

export const add = (a: DecimalInput, b: DecimalInput) => fromUnits(toUnits(a) + toUnits(b));
export const sub = (a: DecimalInput, b: DecimalInput) => fromUnits(toUnits(a) - toUnits(b));
export const cmp = (a: DecimalInput, b: DecimalInput) => {
  const d = toUnits(a) - toUnits(b);
  return d === 0n ? 0 : d > 0n ? 1 : -1;
};
export const gt = (a: DecimalInput, b: DecimalInput) => cmp(a, b) > 0;
export const gte = (a: DecimalInput, b: DecimalInput) => cmp(a, b) >= 0;
export const lt = (a: DecimalInput, b: DecimalInput) => cmp(a, b) < 0;
export const isZero = (a: DecimalInput) => toUnits(a) === 0n;
export const max = (a: DecimalInput, b: DecimalInput) => (gte(a, b) ? fromUnits(toUnits(a)) : fromUnits(toUnits(b)));

/** Multiply two decimals, truncating to 18 fractional digits. */
export function mul(a: DecimalInput, b: DecimalInput): string {
  return fromUnits((toUnits(a) * toUnits(b)) / FACTOR);
}

/** Divide, truncating to 18 fractional digits. Returns "0" when dividing by zero. */
export function div(a: DecimalInput, b: DecimalInput): string {
  const divisor = toUnits(b);
  return divisor === 0n ? '0' : fromUnits((toUnits(a) * FACTOR) / divisor);
}

/** Truncate toward zero to the given number of decimals. */
export function truncate(value: DecimalInput, decimals: number): string {
  const step = 10n ** BigInt(SCALE - Math.max(0, Math.min(SCALE, decimals)));
  const units = toUnits(value);
  return fromUnits((units / step) * step);
}

export function decimalPlaces(value: string): number {
  const fraction = value.split('.')[1] ?? '';
  return fraction.replace(/0+$/, '').length;
}

export function toNumber(value: DecimalInput): number {
  return Number(fromUnits(toUnits(value)));
}

function numberToPlain(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid number: ${value}`);
  }

  return value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 18 });
}
