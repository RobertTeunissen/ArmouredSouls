import { describe, it, expect } from 'vitest';
import {
  getWeaponOptimalRange,
  getRangeBandColor,
  getRangeBandBgColor,
  getRangeBandLabel,
  type WeaponLike,
  type RangeBand,
} from '../weaponRange';

describe('getWeaponOptimalRange', () => {
  it('should return the stored rangeBand value directly', () => {
    const bands: RangeBand[] = ['melee', 'short', 'mid', 'long'];
    for (const band of bands) {
      const weapon: WeaponLike = { name: `Test ${band}`, rangeBand: band };
      expect(getWeaponOptimalRange(weapon)).toBe(band);
    }
  });
});

describe('getRangeBandColor', () => {
  it('should return text-red-400 for melee', () => {
    expect(getRangeBandColor('melee')).toBe('text-red-400');
  });

  it('should return text-yellow-400 for short', () => {
    expect(getRangeBandColor('short')).toBe('text-yellow-400');
  });

  it('should return text-green-400 for mid', () => {
    expect(getRangeBandColor('mid')).toBe('text-green-400');
  });

  it('should return text-blue-400 for long', () => {
    expect(getRangeBandColor('long')).toBe('text-blue-400');
  });
});

describe('getRangeBandBgColor', () => {
  it('should return bg-red-900/40 border-red-600 for melee', () => {
    expect(getRangeBandBgColor('melee')).toBe('bg-red-900/40 border-red-600');
  });

  it('should return bg-yellow-900/40 border-yellow-600 for short', () => {
    expect(getRangeBandBgColor('short')).toBe('bg-yellow-900/40 border-yellow-600');
  });

  it('should return bg-green-900/40 border-green-600 for mid', () => {
    expect(getRangeBandBgColor('mid')).toBe('bg-green-900/40 border-green-600');
  });

  it('should return bg-blue-900/40 border-blue-600 for long', () => {
    expect(getRangeBandBgColor('long')).toBe('bg-blue-900/40 border-blue-600');
  });
});

describe('getRangeBandLabel', () => {
  it('should return Melee for melee', () => {
    expect(getRangeBandLabel('melee')).toBe('Melee');
  });

  it('should return Short for short', () => {
    expect(getRangeBandLabel('short')).toBe('Short');
  });

  it('should return Mid for mid', () => {
    expect(getRangeBandLabel('mid')).toBe('Mid');
  });

  it('should return Long for long', () => {
    expect(getRangeBandLabel('long')).toBe('Long');
  });
});
