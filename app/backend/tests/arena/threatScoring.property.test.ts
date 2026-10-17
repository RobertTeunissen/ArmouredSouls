import * as fc from 'fast-check';
import {
  calculateThreatScore,
  selectTarget,
} from '../../src/services/arena/threatScoring';
import { classifyRangeBand, getRangePenalty } from '../../src/services/arena/rangeBands';
import { RobotCombatState, MovementIntent, RangeBand } from '../../src/services/arena/types';

/**
 * Property-based tests for threatScoring module.
 * Uses fast-check to verify universal properties across random inputs.
 */

function makeIntent(): MovementIntent {
  return {
    targetPosition: { x: 0, y: 0 },
    strategy: 'direct_path',
    preferredRange: 'short',
    stanceSpeedModifier: 0,
  };
}

function makeWeapon(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Laser Pistol',
    weaponType: 'energy',
    handsRequired: 'one',
    baseDamage: 10,
    cooldown: 2,
    rangeBand: 'mid',
    ...overrides,
  };
}

function makeState(overrides: Partial<RobotCombatState> = {}): RobotCombatState {
  return {
    robot: {
      loadoutType: 'single',
      stance: 'balanced',
      mainWeapon: { weapon: makeWeapon() } as any,
      offhandWeapon: null,
      threatAnalysis: 25,
      combatAlgorithms: 25,
    } as any,
    currentHP: 100,
    maxHP: 100,
    currentShield: 50,
    maxShield: 50,
    lastAttackTime: 0,
    lastOffhandAttackTime: 0,
    attackCooldown: 2,
    offhandCooldown: 0,
    totalDamageDealt: 50,
    totalDamageTaken: 0,
    numServoMotors: 1,
    numGyroStabilizers: 1,
    numThreatAnalysis: 25,
    numAdaptiveAI: 1,
    numLogicCores: 1,
    numHydraulicSystems: 1,
    numPowerCore: 1,
    position: { x: 0, y: 0 },
    facingDirection: 0,
    velocity: { x: 0, y: 0 },
    movementSpeed: 10,
    effectiveMovementSpeed: 10,
    servoStrain: 0,
    sustainedMovementTime: 0,
    isUsingClosingBonus: false,
    movementIntent: makeIntent(),
    currentTarget: null,
    patienceTimer: 0,
    combatAlgorithmScore: 0.5,
    lastMeleeHitTakenAt: null,
    disengageBurstUntil: 0,
    disengageReadyAt: 0,
    disengageScheduledAt: null,
    speedBurst: 'none',
    adaptationHitBonus: 0,
    adaptationDamageBonus: 0,
    hitsTaken: 0,
    missCount: 0,
    pressureThreshold: 30,
    isUnderPressure: false,
    teamIndex: 0,
    isAlive: true,
    targetLockTimer: 0,
    ...overrides,
  };
}

const BANDS: RangeBand[] = ['melee', 'short', 'mid', 'long'];
const arbBand = (): fc.Arbitrary<RangeBand> => fc.constantFrom(...BANDS);

/** Same state with a main weapon of the given range band. */
function withMainBand(state: RobotCombatState, rangeBand: RangeBand): RobotCombatState {
  return {
    ...state,
    robot: { ...state.robot, mainWeapon: { weapon: makeWeapon({ rangeBand }) } } as any,
  };
}

const arbDistance = (): fc.Arbitrary<number> =>
  fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true });

const arbArenaRadius = (): fc.Arbitrary<number> =>
  fc.double({ min: 5, max: 100, noNaN: true, noDefaultInfinity: true });

