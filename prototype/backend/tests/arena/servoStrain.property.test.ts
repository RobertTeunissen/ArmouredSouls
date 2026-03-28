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
    hasRangedWeapon: false,
    weaponOptimalRangeMidpoint: 4.5,
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

  describe('Property 13: Ranged kiting bonus never reduces speed', () => {
    it('should produce effectiveSpeed >= normal (non-bonus) speed when kiting bonus is active', () => {
      fc.assert(
        fc.property(
          arbServoMotors(),
          fc.double({ min: 0, max: 30, noNaN: true, noDefaultInfinity: true }),
          arbStance(),
          arbServoStrain(),
          (servoMotors, opponentSpeed, stance, strain) => {
            const state = makeState({
              servoMotors,
              hasRangedWeapon: true,
              weaponOptimalRangeMidpoint: 9.5, // mid range
              distanceToTarget: 3, // < optimal range to trigger kiting bonus
              stance,
              servoStrain: strain,
            });

            const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(
              state,
              opponentSpeed,
              false, // hasRangedOpponent
              true,  // hasMeleeOpponent
            );

            if (isClosingBonus) {
              // Calculate what the speed would be without the kiting bonus
              const nonBonusState = makeState({
                servoMotors,
                hasRangedWeapon: false, // disable kiting bonus path
                stance,
                servoStrain: strain,
              });
              const { effectiveSpeed: normalSpeed } = calculateEffectiveSpeed(
                nonBonusState,
                opponentSpeed,
                false,
                false,
              );

              // Kiting bonus should always produce speed >= the normal
              // strain-reduced speed, since it's exempt from strain
              expect(effectiveSpeed).toBeGreaterThanOrEqual(normalSpeed);
            }
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('Property 14: Kiting bonus is weaker than closing bonus', () => {
    it('should produce lower speed bonus for kiting than closing at same conditions', () => {
      fc.assert(
        fc.property(
          arbServoMotors(),
          fc.double({ min: 5, max: 30, noNaN: true, noDefaultInfinity: true }),
          arbStance(),
          (servoMotors, opponentSpeed, stance) => {
            // Melee closing state
            const meleeState = makeState({
              servoMotors,
              hasMeleeWeapon: true,
              distanceToTarget: 10, // > 2 to trigger closing bonus
              stance,
              servoStrain: 0,
            });

            // Ranged kiting state
            const rangedState = makeState({
              servoMotors,
              hasRangedWeapon: true,
              weaponOptimalRangeMidpoint: 16, // long range
              distanceToTarget: 3, // < optimal range to trigger kiting bonus
              stance,
              servoStrain: 0,
            });

            const { effectiveSpeed: meleeSpeed, isClosingBonus: meleeBonus } = calculateEffectiveSpeed(
              meleeState,
              opponentSpeed,
              true, // hasRangedOpponent
              false,
            );

            const { effectiveSpeed: rangedSpeed, isClosingBonus: rangedBonus } = calculateEffectiveSpeed(
              rangedState,
              opponentSpeed,
              false, // hasRangedOpponent
              true,  // hasMeleeOpponent
            );

            // Both should have their bonuses active
            expect(meleeBonus).toBe(true);
            expect(rangedBonus).toBe(true);

            // Melee closing bonus (15% + 1%/diff) should be stronger than
            // kiting bonus (10% + 0.8%/diff)
            expect(meleeSpeed).toBeGreaterThan(rangedSpeed);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('Property 15: Melee closing takes priority over kiting', () => {
    it('should use melee closing bonus when both could apply', () => {
      fc.assert(
        fc.property(
          arbServoMotors(),
          fc.double({ min: 5, max: 30, noNaN: true, noDefaultInfinity: true }),
          arbStance(),
          (servoMotors, opponentSpeed, stance) => {
            // Robot with both melee and ranged weapons (dual wield edge case)
            const dualState = makeState({
              servoMotors,
              hasMeleeWeapon: true,
              hasRangedWeapon: true,
              weaponOptimalRangeMidpoint: 9.5,
              distanceToTarget: 5, // > 2 (melee closing) and < 9.5 (kiting)
              stance,
              servoStrain: 0,
            });

            // Pure melee state for comparison
            const meleeOnlyState = makeState({
              servoMotors,
              hasMeleeWeapon: true,
              hasRangedWeapon: false,
              distanceToTarget: 5,
              stance,
              servoStrain: 0,
            });

            const { effectiveSpeed: dualSpeed, isClosingBonus: dualBonus } = calculateEffectiveSpeed(
              dualState,
              opponentSpeed,
              true, // hasRangedOpponent (triggers melee closing)
              true, // hasMeleeOpponent (would trigger kiting)
            );

            const { effectiveSpeed: meleeSpeed, isClosingBonus: meleeBonus } = calculateEffectiveSpeed(
              meleeOnlyState,
              opponentSpeed,
              true,
              false,
            );

            // Both should have bonus active
            expect(dualBonus).toBe(true);
            expect(meleeBonus).toBe(true);

            // Dual state should use melee closing (checked first), so speeds should match
            expect(dualSpeed).toBeCloseTo(meleeSpeed, 10);
          }
        ),
        { numRuns: 500 }
      );
    });
  });
});
