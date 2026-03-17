import * as fc from 'fast-check';
import { calculateHydraulicBonus } from '../../src/services/arena/hydraulicBonus';
import { resolveCounter } from '../../src/services/arena/counterAttack';
import { RobotCombatState, MovementIntent, RangeBand } from '../../src/services/arena/types';

/**
 * Property-based tests for hydraulicBonus, teamCoordination, and counterAttack.
 * Uses fast-check to verify universal properties across random inputs.
 */

const arbHydro = (): fc.Arbitrary<number> => fc.integer({ min: 1, max: 50 });

function makeWeapon(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Laser Pistol',
    weaponType: 'energy',
    handsRequired: 'one',
    baseDamage: 10,
    cooldown: 2,
    ...overrides,
  };
}

function makeIntent(): MovementIntent {
  return {
    targetPosition: { x: 0, y: 0 },
    strategy: 'direct_path',
    preferredRange: 'short',
    stanceSpeedModifier: 0,
  };
}

function makeState(overrides: Partial<RobotCombatState> = {}): RobotCombatState {
  return {
    robot: {
      loadoutType: 'single',
      stance: 'balanced',
      mainWeapon: { weapon: makeWeapon() } as any,
      offhandWeapon: null,
      threatAnalysis: 1,
      combatAlgorithms: 25,
      hydraulicSystems: 25,
      syncProtocols: 0,
      supportSystems: 0,
      formationTactics: 0,
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
    ...overrides,
  };
}

describe('hydraulicBonus property tests', () => {
  /**
   * Property 26: Hydraulic bonus at melee range is always ≥ hydraulic
   * bonus at short range for any hydraulicSystems value.
   * **Validates: Requirements 4.1, 4.2**
   */
  describe('Property 26: Melee bonus ≥ short bonus', () => {
    it('should have melee bonus ≥ short bonus for any hydraulicSystems', () => {
      fc.assert(
        fc.property(arbHydro(), (hydro) => {
          const meleeBonus = calculateHydraulicBonus(hydro, 'melee');
          const shortBonus = calculateHydraulicBonus(hydro, 'short');
          expect(meleeBonus).toBeGreaterThanOrEqual(shortBonus);
        }),
        { numRuns: 500 },
      );
    });
  });

  /**
   * Property 27: Hydraulic bonus at mid and long range is always exactly 1.0.
   * **Validates: Requirement 4.3**
   */
  describe('Property 27: Mid/long bonus is exactly 1.0', () => {
    it('should return exactly 1.0 for mid and long range for any hydraulicSystems', () => {
      fc.assert(
        fc.property(arbHydro(), (hydro) => {
          expect(calculateHydraulicBonus(hydro, 'mid')).toBe(1.0);
          expect(calculateHydraulicBonus(hydro, 'long')).toBe(1.0);
        }),
        { numRuns: 500 },
      );
    });
  });
});

describe('counterAttack property tests', () => {
  /**
   * Property 28: Counter-attack with melee weapon at distance > 2 always
   * returns canCounter: false (unless offhand fallback).
   * **Validates: Requirement 19.1**
   */
  describe('Property 28: Melee counter blocked beyond range 2', () => {
    it('should return canCounter=false for melee-only at distance > 2', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 2.01, max: 50, noNaN: true, noDefaultInfinity: true }),
          (distance) => {
            const defender = makeState({
              robot: {
                loadoutType: 'single',
                stance: 'balanced',
                mainWeapon: {
                  weapon: makeWeapon({
                    weaponType: 'melee',
                    name: 'Combat Knife',
                  }),
                } as any,
                offhandWeapon: null,
                hydraulicSystems: 25,
              } as any,
            });
            const attacker = makeState({
              position: { x: distance, y: 0 },
            });

            const result = resolveCounter(defender, attacker, distance);
            expect(result.canCounter).toBe(false);
            expect(result.reason).toBe('counter_out_of_range');
          },
        ),
        { numRuns: 500 },
      );
    });

    it('should return canCounter=true for melee at distance ≤ 2', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 2, noNaN: true, noDefaultInfinity: true }),
          (distance) => {
            const defender = makeState({
              robot: {
                loadoutType: 'single',
                stance: 'balanced',
                mainWeapon: {
                  weapon: makeWeapon({
                    weaponType: 'melee',
                    name: 'Combat Knife',
                  }),
                } as any,
                offhandWeapon: null,
                hydraulicSystems: 25,
              } as any,
            });
            const attacker = makeState({
              position: { x: distance, y: 0 },
            });

            const result = resolveCounter(defender, attacker, distance);
            expect(result.canCounter).toBe(true);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('should allow offhand fallback for dual-wield mixed at distance > 2', () => {
      const defender = makeState({
        robot: {
          loadoutType: 'dual_wield',
          stance: 'balanced',
          mainWeapon: {
            weapon: makeWeapon({
              weaponType: 'melee',
              name: 'Combat Knife',
            }),
          } as any,
          offhandWeapon: {
            weapon: makeWeapon({
              weaponType: 'energy',
              handsRequired: 'one',
              name: 'Laser Pistol',
            }),
          } as any,
          hydraulicSystems: 25,
        } as any,
      });
      const attacker = makeState({ position: { x: 5, y: 0 } });

      const result = resolveCounter(defender, attacker, 5);
      expect(result.canCounter).toBe(true);
      expect(result.hand).toBe('offhand');
    });
  });
});