describe('threatScoring property tests', () => {
  /**
   * Property 24: Threat score proximity decay is always in (0, 1]
   * for any non-negative distance and positive arena radius.
   * **Validates: Requirement 6.1**
   */
  describe('Property 24: Proximity decay in (0, 1]', () => {
    it('should produce proximity decay in (0, 1] for any distance and arena radius', () => {
      fc.assert(
        fc.property(arbDistance(), arbArenaRadius(), (distance, radius) => {
          const robot = makeState({ position: { x: 0, y: 0 } });
          const opponent = makeState({
            position: { x: distance, y: 0 },
            teamIndex: 1,
          });

          const result = calculateThreatScore(robot, opponent, distance, radius);

          expect(result.factors.proximityDecay).toBeGreaterThan(0);
          expect(result.factors.proximityDecay).toBeLessThanOrEqual(1.0 + 1e-9);
        }),
        { numRuns: 500 },
      );
    });
  });

  /**
   * Property 25: selectTarget always returns a living opponent
   * when at least one exists.
   * **Validates: Requirement 12.4**
   */
  describe('Property 25: selectTarget returns living opponent', () => {
    it('should return a non-null result when at least one living opponent exists', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          arbArenaRadius(),
          (numOpponents, radius) => {
            const robot = makeState({ position: { x: -10, y: 0 } });
            const opponents: RobotCombatState[] = [];

            for (let i = 0; i < numOpponents; i++) {
              opponents.push(
                makeState({
                  position: { x: 10 + i * 3, y: 0 },
                  teamIndex: 1,
                  isAlive: true,
                }),
              );
            }

            const result = selectTarget(robot, opponents, radius);
            expect(result).not.toBeNull();
          },
        ),
        { numRuns: 500 },
      );
    });

    it('should return null when no living opponents exist', () => {
      const robot = makeState({ position: { x: 0, y: 0 } });
      const opponents = [
        makeState({ isAlive: false, teamIndex: 1 }),
        makeState({ isAlive: false, teamIndex: 1 }),
      ];

      const result = selectTarget(robot, opponents, 16);
      expect(result).toBeNull();
    });

    it('should return null for empty opponents array', () => {
      const robot = makeState({ position: { x: 0, y: 0 } });
      const result = selectTarget(robot, [], 16);
      expect(result).toBeNull();
    });

    it('returns the only opponent in a 1v1, whatever the weapons and distance (Season 2 round 3)', () => {
      fc.assert(
        fc.property(arbBand(), arbBand(), arbDistance(), arbArenaRadius(), (ownBand, oppBand, distance, radius) => {
          const robot = withMainBand(makeState({ position: { x: 0, y: 0 } }), ownBand);
          const opponent = withMainBand(makeState({ position: { x: distance, y: 0 }, teamIndex: 1 }), oppBand);
          expect(selectTarget(robot, [opponent], radius)?.robotIndex).toBe(1);
        }),
        { numRuns: 200 },
      );
    });
  });

  /**
   * Season 2 round 3 (B): "shoot who I can hurt". The score is multiplied by the
   * evaluating robot's own range multiplier at the distance; the opponent's
   * weapon band no longer matters.
   */
  describe('Own range multiplier (Season 2 round 3)', () => {
    /** Score without the own range multiplier, from the published factors. */
    function baseScore(robot: RobotCombatState, distance: number, radius: number, opponent: RobotCombatState): number {
      const { factors } = calculateThreatScore(robot, opponent, distance, radius);
      const ta = Number(robot.robot.threatAnalysis ?? 1);
      return factors.combatPower * factors.hpPercentage * factors.proximityDecay
        * (factors.isTargetingMe ? 1.3 : 1) * (0.5 + ta / 100);
    }

    it.each<[RangeBand, number, number]>([
      ['long', 22, 1.1],
      ['melee', 22, 0.5],
      ['short', 4, 1.1],
      ['mid', 22, 0.75],
      ['long', 4, 0.5],
    ])('a %s evaluator at %d units scales the score by %s×', (ownBand, distance, multiplier) => {
      const robot = withMainBand(makeState(), ownBand);
      const opponent = makeState({ position: { x: distance, y: 0 }, teamIndex: 1 });
      const result = calculateThreatScore(robot, opponent, distance, 58);
      expect(result.factors.ownRangeMultiplier).toBe(multiplier);
      expect(result.score).toBeCloseTo(baseScore(robot, distance, 58, opponent) * multiplier, 10);
    });

    it('the multiplier is exactly getRangePenalty(own band, band(distance)) for any band and distance', () => {
      fc.assert(
        fc.property(arbBand(), arbDistance(), arbArenaRadius(), (ownBand, distance, radius) => {
          const robot = withMainBand(makeState(), ownBand);
          const opponent = makeState({ position: { x: distance, y: 0 }, teamIndex: 1 });
          const result = calculateThreatScore(robot, opponent, distance, radius);
          const expected = getRangePenalty(ownBand, classifyRangeBand(distance));
          expect(result.factors.ownRangeMultiplier).toBe(expected);
          expect(result.score).toBeCloseTo(baseScore(robot, distance, radius, opponent) * expected, 9);
        }),
        { numRuns: 500 },
      );
    });

    it('has no opponent-band bias: opponents differing only in weapon band score equally', () => {
      fc.assert(
        fc.property(arbBand(), arbBand(), arbBand(), arbDistance(), arbArenaRadius(), (ownBand, bandA, bandB, distance, radius) => {
          const robot = withMainBand(makeState(), ownBand);
          const oppA = withMainBand(makeState({ position: { x: distance, y: 0 }, teamIndex: 1 }), bandA);
          const oppB = withMainBand(makeState({ position: { x: distance, y: 0 }, teamIndex: 2 }), bandB);
          expect(calculateThreatScore(robot, oppA, distance, radius).score)
            .toBe(calculateThreatScore(robot, oppB, distance, radius).score);
        }),
        { numRuns: 500 },
      );
    });

    it('a melee and a long opponent at long distance score equally (no 1.5 / 0.8 weapon threat)', () => {
      const robot = withMainBand(makeState(), 'long');
      const meleeOpp = withMainBand(makeState({ teamIndex: 1 }), 'melee');
      const longOpp = withMainBand(makeState({ teamIndex: 2 }), 'long');
      expect(calculateThreatScore(robot, meleeOpp, 22, 58).score)
        .toBe(calculateThreatScore(robot, longOpp, 22, 58).score);
    });
  });

  /**
   * Season 2 round 3 threat fix: combatPower = max(totalDamageDealt, maxHP × 0.5),
   * so an opponent's threat no longer drops after its first hit.
   */
  describe('Combat power keeps the damage dealt (Season 2 round 3)', () => {
    it('is identical for damage dealt 0, 10 and maxHP × 0.5 − 1', () => {
      const robot = makeState();
      const scores = [0, 10, 49].map((dealt) =>
        calculateThreatScore(robot, makeState({ teamIndex: 1, maxHP: 100, currentHP: 100, totalDamageDealt: dealt }), 10, 16));
      for (const s of scores) {
        expect(s.factors.combatPower).toBe(100 * 0.5 * 2);
        expect(s.score).toBe(scores[0].score);
      }
    });

    it('never drops after the first hit and grows with damage above maxHP × 0.5', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5000 }),
          fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
          (maxHP, d1, d2) => {
            const [lo, hi] = d1 <= d2 ? [d1, d2] : [d2, d1];
            const robot = makeState();
            const at = (dealt: number): number =>
              calculateThreatScore(robot, makeState({ teamIndex: 1, maxHP, currentHP: maxHP, totalDamageDealt: dealt }), 10, 16).score;
            expect(at(hi)).toBeGreaterThanOrEqual(at(lo));
            expect(at(lo)).toBeGreaterThanOrEqual(at(0));
            if (lo > maxHP * 0.5 + 1) expect(at(lo)).toBeGreaterThan(at(maxHP * 0.5));
          },
        ),
        { numRuns: 500 },
      );
    });
  });
});
