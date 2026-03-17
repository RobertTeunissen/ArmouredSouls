import * as fc from 'fast-check';
import {
  calculateTurnSpeed,
  checkBackstab,
  checkFlanking,
  PositionedRobot,
} from '../../src/services/arena/positionTracker';

/**
 * Property-based tests for positionTracker module.
 * Uses fast-check to verify universal properties across random inputs.
 */

/** Arbitrary for gyroStabilizers in valid range 1–50 */
const arbGyro = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 50 });

/** Arbitrary for threatAnalysis in valid range 1–50 */
const arbThreatAnalysis = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 50 });

/** Arbitrary for a 2D position within a reasonable arena range */
const arbPosition = (): fc.Arbitrary<{ x: number; y: number }> =>
  fc.record({
    x: fc.double({ min: -50, max: 50, noNaN: true, noDefaultInfinity: true }),
    y: fc.double({ min: -50, max: 50, noNaN: true, noDefaultInfinity: true }),
  });

/** Arbitrary for a facing direction in degrees */
const arbFacing = (): fc.Arbitrary<number> =>
  fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true });

/** Helper to build a PositionedRobot */
function makeRobot(overrides: Partial<PositionedRobot> = {}): PositionedRobot {
  return {
    position: { x: 0, y: 0 },
    facingDirection: 0,
    gyroStabilizers: 1,
    threatAnalysis: 1,
    ...overrides,
  };
}

describe('positionTracker property tests', () => {
  /**
   * Property 13: Turn speed is always positive and monotonically increasing
   * with gyroStabilizers (1–50)
   * **Validates: Requirement 9.2**
   */
  describe('Property 13: Turn speed positive and monotonically increasing', () => {
    it('should always return a positive turn speed for any gyroStabilizers in [1, 50]', () => {
      fc.assert(
        fc.property(arbGyro(), (gyro) => {
          expect(calculateTurnSpeed(gyro)).toBeGreaterThan(0);
        }),
        { numRuns: 500 },
      );
    });

    it('should satisfy calculateTurnSpeed(a) < calculateTurnSpeed(b) for all 1 ≤ a < b ≤ 50', () => {
      fc.assert(
        fc.property(arbGyro(), arbGyro(), (rawA, rawB) => {
          const a = Math.min(rawA, rawB);
          const b = Math.max(rawA, rawB);
          fc.pre(a < b);

          expect(calculateTurnSpeed(a)).toBeLessThan(calculateTurnSpeed(b));
        }),
        { numRuns: 500 },
      );
    });
  });

  /**
   * Property 14: Backstab bonus after gyro/TA reduction is never negative (clamped at 0)
   * **Validates: Requirements 9.4, 9.5, 9.9**
   */
  describe('Property 14: Backstab bonus never negative', () => {
    it('should return bonus >= 0 for any gyroStabilizers and threatAnalysis combination', () => {
      fc.assert(
        fc.property(
          arbGyro(),
          arbThreatAnalysis(),
          arbFacing(),
          (gyro, ta, facing) => {
            // Place attacker directly behind the defender to guarantee backstab
            const defenderPos = { x: 0, y: 0 };
            const facingRad = (facing * Math.PI) / 180;
            // Attacker at 180° from facing direction (directly behind)
            const attackerX = -Math.cos(facingRad) * 10;
            const attackerY = -Math.sin(facingRad) * 10;

            const defender = makeRobot({
              position: defenderPos,
              facingDirection: facing,
              gyroStabilizers: gyro,
              threatAnalysis: ta,
            });
            const attacker = makeRobot({
              position: { x: attackerX, y: attackerY },
            });

            const result = checkBackstab(attacker, defender);

            // Whether or not it's classified as backstab, bonus must be >= 0
            expect(result.bonus).toBeGreaterThanOrEqual(0);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('should return bonus >= 0 for arbitrary attacker/defender positions', () => {
      fc.assert(
        fc.property(
          arbPosition(),
          arbPosition(),
          arbFacing(),
          arbGyro(),
          arbThreatAnalysis(),
          (attackerPos, defenderPos, facing, gyro, ta) => {
            // Ensure attacker and defender are not at the same position
            fc.pre(
              Math.abs(attackerPos.x - defenderPos.x) > 0.01 ||
              Math.abs(attackerPos.y - defenderPos.y) > 0.01,
            );

            const defender = makeRobot({
              position: defenderPos,
              facingDirection: facing,
              gyroStabilizers: gyro,
              threatAnalysis: ta,
            });
            const attacker = makeRobot({ position: attackerPos });

            const result = checkBackstab(attacker, defender);
            expect(result.bonus).toBeGreaterThanOrEqual(0);
          },
        ),
        { numRuns: 500 },
      );
    });
  });

  /**
   * Property 15: Flanking detection requires at least 2 attackers —
   * single attacker never triggers flanking
   * **Validates: Requirement 9.7**
   */
  describe('Property 15: Single attacker never triggers flanking', () => {
    it('should return isFlanking=false for a single attacker at any position', () => {
      fc.assert(
        fc.property(
          arbPosition(),
          arbPosition(),
          arbFacing(),
          arbGyro(),
          arbThreatAnalysis(),
          (attackerPos, defenderPos, facing, gyro, ta) => {
            const defender = makeRobot({
              position: defenderPos,
              facingDirection: facing,
              gyroStabilizers: gyro,
              threatAnalysis: ta,
            });
            const attacker = makeRobot({ position: attackerPos });

            const result = checkFlanking([attacker], defender);
            expect(result.isFlanking).toBe(false);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('should return isFlanking=false for zero attackers', () => {
      fc.assert(
        fc.property(
          arbPosition(),
          arbFacing(),
          arbGyro(),
          arbThreatAnalysis(),
          (defenderPos, facing, gyro, ta) => {
            const defender = makeRobot({
              position: defenderPos,
              facingDirection: facing,
              gyroStabilizers: gyro,
              threatAnalysis: ta,
            });

            const result = checkFlanking([], defender);
            expect(result.isFlanking).toBe(false);
          },
        ),
        { numRuns: 500 },
      );
    });
  });
});
