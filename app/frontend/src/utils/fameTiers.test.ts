/**
 * Unit tests for fameTiers — fame tier calculation.
 */
import { describe, it, expect } from 'vitest';
import { getFameTier } from './fameTiers';

describe('getFameTier', () => {
  it('should return Unknown for fame < 100', () => {
    expect(getFameTier(0)).toBe('Unknown');
    expect(getFameTier(50)).toBe('Unknown');
    expect(getFameTier(99)).toBe('Unknown');
  });

  it('should return Known for fame 100-499', () => {
    expect(getFameTier(100)).toBe('Known');
    expect(getFameTier(499)).toBe('Known');
  });

  it('should return Famous for fame 500-999', () => {
    expect(getFameTier(500)).toBe('Famous');
    expect(getFameTier(999)).toBe('Famous');
  });

  it('should return Renowned for fame 1000-2499', () => {
    expect(getFameTier(1000)).toBe('Renowned');
    expect(getFameTier(2499)).toBe('Renowned');
  });

  it('should return Legendary for fame 2500-4999', () => {
    expect(getFameTier(2500)).toBe('Legendary');
    expect(getFameTier(4999)).toBe('Legendary');
  });

  it('should return Mythical for fame >= 5000', () => {
    expect(getFameTier(5000)).toBe('Mythical');
    expect(getFameTier(99999)).toBe('Mythical');
  });
});
