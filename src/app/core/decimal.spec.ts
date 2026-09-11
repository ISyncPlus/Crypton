import { add, cmp, div, fromUnits, isDecimal, mul, sub, toUnits, truncate } from './decimal';
import { fixed, formatAsset, groupDigits } from './format';

describe('decimal', () => {
  it('parses and prints without floating point error', () => {
    expect(fromUnits(toUnits('0.1'))).toBe('0.1');
    expect(add('0.1', '0.2')).toBe('0.3');
    expect(sub('1', '0.00000001')).toBe('0.99999999');
    expect(add('-5', '2.5')).toBe('-2.5');
  });

  it('compares exactly', () => {
    expect(cmp('1.000000000000000001', '1')).toBe(1);
    expect(cmp('0.5', '0.50')).toBe(0);
    expect(cmp('-1', '0')).toBe(-1);
  });

  it('truncates to precision toward zero', () => {
    expect(truncate('1.23456789', 4)).toBe('1.2345');
    expect(truncate('-1.99', 1)).toBe('-1.9');
    expect(truncate('5', 2)).toBe('5');
  });

  it('multiplies and divides', () => {
    expect(mul('0.005', '147250000')).toBe('736250');
    expect(div('156000', '1560')).toBe('100');
    expect(div('1', '0')).toBe('0');
  });

  it('validates input', () => {
    expect(isDecimal('12.5')).toBe(true);
    expect(isDecimal('.5')).toBe(true);
    expect(isDecimal('abc')).toBe(false);
    expect(isDecimal('')).toBe(false);
    expect(isDecimal('1.2.3')).toBe(false);
  });
});

describe('format', () => {
  it('groups digits', () => {
    expect(groupDigits('1234567.89')).toBe('1,234,567.89');
    expect(groupDigits('-1000')).toBe('-1,000');
  });

  it('formats fixed digits without rounding up', () => {
    expect(fixed('1999.999', 2)).toBe('1,999.99');
    expect(fixed('0.1', 4)).toBe('0.1000');
  });

  it('formats assets', () => {
    expect(formatAsset('2500000', 'NGN')).toBe('₦2,500,000.00');
    expect(formatAsset('0.05000000', 'BTC')).toBe('0.05 BTC');
    expect(formatAsset('0.00012345', 'BTC', { full: true })).toBe('0.00012345 BTC');
  });
});
