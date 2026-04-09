import { describe, it, expect } from 'vitest';
import { formatCurrency, formatCost, formatNumber, getLeagueColor } from '../formatters';

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

describe('formatCost', () => {
  it('should show full amount below 1K', () => {
    expect(formatCost(500)).toBe('₡500');
  });

  it('should show K suffix for 1K-999K', () => {
    expect(formatCost(5000)).toBe('₡5K');
  });

  it('should show K suffix at exactly 1000', () => {
    expect(formatCost(1000)).toBe('₡1K');
  });

  it('should show M suffix with one decimal for 1M+', () => {
    expect(formatCost(1500000)).toBe('₡1.5M');
  });

  it('should show M suffix at exactly 1M', () => {
    expect(formatCost(1000000)).toBe('₡1.0M');
  });

  it('should show full amount at 999', () => {
    expect(formatCost(999)).toBe('₡999');
  });
});

describe('formatNumber', () => {
  it('should return a string representation of the number', () => {
    const result = formatNumber(1500);
    expect(typeof result).toBe('string');
    // toLocaleString output varies by environment; just verify it contains the digits
    expect(result.replace(/\D/g, '')).toBe('1500');
  });

  it('should handle zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

describe('getLeagueColor', () => {
  it('should return text-purple-400 for champion', () => {
    expect(getLeagueColor('champion')).toBe('text-purple-400');
  });

  it('should return text-cyan-400 for diamond', () => {
    expect(getLeagueColor('diamond')).toBe('text-cyan-400');
  });

  it('should return text-blue-400 for platinum', () => {
    expect(getLeagueColor('platinum')).toBe('text-blue-400');
  });

  it('should return text-yellow-400 for gold', () => {
    expect(getLeagueColor('gold')).toBe('text-yellow-400');
  });

  it('should return text-gray-300 for silver', () => {
    expect(getLeagueColor('silver')).toBe('text-gray-300');
  });

  it('should return text-orange-600 for bronze', () => {
    expect(getLeagueColor('bronze')).toBe('text-orange-600');
  });

  it('should return text-gray-400 for unknown league', () => {
    expect(getLeagueColor('unknown')).toBe('text-gray-400');
    expect(getLeagueColor('')).toBe('text-gray-400');
  });
});
