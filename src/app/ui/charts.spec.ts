import { niceStep, niceTicks } from './charts';

describe('chart axes', () => {
  it('rounds steps to readable values', () => {
    expect(niceStep(0.7)).toBe(1);
    expect(niceStep(1.6)).toBe(2);
    expect(niceStep(2.2)).toBe(2.5);
    expect(niceStep(3.3)).toBe(5);
    expect(niceStep(7)).toBe(10);
    expect(niceStep(925_000)).toBe(1_000_000);
  });

  it('covers the data with clean ticks', () => {
    expect(niceTicks(0, 95, 2)).toEqual([0, 50, 100]);
    expect(niceTicks(152_345_000, 155_120_000, 3)).toEqual([152_000_000, 153_000_000, 154_000_000, 155_000_000, 156_000_000]);
    const flat = niceTicks(1000, 1000, 3);
    expect(flat[0]).toBeLessThan(1000);
    expect(flat[flat.length - 1]).toBeGreaterThan(1000);
  });
});
