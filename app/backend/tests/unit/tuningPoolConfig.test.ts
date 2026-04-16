/**
 * Unit tests for tuningPoolConfig.ts
 *
 * Tests the pure functions and constants used by the Tuning Bay facility system:
 * - getPoolSize: pool size formula based on facility level
 * - getPerAttributeMax: per-attribute tuning cap based on academy cap and base value
 * - ROBOT_ATTRIBUTES: canonical list of 23 robot attribute names
 *
 * Includes fast-check property tests for monotonicity and range constraints.
 *
 * **Validates: Requirements 1.2, 1.3**
 */

import fc from 'fast-check';
import {
  getPoolSize,
  getPerAttributeMax,
  ROBOT_ATTRIBUTES,
} from '../../src/services/tuning-pool/tuningPoolConfig';

describe('tuningPoolConfig', () => {
  describe('getPoolSize', () => {
    it('should return 10 for level 0 (base pool, no facility)', () => {
      expect(getPoolSize(0)).toBe(10);
    });

    it('should return correct values for levels 1–10', () => {
      const expected: Record<number, number> = {
        1: 20, 2: 30, 3: 40, 4: 50, 5: 60,
        6: 70, 7: 80, 8: 90, 9: 100, 10: 110,
      };
      for (const [level, poolSize] of Object.entries(expected)) {
        expect(getPoolSize(Number(level))).toBe(poolSize);
      }
    });

    it('should return 10 for negative levels (clamped to 0)', () => {
      expect(getPoolSize(-1)).toBe(10);
      expect(getPoolSize(-5)).toBe(10);
      expect(getPoolSize(-100)).toBe(10);
    });

    it('should return correct value for levels > 10 (no artificial cap)', () => {
      expect(getPoolSize(11)).toBe(120);
      expect(getPoolSize(20)).toBe(210);
    });
  });

  describe('getPerAttributeMax', () => {
    it('should return 5 at academy cap (cap 15, base 15) — overclock only', () => {
      expect(getPerAttributeMax(15, 15)).toBe(5);
    });

    it('should return 10 below cap (cap 15, base 10)', () => {
      expect(getPerAttributeMax(15, 10)).toBe(10);
    });

    it('should return 10 with no academy (cap 10, base 5)', () => {
      expect(getPerAttributeMax(10, 5)).toBe(10);
    });

    it('should return 5 at max cap (cap 50, base 50)', () => {
      expect(getPerAttributeMax(50, 50)).toBe(5);
    });

    it('should return 0 when base equals cap + 5', () => {
      expect(getPerAttributeMax(15, 20)).toBe(0);
      expect(getPerAttributeMax(10, 15)).toBe(0);
    });

    it('should return 0 when base exceeds cap + 5 (edge case)', () => {
      expect(getPerAttributeMax(10, 20)).toBe(0);
      expect(getPerAttributeMax(15, 25)).toBe(0);
    });
  });

  describe('ROBOT_ATTRIBUTES', () => {
    it('should have exactly 23 entries', () => {
      expect(ROBOT_ATTRIBUTES).toHaveLength(23);
    });

    it('should contain all expected attribute names', () => {
      const expectedAttributes = [
        // Combat Systems
        'combatPower', 'targetingSystems', 'criticalSystems',
        'penetration', 'weaponControl', 'attackSpeed',
        // Defensive Systems
        'armorPlating', 'shieldCapacity', 'evasionThrusters',
        'damageDampeners', 'counterProtocols',
        // Chassis & Mobility
        'hullIntegrity', 'servoMotors', 'gyroStabilizers',
        'hydraulicSystems', 'powerCore',
        // AI Processing & Team Coordination
        'combatAlgorithms', 'threatAnalysis', 'adaptiveAI',
        'logicCores', 'syncProtocols', 'supportSystems', 'formationTactics',
      ];

      for (const attr of expectedAttributes) {
        expect(ROBOT_ATTRIBUTES).toContain(attr);
      }
    });

    it('should have no duplicate entries', () => {
      const unique = new Set(ROBOT_ATTRIBUTES);
      expect(unique.size).toBe(ROBOT_ATTRIBUTES.length);
    });
  });

  describe('fast-check property tests', () => {
    it('getPoolSize is monotonically increasing: for any a < b, getPoolSize(a) ≤ getPoolSize(b)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10, max: 100 }),
          fc.integer({ min: 1, max: 50 }),
          (a, delta) => {
            const b = a + delta; // b > a always since delta >= 1
            expect(getPoolSize(a)).toBeLessThanOrEqual(getPoolSize(b));
          },
        ),
        { numRuns: 200 },
      );
    });

    it('getPoolSize always returns ≥ 10', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: 1000 }),
          (level) => {
            expect(getPoolSize(level)).toBeGreaterThanOrEqual(10);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('getPerAttributeMax always returns ≥ 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 200 }),
          (academyCap, baseValue) => {
            expect(getPerAttributeMax(academyCap, baseValue)).toBeGreaterThanOrEqual(0);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('getPerAttributeMax ensures base + max ≤ academyCap + 5 when base ≤ cap + 5', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          (academyCap, baseValue) => {
            // Only test the meaningful domain: base ≤ academyCap + 5
            fc.pre(baseValue <= academyCap + 5);
            const max = getPerAttributeMax(academyCap, baseValue);
            expect(baseValue + max).toBeLessThanOrEqual(academyCap + 5);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('getPerAttributeMax returns exactly academyCap + 5 - baseValue when base ≤ cap + 5', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          (academyCap, baseValue) => {
            fc.pre(baseValue <= academyCap + 5);
            const max = getPerAttributeMax(academyCap, baseValue);
            expect(max).toBe(academyCap + 5 - baseValue);
          },
        ),
        { numRuns: 200 },
      );
    });
  });
});
