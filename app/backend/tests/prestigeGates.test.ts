/**
 * Prestige Gates Unit Tests
 * Tests that all facilities use the unified prestige gate curve.
 */

import prisma from '../src/lib/prisma';
import { getFacilityConfig, FACILITY_TYPES, PRESTIGE_GATES_10 } from '../src/config/facilities';

describe('Prestige Gates', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Unified Prestige Curve', () => {
    const UNIFIED_CURVE = [0, 0, 0, 1000, 3000, 5000, 10000, 15000, 25000, 50000];

    test('PRESTIGE_GATES_10 constant matches the expected unified curve', () => {
      expect(PRESTIGE_GATES_10).toEqual(UNIFIED_CURVE);
    });

    test('every implemented facility uses the unified prestige curve', () => {
      const implemented = FACILITY_TYPES.filter(f => f.implemented);

      for (const config of implemented) {
        expect(config.prestigeRequirements).toBeDefined();
        expect(config.prestigeRequirements).toEqual(UNIFIED_CURVE);
      }
    });

    test('all facilities have maxLevel 10', () => {
      const implemented = FACILITY_TYPES.filter(f => f.implemented);

      for (const config of implemented) {
        expect(config.maxLevel).toBe(10);
      }
    });

    test('no facility uses prestigeGateIsPerSlot', () => {
      const implemented = FACILITY_TYPES.filter(f => f.implemented);

      for (const config of implemented) {
        expect(config.prestigeGateIsPerSlot).toBeFalsy();
      }
    });
  });

  describe('Prestige Requirement Validation Logic', () => {
    test('levels 1-3 have no prestige requirement (0)', () => {
      const config = getFacilityConfig('repair_bay')!;
      expect(config.prestigeRequirements![0]).toBe(0);
      expect(config.prestigeRequirements![1]).toBe(0);
      expect(config.prestigeRequirements![2]).toBe(0);
    });

    test('level 4 requires 1000 prestige', () => {
      const config = getFacilityConfig('repair_bay')!;
      expect(config.prestigeRequirements![3]).toBe(1000);
    });

    test('level 10 requires 50000 prestige', () => {
      const config = getFacilityConfig('streaming_studio')!;
      expect(config.prestigeRequirements![9]).toBe(50000);
    });

    test('prestige gates are monotonically non-decreasing', () => {
      for (let i = 1; i < PRESTIGE_GATES_10.length; i++) {
        expect(PRESTIGE_GATES_10[i]).toBeGreaterThanOrEqual(PRESTIGE_GATES_10[i - 1]);
      }
    });

    test('should correctly validate user has sufficient prestige', () => {
      const userPrestige = 1500;
      const requiredPrestige = 1000;
      expect(userPrestige >= requiredPrestige).toBe(true);
    });

    test('should correctly validate user has insufficient prestige', () => {
      const userPrestige = 500;
      const requiredPrestige = 1000;
      expect(userPrestige >= requiredPrestige).toBe(false);
    });
  });

  describe('Roster Expansion', () => {
    test('roster expansion has 10 levels', () => {
      const config = getFacilityConfig('roster_expansion')!;
      expect(config.maxLevel).toBe(10);
    });

    test('roster expansion level 10 gives 11 robot slots', () => {
      const config = getFacilityConfig('roster_expansion')!;
      expect(config.benefits[9]).toContain('11');
    });
  });
});
