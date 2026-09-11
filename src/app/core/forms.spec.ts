import { checkAmount, errorsMessage, parseAmount } from './forms';

describe('parseAmount', () => {
  it('normalises typed amounts', () => {
    expect(parseAmount('1,250.50')).toBe('1250.50');
    expect(parseAmount(' 0012 ')).toBe('12');
    expect(parseAmount('.5')).toBe('0.5');
    expect(parseAmount('7.')).toBe('7');
    expect(parseAmount('0.00000001')).toBe('0.00000001');
  });

  it('rejects anything that is not a plain positive number', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('1e5')).toBeNull();
    expect(parseAmount('1.2.3')).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });
});

describe('checkAmount', () => {
  it('treats empty input as not yet an error', () => {
    expect(checkAmount('', 2)).toBeNull();
  });

  it('enforces precision, positivity and bounds exactly', () => {
    expect(checkAmount('0', 8)).toEqual({ positive: true });
    expect(checkAmount('0.123456789', 8)).toEqual({ decimals: 8 });
    expect(checkAmount('0.12345678', 8)).toBeNull();
    expect(checkAmount('999.99', 2, '1000')).toEqual({ min: '1000' });
    expect(checkAmount('1000', 2, '1000', '5000')).toBeNull();
    expect(checkAmount('5000.01', 2, '1000', '5000')).toEqual({ max: '5000' });
    expect(checkAmount('1.50', 1)).toBeNull();
  });

  it('turns errors into plain sentences', () => {
    expect(errorsMessage({ decimals: 0 })).toBe('Use whole numbers only.');
    expect(errorsMessage({ decimals: 6 })).toBe('Use at most 6 decimal places.');
    expect(errorsMessage(null)).toBeNull();
  });
});
