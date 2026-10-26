/**
 * Unit tests for pure (non-database) admin service functions.
 * Tests calculateStats.
 */

import { calculateStats } from '../src/services/admin/adminStatsService';

// ── calculateStats ───────────────────────────────────────────────────

describe('calculateStats', () => {
  it('should return null for an empty array', () => {
    expect(calculateStats([])).toBeNull();
  });

  it('should handle a single value', () => {
    const result = calculateStats([10]);
    expect(result).not.toBeNull();
    expect(result!.mean).toBe(10);
    expect(result!.median).toBe(10);
    expect(result!.min).toBe(10);
    expect(result!.max).toBe(10);
    expect(result!.stdDev).toBe(0);
  });

  it('should calculate correct stats for multiple values', () => {
    const values = [2, 4, 6, 8, 10];
    const result = calculateStats(values)!;

    expect(result.mean).toBe(6);
    expect(result.median).toBe(6);
    expect(result.min).toBe(2);
    expect(result.max).toBe(10);
  });

  it('should calculate correct median for even-length arrays', () => {
    const result = calculateStats([1, 3, 5, 7])!;
    // median of [1,3,5,7] = (3+5)/2 = 4
    expect(result.median).toBe(4);
  });

  it('should calculate standard deviation', () => {
    // stdDev of [2, 4, 4, 4, 5, 5, 7, 9] = 2.0
    const result = calculateStats([2, 4, 4, 4, 5, 5, 7, 9])!;
    expect(result.stdDev).toBe(2);
  });

  it('should calculate quartiles, IQR, and bounds', () => {
    // sorted: [1, 2, 3, 4, 5, 6, 7, 8]
    const values = [1, 2, 3, 4, 5, 6, 7, 8];
    const result = calculateStats(values)!;

    // q1Index = floor(8 * 0.25) = 2 → sorted[2] = 3
    expect(result.q1).toBe(3);
    // q3Index = floor(8 * 0.75) = 6 → sorted[6] = 7
    expect(result.q3).toBe(7);
    // iqr = 7 - 3 = 4
    expect(result.iqr).toBe(4);
    // lowerBound = 3 - 1.5*4 = -3
    expect(result.lowerBound).toBe(-3);
    // upperBound = 7 + 1.5*4 = 13
    expect(result.upperBound).toBe(13);
  });

  it('should return numbers rounded to 2 decimal places', () => {
    const result = calculateStats([1, 2, 3])!;
    // mean = 2, median = 2, stdDev = sqrt(2/3) ≈ 0.82
    expect(typeof result.mean).toBe('number');
    expect(typeof result.stdDev).toBe('number');
    // Verify rounding: stdDev of [1,2,3] = sqrt(((1-2)^2+(2-2)^2+(3-2)^2)/3) = sqrt(2/3) ≈ 0.8165
    expect(result.stdDev).toBe(0.82);
  });
});
