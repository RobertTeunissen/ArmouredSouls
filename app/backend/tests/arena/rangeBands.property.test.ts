import * as fc from 'fast-check';
import {
  canAttack,
  classifyRangeBand,
  getRangePenalty,
  getWeaponOptimalRange,
  WeaponLike,
} from '../../src/services/arena/rangeBands';
import { RangeBand } from '../../src/services/arena/types';
import { createArena } from '../../src/services/arena/arenaLayout';
import {
  performAttack,
  isWithinWeaponReach,
  initializeCombatState,
  buildSpatialContext,
  CombatEvent,
  RobotWithWeapons,
  SpatialRobotCombatState,
} from '../../src/services/battle/combatSimulator';

/**
 * Property-based tests for rangeBands module.
 * Uses fast-check to verify universal properties across random inputs.
 */

/** Numeric index for range band ordering: melee=0, short=1, mid=2, long=3 */
const BAND_INDEX: Record<RangeBand, number> = {
  melee: 0,
  short: 1,
  mid: 2,
  long: 3,
};

/** All valid range bands */
const ALL_BANDS: RangeBand[] = ['melee', 'short', 'mid', 'long'];

/** Arbitrary for non-negative distances */
const arbDistance = (): fc.Arbitrary<number> =>
  fc.double({ min: 0, max: 1e4, noNaN: true, noDefaultInfinity: true });

/** Arbitrary for a weapon with any range band */
const arbWeapon = (): fc.Arbitrary<WeaponLike> =>
  fc.record({
    name: fc.string({ minLength: 1, maxLength: 30 }),
    rangeBand: fc.constantFrom(...ALL_BANDS),
  });

/** Arbitrary for a melee weapon */
const arbMeleeWeapon = (): fc.Arbitrary<WeaponLike> =>
  fc.record({
    name: fc.string({ minLength: 1, maxLength: 30 }),
    rangeBand: fc.constant('melee' as RangeBand),
  });

/** Arbitrary for a shield weapon (shields have melee rangeBand) */
const arbShieldWeapon = (): fc.Arbitrary<WeaponLike> =>
  fc.record({
    name: fc.oneof(
      fc.constant('Light Shield'),
      fc.constant('Combat Shield'),
      fc.constant('Reactive Shield'),
      fc.string({ minLength: 1, maxLength: 30 })
    ),
    rangeBand: fc.constant('melee' as RangeBand),
  });

