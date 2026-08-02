/**
 * Unit tests for the shared prestige gates utility.
 */

import { describe, it, expect } from 'vitest';
import { PRESTIGE_GATES, getUnlockedFacilityLevel, getNextPrestigeThreshold } from '../../../../shared/utils/prestigeGates';

describe('prestigeGates', () => {
  describe('PRESTIGE_GATES', () => {
    it('has 10 entries (one per level)', () => {
      expect(PRESTIGE_GATES).toHaveLength(10);
    });

    it('levels 1-3 are free (0)', () => {
      expect(PRESTIGE_GATES[0]).toBe(0);
      expect(PRESTIGE_GATES[1]).toBe(0);
      expect(PRESTIGE_GATES[2]).toBe(0);
    });

    it('is monotonically non-decreasing', () => {
      for (let i = 1; i < PRESTIGE_GATES.length; i++) {
        expect(PRESTIGE_GATES[i]).toBeGreaterThanOrEqual(PRESTIGE_GATES[i - 1]);
      }
    });
  });

  describe('getUnlockedFacilityLevel', () => {
    it('returns 3 for 0 prestige (levels 1-3 always free)', () => {
      expect(getUnlockedFacilityLevel(0)).toBe(3);
    });

    it('returns 4 for exactly 1000 prestige', () => {
      expect(getUnlockedFacilityLevel(1000)).toBe(4);
    });

    it('returns 4 for 2999 prestige (just below L5 gate)', () => {
      expect(getUnlockedFacilityLevel(2999)).toBe(4);
    });

    it('returns 5 for 3000 prestige', () => {
      expect(getUnlockedFacilityLevel(3000)).toBe(5);
    });

    it('returns 10 for 50000+ prestige (all unlocked)', () => {
      expect(getUnlockedFacilityLevel(50000)).toBe(10);
      expect(getUnlockedFacilityLevel(100000)).toBe(10);
    });

    it('returns 3 for 999 prestige (below first gate)', () => {
      expect(getUnlockedFacilityLevel(999)).toBe(3);
    });
  });

  describe('getNextPrestigeThreshold', () => {
    it('returns L4/1000 for 0 prestige', () => {
      expect(getNextPrestigeThreshold(0)).toEqual({ level: 4, required: 1000 });
    });

    it('returns L5/3000 for 1000 prestige', () => {
      expect(getNextPrestigeThreshold(1000)).toEqual({ level: 5, required: 3000 });
    });

    it('returns L5/3000 for 2500 prestige (between gates)', () => {
      expect(getNextPrestigeThreshold(2500)).toEqual({ level: 5, required: 3000 });
    });

    it('returns L10/50000 for 25000 prestige', () => {
      expect(getNextPrestigeThreshold(25000)).toEqual({ level: 10, required: 50000 });
    });

    it('returns null when all levels are unlocked (50000+)', () => {
      expect(getNextPrestigeThreshold(50000)).toBeNull();
      expect(getNextPrestigeThreshold(100000)).toBeNull();
    });
  });
});
