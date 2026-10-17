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
    rangeBand: 'mid',
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
    numServoMotors: 1,
    numGyroStabilizers: 1,
    numThreatAnalysis: 1,
    numAdaptiveAI: 1,
    numLogicCores: 1,
    numHydraulicSystems: 25,
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
    movementMode: 'normal',
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

  /**
   * Property 27b: Hydraulic bonus is linear and uncapped (Season 2, #519 and round 3):
   * 1.75× at melee and 1.25× at short for 50 Hydraulic Systems.
   * **Validates: Balance change - melee 0.02 → 0.015, short 0.015 → 0.01 → 0.005 (round 3)**
   */
  describe('Property 27b: Linear, uncapped Season 2 coefficients', () => {
    it('should return 1.75 at melee and 1.25 at short for 50 hydraulicSystems', () => {
      expect(calculateHydraulicBonus(50, 'melee')).toBeCloseTo(1.75, 10);
      expect(calculateHydraulicBonus(50, 'short')).toBeCloseTo(1.25, 10);
    });

    it('should be linear: melee 1 + 0.015 × H, short 1 + 0.005 × H', () => {
      fc.assert(
        fc.property(arbHydro(), (hydro) => {
          expect(calculateHydraulicBonus(hydro, 'melee')).toBeCloseTo(1 + hydro * 0.015, 10);
          expect(calculateHydraulicBonus(hydro, 'short')).toBeCloseTo(1 + hydro * 0.005, 10);
        }),
        { numRuns: 500 },
      );
    });

    it('should not be capped beyond 50 hydraulicSystems', () => {
      fc.assert(
        fc.property(fc.integer({ min: 51, max: 500 }), (hydro) => {
          expect(calculateHydraulicBonus(hydro, 'melee')).toBeGreaterThan(1.75);
          expect(calculateHydraulicBonus(hydro, 'melee')).toBeCloseTo(1 + hydro * 0.015, 10);
          expect(calculateHydraulicBonus(hydro, 'short')).toBeGreaterThan(1.25);
          expect(calculateHydraulicBonus(hydro, 'short')).toBeCloseTo(1 + hydro * 0.005, 10);
        }),
        { numRuns: 200 },
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
                    rangeBand: 'melee',
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
                    rangeBand: 'melee',
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
              rangeBand: 'melee',
            }),
          } as any,
          offhandWeapon: {
            weapon: makeWeapon({
              weaponType: 'energy',
              handsRequired: 'one',
              name: 'Laser Pistol',
              rangeBand: 'mid',
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

  /**
   * Property 28b: Counter attribute bonuses follow the band (Season 2, #519).
   * Hydraulics apply only to melee-band counters (Req 19.4); Logic Cores
   * apply only to long-band counters.
   */
  describe('Property 28b: Counter hydraulic/Logic Cores bonuses by band', () => {
    function makeDefender(rangeBand: RangeBand, logicCores: number, hydraulicSystems: number): RobotCombatState {
      return makeState({
        robot: {
          loadoutType: 'single',
          stance: 'balanced',
          mainWeapon: {
            weapon: makeWeapon({
              weaponType: rangeBand === 'melee' ? 'melee' : 'ballistic',
              name: rangeBand === 'melee' ? 'Combat Knife' : 'Railgun',
              rangeBand,
            }),
          } as any,
          offhandWeapon: null,
          hydraulicSystems,
          logicCores,
        } as any,
      });
    }

    it('should apply Logic Cores (not hydraulics) to a long-band counter', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          arbHydro(),
          fc.double({ min: 13, max: 40, noNaN: true, noDefaultInfinity: true }),
          (lc, hydro, distance) => {
            const defender = makeDefender('long', lc, hydro);
            const attacker = makeState({ position: { x: distance, y: 0 } });
            const result = resolveCounter(defender, attacker, distance);
            expect(result.canCounter).toBe(true);
            expect(result.logicCoresMultiplier).toBeCloseTo(1 + lc * 0.015, 10);
            expect(result.hydraulicMultiplier).toBe(1);
          },
        ),
        { numRuns: 300 },
      );
    });

    it('should apply hydraulics (not Logic Cores) to a melee-band counter', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          arbHydro(),
          fc.double({ min: 0, max: 2, noNaN: true, noDefaultInfinity: true }),
          (lc, hydro, distance) => {
            const defender = makeDefender('melee', lc, hydro);
            const attacker = makeState({ position: { x: distance, y: 0 } });
            const result = resolveCounter(defender, attacker, distance);
            expect(result.canCounter).toBe(true);
            expect(result.hydraulicMultiplier).toBeCloseTo(1 + hydro * 0.015, 10);
            expect(result.logicCoresMultiplier).toBe(1);
          },
        ),
        { numRuns: 300 },
      );
    });

    it('should apply neither bonus to short- or mid-band counters', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          arbHydro(),
          fc.double({ min: 3, max: 12, noNaN: true, noDefaultInfinity: true }),
          (lc, hydro, distance) => {
            const defender = makeDefender('mid', lc, hydro);
            const attacker = makeState({ position: { x: distance, y: 0 } });
            const result = resolveCounter(defender, attacker, distance);
            expect(result.canCounter).toBe(true);
            expect(result.hydraulicMultiplier).toBe(1);
            expect(result.logicCoresMultiplier).toBe(1);
          },
        ),
        { numRuns: 300 },
      );
    });

    it('should report 1 for both multipliers when the counter is blocked', () => {
      const defender = makeDefender('melee', 50, 50);
      const attacker = makeState({ position: { x: 20, y: 0 } });
      const result = resolveCounter(defender, attacker, 20);
      expect(result.canCounter).toBe(false);
      expect(result.hydraulicMultiplier).toBe(1);
      expect(result.logicCoresMultiplier).toBe(1);
    });
  });
});
