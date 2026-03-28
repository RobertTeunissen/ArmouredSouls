import * as fc from 'fast-check';
import {
  applyMovement,
  getPatienceLimit,
  getPreferredRange,
} from '../../src/services/arena/movementAI';
import { euclideanDistance, Position } from '../../src/services/arena/vector2d';
import { ArenaConfig, MovementIntent, RobotCombatState, RangeBand } from '../../src/services/arena/types';

/**
 * Property-based tests for movementAI module.
 * Uses fast-check to verify universal properties across random inputs.
 */

// ─── Arbitraries ────────────────────────────────────────────────────

const arbPosition = (): fc.Arbitrary<Position> =>
  fc.record({
    x: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
    y: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
  });

const arbArenaRadius = (): fc.Arbitrary<number> =>
  fc.double({ min: 5, max: 100, noNaN: true, noDefaultInfinity: true });

const arbSpeed = (): fc.Arbitrary<number> =>
  fc.double({ min: 0.1, max: 30, noNaN: true, noDefaultInfinity: true });

const arbDeltaTime = (): fc.Arbitrary<number> =>
  fc.double({ min: 0.01, max: 1.0, noNaN: true, noDefaultInfinity: true });

const arbCombatAlgorithms = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 50 });

const arbRangeBand = (): fc.Arbitrary<RangeBand> =>
  fc.constantFrom('melee' as const, 'short' as const, 'mid' as const, 'long' as const);

const arbStance = (): fc.Arbitrary<string> =>
  fc.constantFrom('defensive', 'offensive', 'balanced');

const arbLoadoutType = (): fc.Arbitrary<string> =>
  fc.constantFrom('single', 'weapon_shield', 'two_handed', 'dual_wield');

function makeArena(radius: number): ArenaConfig {
  return {
    radius,
    center: { x: 0, y: 0 },
    spawnPositions: [{ x: -radius + 2, y: 0 }, { x: radius - 2, y: 0 }],
  };
}

function makeIntent(overrides: Partial<MovementIntent> = {}): MovementIntent {
  return {
    targetPosition: { x: 5, y: 5 },
    strategy: 'direct_path',
    preferredRange: 'short',
    stanceSpeedModifier: 0,
    ...overrides,
  };
}

/** Minimal weapon mock */
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

/** Helper to build a minimal RobotCombatState for testing */
function makeState(overrides: Partial<RobotCombatState> = {}): RobotCombatState {
  return {
    robot: {
      loadoutType: 'single',
      stance: 'balanced',
      mainWeapon: { weapon: makeWeapon() } as any,
      offhandWeapon: null,
      threatAnalysis: 1,
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
    totalDamageDealt: 0,
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

describe('movementAI property tests', () => {
  /**
   * Property 16: applyMovement always produces a position inside the arena
   * boundary for any input.
   * **Validates: Requirements 1.7, 5.2**
   */
  describe('Property 16: applyMovement always inside arena', () => {
    it('should return a position with distance from center ≤ radius for any input', () => {
      fc.assert(
        fc.property(
          arbPosition(),
          arbPosition(),
          arbArenaRadius(),
          arbSpeed(),
          arbDeltaTime(),
          (robotPos, targetPos, radius, speed, dt) => {
            const arena = makeArena(radius);
            const state = makeState({
              position: robotPos,
              effectiveMovementSpeed: speed,
            });
            const intent = makeIntent({ targetPosition: targetPos });

            const newPos = applyMovement(state, intent, arena, dt);
            const distFromCenter = euclideanDistance(newPos, arena.center);

            expect(distFromCenter).toBeLessThanOrEqual(radius + 1e-9);
          },
        ),
        { numRuns: 500 },
      );
    });
  });

  /**
   * Property 17: Patience timer limit is always between 10 and 15 seconds
   * for any combatAlgorithms value (1–50).
   * **Validates: Requirement 5.7**
   */
  describe('Property 17: Patience timer limit in [10, 15]', () => {
    it('should return a value in [10, 15] for any combatAlgorithms in [1, 50]', () => {
      fc.assert(
        fc.property(arbCombatAlgorithms(), (ca) => {
          const score = ca / 50; // combatAlgorithmScore
          const limit = getPatienceLimit(score);

          expect(limit).toBeGreaterThanOrEqual(10);
          expect(limit).toBeLessThanOrEqual(15);
        }),
        { numRuns: 500 },
      );
    });
  });

  /**
   * Property 18: getPreferredRange always returns a valid RangeBand
   * for any weapon configuration.
   * **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
   */
  describe('Property 18: getPreferredRange returns valid RangeBand', () => {
    const validRangeBands: RangeBand[] = ['melee', 'short', 'mid', 'long'];

    it('should return a valid RangeBand for single/weapon_shield/two_handed loadouts', () => {
      const weaponTypes = ['melee', 'energy', 'ballistic', 'shield'];
      const hands = ['one', 'two', 'shield'];
      const names = [
        'Combat Knife', 'Laser Pistol', 'Sniper Rifle',
        'Railgun', 'Ion Beam', 'Shotgun', 'Light Shield',
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...weaponTypes),
          fc.constantFrom(...hands),
          fc.constantFrom(...names),
          fc.constantFrom('single', 'weapon_shield', 'two_handed'),
          (wType, wHands, wName, loadout) => {
            const state = makeState({
              robot: {
                loadoutType: loadout,
                stance: 'balanced',
                mainWeapon: {
                  weapon: makeWeapon({
                    weaponType: wType,
                    handsRequired: wHands,
                    name: wName,
                  }),
                } as any,
                offhandWeapon: null,
              } as any,
              combatAlgorithmScore: 0.5,
            });

            const range = getPreferredRange(state);
            expect(validRangeBands).toContain(range);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('should return a valid RangeBand for dual_wield loadouts with mixed weapons', () => {
      const weaponConfigs = [
        { weaponType: 'melee', handsRequired: 'one', name: 'Combat Knife', baseDamage: 15, cooldown: 1, rangeBand: 'melee' },
        { weaponType: 'energy', handsRequired: 'one', name: 'Laser Pistol', baseDamage: 10, cooldown: 2, rangeBand: 'mid' },
        { weaponType: 'ballistic', handsRequired: 'one', name: 'Machine Pistol', baseDamage: 8, cooldown: 1, rangeBand: 'short' },
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...weaponConfigs),
          fc.constantFrom(...weaponConfigs),
          fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
          (mainW, offhandW, score) => {
            const state = makeState({
              robot: {
                loadoutType: 'dual_wield',
                stance: 'balanced',
                mainWeapon: { weapon: makeWeapon(mainW) } as any,
                offhandWeapon: { weapon: makeWeapon(offhandW) } as any,
              } as any,
              combatAlgorithmScore: score,
            });

            const range = getPreferredRange(state);
            expect(validRangeBands).toContain(range);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('should return a valid RangeBand when no weapons are equipped', () => {
      const state = makeState({
        robot: {
          loadoutType: 'single',
          stance: 'balanced',
          mainWeapon: null,
          offhandWeapon: null,
        } as any,
      });

      const range = getPreferredRange(state);
      expect(validRangeBands).toContain(range);
    });
  });
});
