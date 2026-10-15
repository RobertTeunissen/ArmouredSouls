/**
 * T6 — the simulator's weapon invariant (rule 8, design §8).
 *
 * Every robot that reaches combat is armed: the battle-time readiness gate
 * forfeits robots without a main weapon before they are simulated. The weapon
 * accessors inside the simulator therefore no longer invent a weaponless
 * default: a missing main weapon throws `ROBOT_NOT_BATTLE_READY`, an offhand
 * lookup without an offhand throws `INVALID_BATTLE_STATE`, and counters use the
 * countering hand's real weapon (name and base damage).
 */
import { BattleError, BattleErrorCode } from '../../src/errors/battleErrors';
import { RangeBand } from '../../src/services/arena/types';
import { createArena } from '../../src/services/arena/arenaLayout';
import { getPreferredRange } from '../../src/services/arena/movementAI';
import { resolveCounter } from '../../src/services/arena/counterAttack';
import { computeMaxWeaponRange } from '../../src/services/battle/combat-simulator/spatialGrid';
import * as combatFormulas from '../../src/services/battle/combat-simulator/combatFormulas';
import {
  getWeaponInfo,
  performAttack,
  isWithinWeaponReach,
  initializeCombatState,
  buildSpatialContext,
  CombatEvent,
  RobotWithWeapons,
  SpatialRobotCombatState,
} from '../../src/services/battle/combatSimulator';

type WeaponShape = 'melee' | 'ranged';

/** Minimal weapon inventory fixture; only the fields the combat formulas read. */
function weaponFixture(
  shape: WeaponShape,
  id: number,
  overrides: { name?: string; baseDamage?: number } = {},
): RobotWithWeapons['mainWeapon'] {
  const spec: Record<WeaponShape, { name: string; weaponType: string; rangeBand: RangeBand }> = {
    melee: { name: 'Energy Blade', weaponType: 'melee', rangeBand: 'melee' },
    ranged: { name: 'Laser Pistol', weaponType: 'energy', rangeBand: 'short' },
  };
  // Test fixture cast: the formulas only read name/weaponType/rangeBand/baseDamage/cooldown.
  return {
    id,
    weaponId: id,
    customName: null,
    weapon: { id, ...spec[shape], baseDamage: 30, cooldown: 3, handsRequired: 'one', ...overrides },
  } as unknown as RobotWithWeapons['mainWeapon'];
}

/** Numeric robot fixture (prepared/effective values); armed with a ranged main weapon by default. */
function robotFixture(name: string, overrides: Record<string, unknown> = {}): RobotWithWeapons {
  // Test fixture cast: the simulator only reads the attribute, HP and weapon fields.
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
    mainWeapon: weaponFixture('ranged', 1), offhandWeapon: null,
    ...overrides,
  } as unknown as RobotWithWeapons;
}

const UNARMED = { mainWeapon: null, offhandWeapon: null };

/** Attacker at the origin, defender `distance` units along the x-axis. */
function statesAt(
  attacker: RobotWithWeapons,
  defender: RobotWithWeapons,
  distance: number,
): [SpatialRobotCombatState, SpatialRobotCombatState] {
  return [
    initializeCombatState(attacker, { x: 0, y: 0 }, { x: distance, y: 0 }, 0, 3, 4),
    initializeCombatState(defender, { x: distance, y: 0 }, { x: 0, y: 0 }, 1, 3, 4),
  ];
}

function expectBattleError(fn: () => unknown, code: string): void {
  let thrown: unknown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(BattleError);
  expect((thrown as BattleError).code).toBe(code);
}

/**
 * One main-hand attack with Math.random() pinned to 0: no malfunction (WC 50),
 * the hit and the counter roll succeed. Returns the events and the base damage
 * the defender's counter was computed from.
 */
function attackWithCounter(
  attacker: RobotWithWeapons,
  defender: RobotWithWeapons,
  distance: number,
): { events: CombatEvent[]; counterBaseDamageCalls: Array<[number, string | undefined]> } {
  const [a, d] = statesAt(attacker, defender, distance);
  const arena = createArena([1, 1]);
  const ctx = buildSpatialContext(a, d, 'main', 1, arena, [a, d]);
  const events: CombatEvent[] = [];
  const random = jest.spyOn(Math, 'random').mockReturnValue(0);
  const baseDamage = jest.spyOn(combatFormulas, 'calculateBaseDamage');
  try {
    performAttack(a, d, attacker.name, defender.name, 1, 'main', events, ctx);
    const counterBaseDamageCalls = baseDamage.mock.calls
      .filter((call) => call[0] === defender)
      .map((call): [number, string | undefined] => [call[1], call[2]]);
    return { events, counterBaseDamageCalls };
  } finally {
    random.mockRestore();
    baseDamage.mockRestore();
  }
}

