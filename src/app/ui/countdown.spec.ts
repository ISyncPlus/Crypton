import { statusInfo } from '../core/labels';
import { formatDuration, remainingMs } from './countdown';

describe('countdown helpers', () => {
  it('formats remaining time', () => {
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(9_000)).toBe('0:09');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
    expect(formatDuration(0)).toBe('0:00');
  });

  it('never goes negative', () => {
    const deadline = new Date(1_000_000).toISOString();
    expect(remainingMs(deadline, 1_000_500)).toBe(0);
    expect(remainingMs(deadline, 999_000)).toBe(1_000);
    expect(remainingMs(null, 0)).toBe(0);
  });
});

describe('status labels', () => {
  it('uses plain words and falls back gracefully', () => {
    expect(statusInfo('p2pOrder', 'Paid')).toEqual({ label: 'Paid, awaiting release', tone: 'info', live: true });
    expect(statusInfo('cryptoWithdrawal', 'NeedsAttention').tone).toBe('warn');
    expect(statusInfo('deposit', 'SomethingNew').label).toBe('Something New');
  });
});
