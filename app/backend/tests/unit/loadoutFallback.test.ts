/**
 * Battle-time loadout fallback — T4 (PR #536, product rule 6).
 *
 * A robot whose stored loadout is incomplete but which has a main weapon fights
 * as `single` for this battle only. The override is in memory and must run
 * before `prepareRobotForCombat`, which computes the loadout bonus once from
 * `robot.loadoutType` (#517). The stored loadout never changes.
 */
import { Prisma, Robot, Weapon, WeaponInventory } from '../../generated/prisma';
import type { RobotWithWeapons } from '../../src/services/battle/combatSimulator';
import { applyLoadoutFallbacks, evaluateCombatEntry } from '../../src/services/battle/combatReadiness';
import { prepareRobotForCombat } from '../../src/utils/robotCalculations';
import { ROBOT_ATTRIBUTES } from '../../src/shared/utils/robotAttributes';

// ── Fixtures ────────────────────────────────────────────────────────

/** Distinct base values per attribute so a wrong multiplier is visible. */
function baseAttributes(): Record<string, Prisma.Decimal> {
  const attrs: Record<string, Prisma.Decimal> = {};
  ROBOT_ATTRIBUTES.forEach((attr, i) => {
    attrs[attr] = new Prisma.Decimal(10 + i);
  });
  return attrs;
}

function weapon(id: number): Weapon {
  return {
    id,
    name: `Weapon-${id}`,
    weaponType: 'energy',
    baseDamage: 20,
    cooldown: 3,
    cost: 50000,
    handsRequired: 'one',
    damageType: 'energy',
    loadoutType: 'any',
    rangeBand: 'mid',
    specialProperty: null,
    description: null,
    combatPowerBonus: 5,
    targetingSystemsBonus: 3,
    criticalSystemsBonus: 0,
    penetrationBonus: 0,
    weaponControlBonus: 0,
    attackSpeedBonus: 2,
    armorPlatingBonus: 0,
    shieldCapacityBonus: 4,
    evasionThrustersBonus: 0,
    damageDampenersBonus: 0,
    counterProtocolsBonus: 0,
    hullIntegrityBonus: 2,
    servoMotorsBonus: 0,
    gyroStabilizersBonus: 0,
    hydraulicSystemsBonus: 0,
    powerCoreBonus: 0,
    combatAlgorithmsBonus: 0,
    threatAnalysisBonus: 0,
    adaptiveAIBonus: 0,
    logicCoresBonus: 0,
    syncProtocolsBonus: 0,
    supportSystemsBonus: 0,
    formationTacticsBonus: 0,
    createdAt: new Date('2026-01-01'),
  } as unknown as Weapon;
}

function inventory(id: number): WeaponInventory & { weapon: Weapon } {
  return {
    id,
    userId: 1,
    weaponId: id,
    customName: null,
    purchasedAt: new Date('2026-01-01'),
    weapon: weapon(id),
  } as unknown as WeaponInventory & { weapon: Weapon };
}

interface StoredRow {
  id: number;
  loadoutType: string;
  hasMain: boolean;
  hasOffhand: boolean;
}

/**
 * Stand-in for a Prisma read: every call returns a fresh object, exactly as
 * each battle loads its own robot rows.
 */
function load(row: StoredRow): RobotWithWeapons {
  return {
    id: row.id,
    userId: 1,
    name: `Robot-${row.id}`,
    loadoutType: row.loadoutType,
    stance: 'balanced',
    yieldThreshold: 10,
    currentHP: 40,
    maxHP: 100,
    currentShield: 0,
    maxShield: 0,
    elo: 1200,
    mainWeaponId: row.hasMain ? 101 : null,
    offhandWeaponId: row.hasOffhand ? 102 : null,
    mainWeapon: row.hasMain ? inventory(101) : null,
    offhandWeapon: row.hasOffhand ? inventory(102) : null,
    ...baseAttributes(),
  } as unknown as Robot as RobotWithWeapons;
}

function effectiveStats(robot: RobotWithWeapons): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const attr of ROBOT_ATTRIBUTES) {
    stats[attr] = Number((robot as unknown as Record<string, unknown>)[attr]);
  }
  stats.maxHP = robot.maxHP;
  stats.maxShield = robot.maxShield;
  return stats;
}

// ── T4 ──────────────────────────────────────────────────────────────

describe('applyLoadoutFallbacks before prepareRobotForCombat (T4)', () => {
  it.each(['weapon_shield', 'dual_wield', 'not_a_loadout'])(
    'a %s robot with only a main weapon fights with exactly the single-loadout stats',
    (storedLoadout) => {
      const stored: StoredRow = { id: 1, loadoutType: storedLoadout, hasMain: true, hasOffhand: false };
      const battleRobot = load(stored);
      const decisions = [evaluateCombatEntry(battleRobot)];

      expect(applyLoadoutFallbacks([battleRobot], decisions)).toEqual([1]);
      prepareRobotForCombat(battleRobot);

      const reference = load({ ...stored, id: 2, loadoutType: 'single' });
      prepareRobotForCombat(reference);

      expect(battleRobot.loadoutType).toBe('single');
      expect(effectiveStats(battleRobot)).toEqual(effectiveStats(reference));
    },
  );

  it('the stored loadout is unchanged: a separately loaded row still reads the stored loadoutType', () => {
    const stored: StoredRow = { id: 3, loadoutType: 'weapon_shield', hasMain: true, hasOffhand: false };
    const battleRobot = load(stored);
    applyLoadoutFallbacks([battleRobot], [evaluateCombatEntry(battleRobot)]);
    prepareRobotForCombat(battleRobot);

    expect(battleRobot.loadoutType).toBe('single');
    expect(stored.loadoutType).toBe('weapon_shield');
    expect(load(stored).loadoutType).toBe('weapon_shield');
  });

  it('robots with a complete loadout are not changed', () => {
    const rows: StoredRow[] = [
      { id: 4, loadoutType: 'single', hasMain: true, hasOffhand: false },
      { id: 5, loadoutType: 'two_handed', hasMain: true, hasOffhand: false },
      { id: 6, loadoutType: 'dual_wield', hasMain: true, hasOffhand: true },
      { id: 7, loadoutType: 'weapon_shield', hasMain: true, hasOffhand: true },
    ];
    const robots = rows.map(load);

    expect(applyLoadoutFallbacks(robots, robots.map(evaluateCombatEntry))).toEqual([]);
    robots.forEach((robot, i) => {
      expect(robot.loadoutType).toBe(rows[i].loadoutType);
      prepareRobotForCombat(robot);
      const reference = load(rows[i]);
      prepareRobotForCombat(reference);
      expect(effectiveStats(robot)).toEqual(effectiveStats(reference));
    });
  });

  it('the fallback matters: without it the stored loadout bonus would apply', () => {
    // weapon_shield carries a shield-capacity bonus; single does not.
    const stored: StoredRow = { id: 8, loadoutType: 'weapon_shield', hasMain: true, hasOffhand: false };
    const unfixed = load(stored);
    prepareRobotForCombat(unfixed);
    const fixed = load(stored);
    applyLoadoutFallbacks([fixed], [evaluateCombatEntry(fixed)]);
    prepareRobotForCombat(fixed);

    expect(effectiveStats(fixed)).not.toEqual(effectiveStats(unfixed));
  });
});
