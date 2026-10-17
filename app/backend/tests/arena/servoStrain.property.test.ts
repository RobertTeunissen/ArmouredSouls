import * as fc from 'fast-check';
import {
  calculateBaseSpeed,
  calculateEffectiveSpeed,
  updateServoStrain,
  ServoStrainState,
} from '../../src/services/arena/servoStrain';
import type { EngagementRole, SpeedBurst } from '../../src/services/arena/engagementCycle';

/**
 * Property-based tests for servoStrain module (#520 engagement-cycle rules).
 * Uses fast-check to verify universal properties across random inputs.
 */

const STANCE_FACTOR: Record<'defensive' | 'offensive' | 'balanced', number> = {
  defensive: 0.80,
  offensive: 1.10,
  balanced: 1.00,
};

/** Helper factory for ServoStrainState */
function makeState(overrides: Partial<ServoStrainState> = {}): ServoStrainState {
  return {
    servoMotors: 25,
    servoStrain: 0,
    sustainedMovementTime: 0,
    isUsingClosingBonus: false,
    stance: 'balanced',
    role: 'ranged',
    engagementRangeMidpoint: 4.5,
    speedBurst: 'none',
    distanceToTarget: 10,
    currentSpeedRatio: 0,
    opponentEngagementMidpoint: null,
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

/** Arbitrary for an engagement role */
const arbRole = (): fc.Arbitrary<EngagementRole> =>
  fc.constantFrom('melee' as const, 'ranged' as const);

/** Arbitrary for an active burst */
const arbActiveBurst = (): fc.Arbitrary<SpeedBurst> =>
  fc.constantFrom('melee_commit' as const, 'ranged_disengage' as const);

/** Arbitrary for distance beyond melee reach */
const arbBeyondReach = (): fc.Arbitrary<number> =>
  fc.double({ min: 2.0001, max: 40, noNaN: true, noDefaultInfinity: true });

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
   * Property 12 (#520): melee pursuit of a ranged opponent is exactly base × stance × 1.15,
   * strain-exempt, for every stance (defensive keeps 0.80 while pursuing).
   */
  describe('Property 12: pursuit is base × stance × 1.15', () => {
    it('should pursue at exactly base × stance × 1.15 regardless of strain', () => {
      fc.assert(
        fc.property(
          arbServoMotors(),
          arbStance(),
          arbServoStrain(),
          arbBeyondReach(),
          (servoMotors, stance, strain, distance) => {
            const state = makeState({
              servoMotors, stance, servoStrain: strain, role: 'melee', distanceToTarget: distance,
            });
            const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(state, 'ranged');
            expect(isClosingBonus).toBe(true);
            expect(effectiveSpeed).toBeCloseTo(calculateBaseSpeed(servoMotors) * STANCE_FACTOR[stance] * 1.15, 10);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('should use the full 0.80 defensive factor while pursuing', () => {
      fc.assert(
        fc.property(arbServoMotors(), arbBeyondReach(), (servoMotors, distance) => {
          const state = makeState({ servoMotors, stance: 'defensive', role: 'melee', distanceToTarget: distance });
          const { effectiveSpeed } = calculateEffectiveSpeed(state, 'ranged');
          expect(effectiveSpeed).toBeCloseTo(calculateBaseSpeed(servoMotors) * 0.80 * 1.15, 10);
        }),
        { numRuns: 200 }
      );
    });
  });

  /**
   * Property 13 (#520): ranged kiting inside the engagement midpoint against a melee
   * opponent is exactly base × stance × 1.10, strain-exempt.
   */
  describe('Property 13: kiting is base × stance × 1.10', () => {
    it('should kite at exactly base × stance × 1.10 regardless of strain', () => {
      fc.assert(
        fc.property(
          arbServoMotors(),
          arbStance(),
          arbServoStrain(),
          fc.constantFrom(4.5, 9.5, 16),
          fc.double({ min: 0, max: 0.999, noNaN: true, noDefaultInfinity: true }),
          (servoMotors, stance, strain, midpoint, fraction) => {
            const state = makeState({
              servoMotors, stance, servoStrain: strain, role: 'ranged',
              engagementRangeMidpoint: midpoint, distanceToTarget: midpoint * fraction,
            });
            const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(state, 'melee');
            expect(isClosingBonus).toBe(true);
            expect(effectiveSpeed).toBeCloseTo(calculateBaseSpeed(servoMotors) * STANCE_FACTOR[stance] * 1.10, 10);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('pursuit is 1.15/1.10 × the kiting speed at equal Servo Motors', () => {
      fc.assert(
        fc.property(arbServoMotors(), arbStance(), (servoMotors, stance) => {
          const pursuer = makeState({ servoMotors, stance, role: 'melee', distanceToTarget: 3 });
          const kiter = makeState({ servoMotors, stance, role: 'ranged', engagementRangeMidpoint: 16, distanceToTarget: 3 });
          expect(calculateEffectiveSpeed(pursuer, 'ranged').effectiveSpeed)
            .toBeCloseTo(calculateEffectiveSpeed(kiter, 'melee').effectiveSpeed * 1.15 / 1.10, 10);
        }),
        { numRuns: 200 }
      );
    });
  });

  /**
   * Property 14 (#520): a speed burst (melee commit / ranged disengage) is exactly
   * base × stance × 1.30 and strain-exempt, regardless of role or distance.
   */
  describe('Property 14: burst is base × stance × 1.30', () => {
    it('should move at base × stance × 1.30 whenever a burst is active', () => {
      fc.assert(
        fc.property(
          arbServoMotors(),
          arbStance(),
          arbServoStrain(),
          arbRole(),
          fc.option(arbRole(), { nil: null }),
          arbActiveBurst(),
          fc.double({ min: 0, max: 40, noNaN: true, noDefaultInfinity: true }),
          (servoMotors, stance, strain, role, opponentRole, burst, distance) => {
            const state = makeState({
              servoMotors, stance, servoStrain: strain, role, speedBurst: burst, distanceToTarget: distance,
            });
            const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(state, opponentRole);
            expect(isClosingBonus).toBe(true);
            expect(effectiveSpeed).toBeCloseTo(calculateBaseSpeed(servoMotors) * STANCE_FACTOR[stance] * 1.30, 10);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 15: normal movement (no mode applies) is strain-reduced.
   */
  describe('Property 15: normal movement is strain-reduced', () => {
    it('should move at base × stance × (1 − strain/100) when no mode applies', () => {
      fc.assert(
        fc.property(
          arbServoMotors(),
          arbStance(),
          arbServoStrain(),
          arbBeyondReach(),
          (servoMotors, stance, strain, distance) => {
            // Ranged vs ranged: no pursuit, no final approach, no kiting
            const state = makeState({ servoMotors, stance, servoStrain: strain, role: 'ranged', distanceToTarget: distance });
            const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(state, 'ranged');
            expect(isClosingBonus).toBe(false);
            expect(effectiveSpeed).toBeCloseTo(
              calculateBaseSpeed(servoMotors) * STANCE_FACTOR[stance] * (1 - strain / 100), 10,
            );
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 15b (Season 2 round 3): ranged vs ranged kiting (1.10) and ranged
   * pursuit (1.05) are exact and never accumulate strain.
   */
  describe('Property 15b: ranged kiting 1.10 / ranged pursuit 1.05, strain-free', () => {
    const MIDPOINTS = [4.5, 9.5, 16];
    const arbMidpointPair = (): fc.Arbitrary<[number, number]> =>
      fc.tuple(fc.constantFrom(...MIDPOINTS), fc.constantFrom(...MIDPOINTS)).filter(([own, opp]) => own !== opp);

    it('kites at exactly 1.10 inside its midpoint vs a closer-preferring robot and pursues at exactly 1.05 beyond it vs a farther-preferring one', () => {
      fc.assert(
        fc.property(
          arbServoMotors(),
          arbStance(),
          arbServoStrain(),
          arbSustainedTime(),
          arbMidpointPair(),
          fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
          (servoMotors, stance, strain, sustained, [own, opp], fraction) => {
            const kiting = opp < own;
            // Kiter: distance strictly inside its midpoint; pursuer: strictly beyond it
            const distanceToTarget = kiting ? own * 0.999 * fraction : own + 0.001 + 30 * fraction;
            const state = makeState({
              servoMotors, stance, servoStrain: strain, sustainedMovementTime: sustained,
              role: 'ranged', engagementRangeMidpoint: own, opponentEngagementMidpoint: opp, distanceToTarget,
            });
            const { effectiveSpeed, isClosingBonus, mode } = calculateEffectiveSpeed(state, 'ranged');
            expect(isClosingBonus).toBe(true);
            expect(mode).toBe(kiting ? 'ranged_kiting' : 'ranged_pursuit');
            expect(effectiveSpeed).toBe(calculateBaseSpeed(servoMotors) * STANCE_FACTOR[stance] * (kiting ? 1.10 : 1.05));

            // Strain never accumulates in these modes, even at full speed past the grace period
            state.isUsingClosingBonus = isClosingBonus;
            state.currentSpeedRatio = 1;
            updateServoStrain(state, 0.1);
            expect(state.servoStrain).toBeLessThanOrEqual(strain);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 16: the mutual-melee final approach (2 < d ≤ 4) keeps its 1.15 multiplier.
   */
  describe('Property 16: mutual-melee final approach is base × stance × 1.15', () => {
    it('should apply 1.15 only between 2 and 4 units in a melee mirror', () => {
      fc.assert(
        fc.property(
          arbServoMotors(),
          arbStance(),
          arbServoStrain(),
          fc.double({ min: 2.0001, max: 4, noNaN: true, noDefaultInfinity: true }),
          (servoMotors, stance, strain, distance) => {
            const state = makeState({ servoMotors, stance, servoStrain: strain, role: 'melee', distanceToTarget: distance });
            const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(state, 'melee');
            expect(isClosingBonus).toBe(true);
            expect(effectiveSpeed).toBeCloseTo(calculateBaseSpeed(servoMotors) * STANCE_FACTOR[stance] * 1.15, 10);
          }
        ),
        { numRuns: 300 }
      );
    });

    it('should not apply a melee-mirror bonus beyond 4 units', () => {
      fc.assert(
        fc.property(
          arbServoMotors(),
          fc.double({ min: 4.0001, max: 40, noNaN: true, noDefaultInfinity: true }),
          (servoMotors, distance) => {
            const state = makeState({ servoMotors, role: 'melee', distanceToTarget: distance });
            expect(calculateEffectiveSpeed(state, 'melee').isClosingBonus).toBe(false);
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
