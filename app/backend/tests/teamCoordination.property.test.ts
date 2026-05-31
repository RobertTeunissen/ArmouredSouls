import * as fc from 'fast-check';
import {
  calculateFocusFireBonus,
  calculateAllyShieldRegen,
  calculateFormationDefense,
} from '../src/services/team-battle/teamCoordinationEffects';

/**
 * Property Tests for Team Coordination Effect Monotonicity (Properties 3 & 4)
 *
 * These tests verify that the coordination effect formulas are monotonically
 * non-decreasing with respect to their primary attribute inputs. Higher
 * attribute investment must always produce equal or greater bonuses.
 *
 * **Validates: Requirements R13.3, R13.4**
 */

describe('Team Coordination Effects — Property Tests', () => {
  describe('Property 3: syncProtocols Monotonicity', () => {
    /**
     * For A ≤ B in [0, 50], calculateFocusFireBonus at avgSyncProtocols=A
     * must be ≤ calculateFocusFireBonus at avgSyncProtocols=B, holding all
     * other parameters constant.
     *
     * **Validates: Requirements R13.3**
     */
    test('focus fire bonus is monotonically non-decreasing with syncProtocols', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 0, max: 50 }),
          fc.constantFrom(2, 3) as fc.Arbitrary<2 | 3>,
          (a, b, teamSize) => {
            const lo = Math.min(a, b);
            const hi = Math.max(a, b);

            // Use full team contributing (teamSize contributors) for consistent comparison
            const bonusLo = calculateFocusFireBonus(lo, teamSize, teamSize);
            const bonusHi = calculateFocusFireBonus(hi, teamSize, teamSize);

            expect(bonusLo).toBeLessThanOrEqual(bonusHi);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('focus fire bonus is monotonically non-decreasing with syncProtocols (partial contributors)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 2, max: 3 }),
          (a, b, contributorCount) => {
            const lo = Math.min(a, b);
            const hi = Math.max(a, b);
            const teamSize = 3; // 3v3 allows partial contributors (2 of 3)

            const bonusLo = calculateFocusFireBonus(lo, contributorCount, teamSize);
            const bonusHi = calculateFocusFireBonus(hi, contributorCount, teamSize);

            expect(bonusLo).toBeLessThanOrEqual(bonusHi);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: supportSystems and formationTactics Monotonicity', () => {
    /**
     * For A ≤ B in [0, 50], calculateAllyShieldRegen at supportSystems=A
     * must be ≤ calculateAllyShieldRegen at supportSystems=B, holding dt constant.
     *
     * **Validates: Requirements R13.4**
     */
    test('ally shield regen is monotonically non-decreasing with supportSystems', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 0, max: 50 }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(1.0), noNaN: true }),
          (a, b, dt) => {
            const lo = Math.min(a, b);
            const hi = Math.max(a, b);

            const regenLo = calculateAllyShieldRegen(lo, dt);
            const regenHi = calculateAllyShieldRegen(hi, dt);

            expect(regenLo).toBeLessThanOrEqual(regenHi);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * For A ≤ B in [0, 50], calculateFormationDefense at avgFormationTactics=A
     * must be ≤ calculateFormationDefense at avgFormationTactics=B, holding
     * alliesInRange and teamSize constant.
     *
     * **Validates: Requirements R13.4**
     */
    test('formation defence is monotonically non-decreasing with formationTactics', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 0, max: 50 }),
          fc.constantFrom(2, 3) as fc.Arbitrary<2 | 3>,
          (a, b, teamSize) => {
            const lo = Math.min(a, b);
            const hi = Math.max(a, b);

            // All allies in range for consistent comparison
            const alliesInRange = teamSize - 1;

            const defenceLo = calculateFormationDefense(lo, alliesInRange, teamSize);
            const defenceHi = calculateFormationDefense(hi, alliesInRange, teamSize);

            expect(defenceLo).toBeLessThanOrEqual(defenceHi);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('formation defence is monotonically non-decreasing with formationTactics (partial allies)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 1, max: 2 }),
          (a, b, alliesInRange) => {
            const lo = Math.min(a, b);
            const hi = Math.max(a, b);
            const teamSize = 3; // 3v3 allows partial allies in range

            const defenceLo = calculateFormationDefense(lo, alliesInRange, teamSize);
            const defenceHi = calculateFormationDefense(hi, alliesInRange, teamSize);

            expect(defenceLo).toBeLessThanOrEqual(defenceHi);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