describe('rangeBands property tests', () => {
  /**
   * Property 7: classifyRangeBand is monotonic — increasing distance never produces a "closer" range band
   * **Validates: Requirement 3.1**
   */
  describe('Property 7: classifyRangeBand monotonicity', () => {
    it('should never produce a closer range band when distance increases (d1 < d2 implies band order non-decreasing)', () => {
      fc.assert(
        fc.property(arbDistance(), arbDistance(), (a, b) => {
          const d1 = Math.min(a, b);
          const d2 = Math.max(a, b);
          const band1 = classifyRangeBand(d1);
          const band2 = classifyRangeBand(d2);
          expect(BAND_INDEX[band2]).toBeGreaterThanOrEqual(BAND_INDEX[band1]);
        }),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 8: getRangePenalty returns exactly 1.1 when weaponRange equals currentRange for all range bands
   * **Validates: Requirement 3.6**
   */
  describe('Property 8: getRangePenalty optimal at same band', () => {
    it('should return exactly 1.1 when weaponRange equals currentRange for all range bands', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALL_BANDS), (band: RangeBand) => {
          expect(getRangePenalty(band, band)).toBe(1.1);
        }),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 9: getWeaponOptimalRange always returns the stored rangeBand
   * **Validates: Requirement 3.4**
   */
  describe('Property 9: getWeaponOptimalRange returns stored rangeBand', () => {
    it('should return the weapon rangeBand for any weapon', () => {
      fc.assert(
        fc.property(arbWeapon(), (weapon: WeaponLike) => {
          expect(getWeaponOptimalRange(weapon)).toBe(weapon.rangeBand);
        }),
        { numRuns: 500 }
      );
    });

    it('should return melee for any melee weapon', () => {
      fc.assert(
        fc.property(arbMeleeWeapon(), (weapon: WeaponLike) => {
          expect(getWeaponOptimalRange(weapon)).toBe('melee');
        }),
        { numRuns: 500 }
      );
    });

    it('should return melee for any shield weapon', () => {
      fc.assert(
        fc.property(arbShieldWeapon(), (weapon: WeaponLike) => {
          expect(getWeaponOptimalRange(weapon)).toBe('melee');
        }),
        { numRuns: 500 }
      );
    });
  });
});

// ─── Physical reach invariant (#518) ────────────────────────────────

/** Distances strictly beyond the 2-unit melee reach. */
const arbBeyondReach = (max: number): fc.Arbitrary<number> =>
  fc.double({ min: 2, minExcluded: true, max, noNaN: true, noDefaultInfinity: true });

/** Distances within the 2-unit melee reach (2 itself is legal). */
const arbWithinReach = (): fc.Arbitrary<number> =>
  fc.double({ min: 0, max: 2, noNaN: true, noDefaultInfinity: true });

type WeaponShape = 'melee' | 'energyMelee' | 'shield' | 'ranged';

/** Minimal weapon inventory fixture; only the fields the combat formulas read. */
function weaponFixture(shape: WeaponShape, id: number): RobotWithWeapons['mainWeapon'] {
  const specs: Record<WeaponShape, { name: string; weaponType: string; rangeBand: RangeBand }> = {
    melee: { name: 'Energy Blade', weaponType: 'melee', rangeBand: 'melee' },
    energyMelee: { name: 'Shock Maul', weaponType: 'energy', rangeBand: 'melee' },
    shield: { name: 'Combat Shield', weaponType: 'shield', rangeBand: 'melee' },
    ranged: { name: 'Laser Pistol', weaponType: 'energy', rangeBand: 'short' },
  };
  const spec = specs[shape];
  // Test fixture cast: the formulas only read name/weaponType/rangeBand/baseDamage/cooldown.
  return {
    id,
    weaponId: id,
    customName: null,
    weapon: { id, ...spec, baseDamage: 30, cooldown: 3, handsRequired: 'one' },
  } as unknown as RobotWithWeapons['mainWeapon'];
}

/** Minimal numeric robot fixture (attributes are prepared/effective values). */
function robotFixture(
  name: string,
  overrides: Record<string, unknown> = {},
): RobotWithWeapons {
  // Test fixture cast: performAttack only reads the attribute, HP and weapon fields.
  return {
    id: name.length,
    name,
    combatPower: 20, targetingSystems: 20, criticalSystems: 10, penetration: 10,
    weaponControl: 50, attackSpeed: 20, armorPlating: 10, shieldCapacity: 10,
    evasionThrusters: 10, damageDampeners: 10, counterProtocols: 10, hullIntegrity: 20,
    servoMotors: 10, gyroStabilizers: 10, hydraulicSystems: 10, powerCore: 10,
    combatAlgorithms: 10, threatAnalysis: 10, adaptiveAI: 10, logicCores: 10,
    syncProtocols: 0, supportSystems: 0, formationTactics: 0,
    currentHP: 1000, maxHP: 1000, currentShield: 100, maxShield: 100,
    yieldThreshold: 0, loadoutType: 'single', stance: 'balanced',
    mainWeapon: null, offhandWeapon: null,
    ...overrides,
  } as unknown as RobotWithWeapons;
}

/** Robot fixture holding `shape` in the requested hand. */
function attackerWith(shape: WeaponShape, hand: 'main' | 'offhand'): RobotWithWeapons {
  return hand === 'main'
    ? robotFixture('Attacker', { mainWeapon: weaponFixture(shape, 1) })
    : robotFixture('Attacker', {
        loadoutType: 'dual_wield',
        mainWeapon: weaponFixture('ranged', 1),
        offhandWeapon: weaponFixture(shape, 2),
      });
}

/** Attack attempt at `distance` along the x-axis, returning what it produced. */
function attemptAttack(
  attacker: RobotWithWeapons,
  defender: RobotWithWeapons,
  distance: number,
  hand: 'main' | 'offhand',
  options: { contextDistance?: number; randomValue?: number } = {},
): {
  result: unknown;
  events: CombatEvent[];
  randomCalls: number;
  attackerState: SpatialRobotCombatState;
  defenderState: SpatialRobotCombatState;
  attackerBefore: string;
  defenderBefore: string;
} {
  const arena = createArena([1, 1]);
  const attackerState = initializeCombatState(attacker, { x: 0, y: 0 }, { x: distance, y: 0 }, 0, 3, 4);
  const defenderState = initializeCombatState(defender, { x: distance, y: 0 }, { x: 0, y: 0 }, 1, 3, 4);
  const states = [attackerState, defenderState];
  const ctx = buildSpatialContext(attackerState, defenderState, hand, 1, arena, states);
  if (options.contextDistance !== undefined) ctx.distance = options.contextDistance;
  const snapshot = (s: SpatialRobotCombatState): string => JSON.stringify({
    hp: s.currentHP, shield: s.currentShield, miss: s.missCount, hits: s.hitsTaken,
    adaptHit: s.adaptationHitBonus, adaptDmg: s.adaptationDamageBonus,
    dealt: s.totalDamageDealt, taken: s.totalDamageTaken,
  });
  const attackerBefore = snapshot(attackerState);
  const defenderBefore = snapshot(defenderState);
  const events: CombatEvent[] = [];
  const spy = jest.spyOn(Math, 'random');
  if (options.randomValue !== undefined) spy.mockReturnValue(options.randomValue);
  try {
    const result: unknown = performAttack(
      attackerState, defenderState, attacker.name, defender.name, 1, hand, events, ctx,
    );
    return {
      result, events, randomCalls: spy.mock.calls.length,
      attackerState, defenderState,
      attackerBefore: attackerBefore === snapshot(attackerState) ? 'unchanged' : 'changed',
      defenderBefore: defenderBefore === snapshot(defenderState) ? 'unchanged' : 'changed',
    };
  } finally {
    spy.mockRestore();
  }
}

const RESOLVED_ATTACK_TYPES = ['attack', 'critical', 'miss', 'malfunction'];
const COUNTER_TYPES = ['counter', 'counter_out_of_range'];

describe('Physical reach invariant (#518)', () => {
  describe('canAttack reach predicate', () => {
    it('melee-band weapons reach exactly when distance <= 2', () => {
      fc.assert(
        fc.property(arbMeleeWeapon(), arbDistance(), (weapon, d) => {
          expect(canAttack(weapon, d)).toBe(d <= 2);
        }),
        { numRuns: 500 }
      );
    });

    it('melee-band weapons never reach beyond 2 and always reach at exactly 2', () => {
      fc.assert(
        fc.property(arbMeleeWeapon(), arbBeyondReach(1e4), (weapon, d) => {
          expect(canAttack(weapon, d)).toBe(false);
          expect(canAttack(weapon, 2)).toBe(true);
        }),
        { numRuns: 500 }
      );
    });

    it('non-melee bands reach any distance', () => {
      fc.assert(
        fc.property(fc.constantFrom<RangeBand>('short', 'mid', 'long'), arbDistance(), (rangeBand, d) => {
          expect(canAttack({ name: 'Ranged', rangeBand }, d)).toBe(true);
        }),
        { numRuns: 500 }
      );
    });
  });

  describe('isWithinWeaponReach', () => {
    /** Attacker at the origin, defender `distance` units along the x-axis. */
    function reachAt(attacker: RobotWithWeapons, distance: number, hand: 'main' | 'offhand'): boolean {
      const a = initializeCombatState(attacker, { x: 0, y: 0 }, { x: distance, y: 0 }, 0, 3, 4);
      const d = initializeCombatState(robotFixture('Defender'), { x: distance, y: 0 }, { x: 0, y: 0 }, 1, 3, 4);
      return isWithinWeaponReach(a, d, hand);
    }

    it.each<WeaponShape>(['melee', 'energyMelee', 'shield'])('%s band reaches at exactly 2, not at 2 + ε, in either hand', (shape) => {
      for (const hand of ['main', 'offhand'] as const) {
        expect(reachAt(attackerWith(shape, hand), 2, hand)).toBe(true);
        expect(reachAt(attackerWith(shape, hand), 2 + 1e-9, hand)).toBe(false);
        expect(reachAt(attackerWith(shape, hand), 2 + Number.EPSILON * 2, hand)).toBe(false);
      }
    });

    it('ranged weapons reach any distance', () => {
      fc.assert(
        fc.property(fc.constantFrom<'main' | 'offhand'>('main', 'offhand'), arbDistance(), (hand, d) => {
          expect(reachAt(attackerWith('ranged', hand), d, hand)).toBe(true);
        }),
        { numRuns: 200 }
      );
    });

    it('an empty hand (Fists) keeps its any-distance behaviour', () => {
      fc.assert(
        fc.property(arbDistance(), (d) => {
          expect(reachAt(robotFixture('Unarmed'), d, 'main')).toBe(true);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('performAttack guard', () => {
    it('blocks melee-band weapons beyond reach in either hand: no RNG, no events, no state change', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<WeaponShape>('melee', 'energyMelee'),
          fc.constantFrom<'main' | 'offhand'>('main', 'offhand'),
          arbBeyondReach(1e3),
          (shape, hand, d) => {
            const outcome = attemptAttack(attackerWith(shape, hand), robotFixture('Defender'), d, hand);
            expect(outcome.result).toBe(false);
            expect(outcome.events).toHaveLength(0);
            expect(outcome.randomCalls).toBe(0);
            expect(outcome.attackerBefore).toBe('unchanged');
            expect(outcome.defenderBefore).toBe('unchanged');
          },
        ),
        { numRuns: 200 }
      );
    });

    it('resolves melee-band weapons within reach (2 inclusive) with exactly one attack event', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<WeaponShape>('melee', 'energyMelee'),
          fc.constantFrom<'main' | 'offhand'>('main', 'offhand'),
          fc.oneof(arbWithinReach(), fc.constant(2)),
          (shape, hand, d) => {
            const outcome = attemptAttack(attackerWith(shape, hand), robotFixture('Defender'), d, hand);
            expect(outcome.result).toBe(true);
            const resolved = outcome.events.filter(e => RESOLVED_ATTACK_TYPES.includes(e.type) && e.hand === hand);
            expect(resolved).toHaveLength(1);
          },
        ),
        { numRuns: 200 }
      );
    });

    it('resolves ranged weapons at any distance with exactly one attack event', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<'main' | 'offhand'>('main', 'offhand'),
          fc.double({ min: 0, max: 50, noNaN: true, noDefaultInfinity: true }),
          (hand, d) => {
            const outcome = attemptAttack(attackerWith('ranged', hand), robotFixture('Defender'), d, hand);
            expect(outcome.result).toBe(true);
            const resolved = outcome.events.filter(e => RESOLVED_ATTACK_TYPES.includes(e.type) && e.hand === hand);
            expect(resolved).toHaveLength(1);
          },
        ),
        { numRuns: 200 }
      );
    });

    it('measures real positions, so a forged context distance cannot bypass reach', () => {
      const outcome = attemptAttack(attackerWith('melee', 'main'), robotFixture('Defender'), 5, 'main', { contextDistance: 1 });
      expect(outcome.result).toBe(false);
      expect(outcome.events).toHaveLength(0);
      expect(outcome.randomCalls).toBe(0);
    });
  });

  describe('counters keep their reach restriction', () => {
    // Math.random() pinned to 0: no malfunction (WC 50), every hit and counter roll succeeds.
    const ZERO_RANDOM = { randomValue: 0 };

    it('a melee defender counters an in-reach melee attack within reach', () => {
      fc.assert(
        fc.property(arbWithinReach(), (d) => {
          const outcome = attemptAttack(
            attackerWith('melee', 'main'),
            robotFixture('Defender', { mainWeapon: weaponFixture('melee', 3) }),
            d, 'main', ZERO_RANDOM,
          );
          const counters = outcome.events.filter(e => e.type === 'counter');
          expect(counters).toHaveLength(1);
          expect(counters[0].distance).toBeLessThanOrEqual(2);
        }),
        { numRuns: 200 }
      );
    });

    it('a melee-only defender cannot counter a ranged attack beyond reach', () => {
      fc.assert(
        fc.property(arbBeyondReach(30), (d) => {
          const outcome = attemptAttack(
            attackerWith('ranged', 'main'),
            robotFixture('Defender', { mainWeapon: weaponFixture('melee', 3) }),
            d, 'main', ZERO_RANDOM,
          );
          expect(outcome.events.filter(e => e.type === 'counter')).toHaveLength(0);
          expect(outcome.events.filter(e => e.type === 'counter_out_of_range')).toHaveLength(1);
          expect(outcome.attackerState.currentHP).toBe(outcome.attackerState.maxHP);
          expect(outcome.attackerState.totalDamageTaken).toBe(0);
        }),
        { numRuns: 200 }
      );
    });

    it('a melee attempt blocked by reach cannot be countered', () => {
      fc.assert(
        fc.property(arbBeyondReach(30), (d) => {
          const outcome = attemptAttack(
            attackerWith('melee', 'main'),
            robotFixture('Defender', { mainWeapon: weaponFixture('ranged', 3) }),
            d, 'main', ZERO_RANDOM,
          );
          expect(outcome.events.filter(e => COUNTER_TYPES.includes(e.type))).toHaveLength(0);
          expect(outcome.attackerState.totalDamageTaken).toBe(0);
        }),
        { numRuns: 200 }
      );
    });
  });
});