describe('simulator weapon invariant: a missing main weapon throws ROBOT_NOT_BATTLE_READY', () => {
  it('getWeaponInfo', () => {
    expectBattleError(() => getWeaponInfo(robotFixture('Unarmed', UNARMED), 'main'), BattleErrorCode.ROBOT_NOT_BATTLE_READY);
  });

  it('buildSpatialContext', () => {
    const [a, d] = statesAt(robotFixture('Unarmed', UNARMED), robotFixture('Defender'), 5);
    expectBattleError(
      () => buildSpatialContext(a, d, 'main', 1, createArena([1, 1]), [a, d]),
      BattleErrorCode.ROBOT_NOT_BATTLE_READY,
    );
  });

  it('getPreferredRange (every loadout)', () => {
    for (const loadoutType of ['single', 'weapon_shield', 'two_handed', 'dual_wield', 'unknown']) {
      const [a] = statesAt(robotFixture('Unarmed', { ...UNARMED, loadoutType }), robotFixture('Defender'), 5);
      expectBattleError(() => getPreferredRange(a), BattleErrorCode.ROBOT_NOT_BATTLE_READY);
    }
  });

  it('computeMaxWeaponRange', () => {
    expectBattleError(
      () => computeMaxWeaponRange([{ mainWeapon: null, offhandWeapon: null }, { mainWeapon: null, offhandWeapon: null }]),
      BattleErrorCode.ROBOT_NOT_BATTLE_READY,
    );
  });

  it('isWithinWeaponReach', () => {
    const [a, d] = statesAt(robotFixture('Unarmed', UNARMED), robotFixture('Defender'), 1);
    expectBattleError(() => isWithinWeaponReach(a, d, 'main'), BattleErrorCode.ROBOT_NOT_BATTLE_READY);
  });

  it('resolveCounter (defender without a main weapon)', () => {
    const [a, d] = statesAt(robotFixture('Attacker'), robotFixture('Unarmed', UNARMED), 1);
    expectBattleError(() => resolveCounter(d, a, 1), BattleErrorCode.ROBOT_NOT_BATTLE_READY);
  });
});

describe('simulator weapon invariant: an offhand lookup without an offhand throws INVALID_BATTLE_STATE', () => {
  it('getWeaponInfo', () => {
    expectBattleError(() => getWeaponInfo(robotFixture('Single'), 'offhand'), BattleErrorCode.INVALID_BATTLE_STATE);
  });

  it('buildSpatialContext', () => {
    const [a, d] = statesAt(robotFixture('Single'), robotFixture('Defender'), 5);
    expectBattleError(
      () => buildSpatialContext(a, d, 'offhand', 1, createArena([1, 1]), [a, d]),
      BattleErrorCode.INVALID_BATTLE_STATE,
    );
  });

  it('isWithinWeaponReach', () => {
    const [a, d] = statesAt(robotFixture('Single'), robotFixture('Defender'), 1);
    expectBattleError(() => isWithinWeaponReach(a, d, 'offhand'), BattleErrorCode.INVALID_BATTLE_STATE);
  });
});

describe('counters use the countering hand\'s real weapon', () => {
  it('a blocked counter names the defender\'s real weapon', () => {
    const defender = robotFixture('Defender', { mainWeapon: weaponFixture('melee', 3, { name: 'Shock Maul' }) });
    const { events } = attackWithCounter(robotFixture('Attacker'), defender, 6);
    const blocked = events.filter((e) => e.type === 'counter_out_of_range');
    expect(blocked).toHaveLength(1);
    expect(blocked[0].weapon).toBe('Shock Maul');
    expect(blocked[0].message).toContain('Shock Maul');
  });

  it.each([42, 0])('a main-hand counter uses the main weapon\'s baseDamage (%i)', (baseDamage) => {
    const defender = robotFixture('Defender', { mainWeapon: weaponFixture('ranged', 3, { baseDamage }) });
    const { events, counterBaseDamageCalls } = attackWithCounter(robotFixture('Attacker'), defender, 5);
    expect(events.filter((e) => e.type === 'counter')).toHaveLength(1);
    expect(counterBaseDamageCalls).toEqual([[baseDamage, 'main']]);
  });

  it.each([17, 0])('a mixed dual-wield offhand counter uses the offhand\'s baseDamage (%i)', (baseDamage) => {
    const defender = robotFixture('Defender', {
      loadoutType: 'dual_wield',
      mainWeapon: weaponFixture('melee', 3, { baseDamage: 55 }),
      offhandWeapon: weaponFixture('ranged', 4, { baseDamage }),
    });
    const { events, counterBaseDamageCalls } = attackWithCounter(robotFixture('Attacker'), defender, 5);
    const counters = events.filter((e) => e.type === 'counter');
    expect(counters).toHaveLength(1);
    expect(counters[0].hand).toBe('offhand');
    expect(counterBaseDamageCalls).toEqual([[baseDamage, 'offhand']]);
  });
});
