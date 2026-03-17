import * as fc from 'fast-check';
import {
  calculateBaseSpeed,
  calculateEffectiveSpeed,
  updateServoStrain,
  ServoStrainState,
} from '../../src/services/arena/servoStrain';

/**
 * Property-based tests for servoStrain module.
 * Uses fast-check to verify universal properties across random inputs.
 */

/** Helper factory for ServoStrainState */
function makeState(overrides: Partial<ServoStrainState> = {}): ServoStrainState {
  return {
    servoMotors: 25,
    servoStrain: 0,
    sustainedMovementTime: 0,
    isUsingClosingBonus: false,
    stance: 'balanced',
    hasMeleeWeapon: false,
    distanceToTarget: 10,
    currentSpeedRatio: 0,
    ...overrides,
  };
}

/** Arbitrary for servoMotors in valid range 1–50 */
const arbServoMotors = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 50 });

/** Arbitrary for a valid stance */
const arbStance = (): fc.Arbitrary<'defensive' | 'offensive' | 'balanced'> =>
  fc.constantFrom('defensive' as const, 'offensive' as const, 'balanced' as const);

/** Arbitrary for speed ratio (0–1) */
const arbSpeedRatio = (): fc.Arbitrary<number> =>
  fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

/** Arbitrary for deltaTime (typical simulation tick range) */
const arbDeltaTime = (): fc.Arbitrary<number> =>
  fc.double({ min: 0.01, max: 1.0, noNaN: true, noDefaultInfinity: true });

/** Arbitrary for servo strain (0–30) */
const arbServoStrain = (): fc.Arbitrary<number> =>
  fc.double({ min: 0, max: 30, noNaN: true, noDefaultInfinity: true });

/** Arbitrary for sustained movement time (0–20s) */
const arbSustainedTime = (): fc.Arbitrary<number> =>
  fc.double({ min: 0, max: 20, noNaN: true, noDefaultInfinity: true });

describe('servoStrain property tests', () => {
  /**
   * Property 10: servoStrain is always clamped between 0 and 30 regardless of input sequence
   * **Validates: Requirement 2.6**
   */
  describe('Property 10: servoStrain clamped [0, 30]', () => {
    it('should keep servoStrain in [0, 30] after any single updateServoStrain call', () => {
      fc.assert(
        fc.property(
          arbServoStrain(),
          arbSpeedRatio(),
          arbSustainedTime(),
          fc.boolean(),
          arbDeltaTime(),
          (strain, speedRatio, sustainedTime, isClosing, dt) => {
            const state = makeState({
              servoStrain: strain,
              currentSpeedRatio: speedRatio,
              sustainedMovementTime: sustainedTime,
              isUsingClosingBonus: isClosing,
            });
            updateServoStrain(state, dt);
            expect(state.servoStrain).toBeGreaterThanOrEqual(0);
            expect(state.servoStrain).toBeLessThanOrEqual(30);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('should keep servoStrain in [0, 30] after a random sequence of updates', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              speedRatio: arbSpeedRatio(),
              isClosing: fc.boolean(),
              dt: arbDeltaTime(),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          arbServoMotors(),
          (sequence, servoMotors) => {
            const state = makeState({ servoMotors });

            for (const step of sequence) {
              state.currentSpeedRatio = step.speedRatio;
              state.isUsingClosingBonus = step.isClosing;
              updateServoStrain(state, step.dt);
            }

            expect(state.servoStrain).toBeGreaterThanOrEqual(0);
            expect(state.servoStrain).toBeLessThanOrEqual(30);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 11: calculateBaseSpeed is monotonically increasing with servoMotors (1–50)
   * **Validates: Requirement 2.1**
   */
  describe('Property 11: calculateBaseSpeed monotonically increasing', () => {
    it('should satisfy calculateBaseSpeed(a) < calculateBaseSpeed(b) for all 1 ≤ a < b ≤ 50', () => {
      fc.assert(
        fc.property(
          arbServoMotors(),
          arbServoMotors(),
          (raw_a, raw_b) => {
            const a = Math.min(raw_a, raw_b);
            const b = Math.max(raw_a, raw_b);
            fc.pre(a < b);

            expect(calculateBaseSpeed(a)).toBeLessThan(calculateBaseSpeed(b));
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 12: Melee closing bonus always produces speed ≥ base speed (never reduces speed)
   * **Validates: Requirements 2.5, 2.7**
   */
  describe('Property 12: Melee closing bonus never reduces speed', () => {
    it('should produce effectiveSpeed >= normal (non-bonus) speed when closing bonus is active', () => {
      fc.assert(
        fc.property(
          arbServoMotors(),
          fc.double({ min: 0, max: 30, noNaN: true, noDefaultInfinity: true }),
          arbStance(),
          arbServoStrain(),
          (servoMotors, opponentSpeed, stance, strain) => {
            const state = makeState({
              servoMotors,
              hasMeleeWeapon: true,
              distanceToTarget: 10, // > 2 to trigger closing bonus
              stance,
              servoStrain: strain,
            });

            const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(
              state,
              opponentSpeed,
              true, // hasRangedOpponent
            );

            if (isClosingBonus) {
              // Calculate what the speed would be without the closing bonus
              // (normal path with strain reduction applied)
              const nonBonusState = makeState({
                servoMotors,
                hasMeleeWeapon: false, // disable closing bonus path
                stance,
                servoStrain: strain,
              });
              const { effectiveSpeed: normalSpeed } = calculateEffectiveSpeed(
                nonBonusState,
                opponentSpeed,
                false,
              );

              // Closing bonus should always produce speed >= the normal
              // strain-reduced speed, since it's exempt from strain (Req 2.7)
              expect(effectiveSpeed).toBeGreaterThanOrEqual(normalSpeed);
            }
          }
        ),
        { numRuns: 500 }
      );
    });
  });
});
