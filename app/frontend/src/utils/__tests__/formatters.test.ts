import { describe, it, expect } from 'vitest';
import { formatCurrency, ordinal } from '../formatters';

describe('formatCurrency', () => {
  it('should format a positive number with ₡ prefix and locale separator', () => {
    expect(formatCurrency(1500)).toBe('₡1,500');
  });

  it('should format zero as ₡0', () => {
    expect(formatCurrency(0)).toBe('₡0');
  });

  it('should format negative numbers with ₡ prefix', () => {
    const result = formatCurrency(-1500);
    expect(result).toMatch(/^₡-/);
  });

  it('should return ₡0 for NaN', () => {
    expect(formatCurrency(NaN)).toBe('₡0');
  });

  it('should return ₡0 for undefined coerced to number', () => {
    expect(formatCurrency(undefined as unknown as number)).toBe('₡0');
  });
});

describe('ordinal', () => {
  it('writes ordinals, including the 11th–13th exceptions', () => {
    expect([1, 2, 3, 4, 10, 11, 12, 13, 21, 22, 23, 101, 102, 111, 112].map(ordinal))
      .toEqual(['1st', '2nd', '3rd', '4th', '10th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '102nd', '111th', '112th']);
  });
});
