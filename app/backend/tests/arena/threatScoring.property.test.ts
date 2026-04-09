import * as fc from 'fast-check';
import {
  calculateThreatScore,
  selectTarget,
} from '../../src/services/arena/threatScoring';
import { RobotCombatState, MovementIntent } from '../../src/services/arena/types';

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
  });
});
