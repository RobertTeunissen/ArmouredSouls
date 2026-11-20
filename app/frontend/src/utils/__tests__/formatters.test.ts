import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../formatters';

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
