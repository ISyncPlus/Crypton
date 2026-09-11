import { AssetCode } from './models';
import { DecimalInput, fromUnits, toUnits, truncate } from './decimal';

export const ASSET_META: Record<AssetCode, { name: string; precision: number; display: number; symbol?: string }> = {
  BTC: { name: 'Bitcoin', precision: 8, display: 8 },
  ETH: { name: 'Ethereum', precision: 8, display: 6 },
  USDT: { name: 'Tether USD', precision: 6, display: 2 },
  NGN: { name: 'Nigerian Naira', precision: 2, display: 2, symbol: '₦' },
};

/** Groups the integer part with commas without going through floating point. */
export function groupDigits(value: string): string {
  const negative = value.startsWith('-');
  const [whole, fraction] = (negative ? value.slice(1) : value).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${fraction !== undefined ? '.' + fraction : ''}`;
}

/** Formats a decimal with fixed fraction digits (truncating, never rounding up money). */
export function fixed(value: DecimalInput, digits: number, trimZeros = false): string {
  const text = truncate(value ?? '0', digits);
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  let frac = fraction.padEnd(digits, '0');
  if (trimZeros) {
    frac = frac.replace(/0+$/, '');
  }

  const negative = text.startsWith('-') && toUnits(text) !== 0n;
  return `${negative ? '-' : ''}${groupDigits(whole)}${frac ? '.' + frac : ''}`;
}

export function formatAsset(value: DecimalInput, asset: AssetCode, options: { trim?: boolean; code?: boolean; full?: boolean } = {}): string {
  const meta = ASSET_META[asset];
  const digits = options.full ? meta.precision : meta.display;
  const body = fixed(value, digits, options.trim ?? asset !== 'NGN');
  if (asset === 'NGN') {
    return options.code ? `${body} NGN` : `₦${body}`;
  }

  return options.code === false ? body : `${body} ${asset}`;
}

export function formatNgn(value: DecimalInput, digits = 2): string {
  return `₦${fixed(value, digits)}`;
}

/** Compact naira for dashboards: ₦1.25M, ₦830.4K. */
export function compactNgn(value: DecimalInput): string {
  const n = Number(fromUnits(toUnits(value)));
  const abs = Math.abs(n);
  const units: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) {
      return `₦${(n / size).toFixed(abs / size >= 100 ? 0 : abs / size >= 10 ? 1 : 2)}${suffix}`;
    }
  }

  return `₦${n.toFixed(2)}`;
}

export function percent(value: DecimalInput, digits = 2): string {
  const n = Number(fromUnits(toUnits(value)));
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

export function shortAddress(value: string | null | undefined, head = 8, tail = 6): string {
  if (!value) {
    return '';
  }

  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}

const dateFormatter = new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('en-NG', { hour: '2-digit', minute: '2-digit' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export const formatDate = (iso: string | null | undefined) => (iso ? dateFormatter.format(new Date(iso)) : '');
export const formatTime = (iso: string | null | undefined) => (iso ? timeFormatter.format(new Date(iso)) : '');
export const formatDateTime = (iso: string | null | undefined) => (iso ? dateTimeFormatter.format(new Date(iso)) : '');

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) {
    return '';
  }

  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 60) return rtf.format(seconds, 'second');
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  return rtf.format(Math.round(seconds / 86400), 'day');
}

export function humanize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}
