import { describe, it, expect } from 'vitest';
import {
  calculateAttributeBonus,
  getLoadoutBonus,
  getStanceModifier,
  calculateEffectiveStat,
  calculateEffectiveStats,
  calculateCombatEffectiveStat,
  calculateCombatEffectiveStats,
  roundToCombatPrecision,
  COMBAT_STAT_DECIMALS,
  calculateMaxHP,
  calculateMaxShield,
  getAttributeDisplay,
  getLoadoutModifiedAttributes,
  formatLoadoutName,
  getLoadoutDescription,
  LOADOUT_BONUSES,
  STANCE_MODIFIERS,
  type TuningAttributeMap,
} from '../robotStats';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Minimal weapon inventory factory */
function makeWeaponInventory(bonuses: Record<string, number> = {}) {
  return { weapon: bonuses };
}

/** Minimal robot factory with all 23 attributes defaulting to 10 */
function makeRobot(overrides: Record<string, unknown> = {}) {
  return {
    loadoutType: 'single',
    mainWeapon: null,
    offhandWeapon: null,
    combatPower: 10,
    targetingSystems: 10,
    criticalSystems: 10,
    penetration: 10,
    weaponControl: 10,
    attackSpeed: 10,
    armorPlating: 10,
    shieldCapacity: 10,
    evasionThrusters: 10,
    damageDampeners: 10,
    counterProtocols: 10,
    hullIntegrity: 10,
    servoMotors: 10,
    gyroStabilizers: 10,
    hydraulicSystems: 10,
    powerCore: 10,
    combatAlgorithms: 10,
    threatAnalysis: 10,
    adaptiveAI: 10,
    logicCores: 10,
    syncProtocols: 10,
    supportSystems: 10,
    formationTactics: 10,
    ...overrides,
  } as Parameters<typeof calculateEffectiveStats>[0];
}

// ─── Task 1.1 ───────────────────────────────────────────────────────────────

describe('calculateAttributeBonus', () => {
  it('should return bonus from main weapon only', () => {
    const main = makeWeaponInventory({ combatPowerBonus: 5 });
    expect(calculateAttributeBonus('combatPower', main, null)).toBe(5);
  });

  it('should return bonus from offhand weapon only', () => {
    const offhand = makeWeaponInventory({ armorPlatingBonus: 3 });
    expect(calculateAttributeBonus('armorPlating', null, offhand)).toBe(3);
  });

  it('should sum bonuses from both weapons', () => {
    const main = makeWeaponInventory({ attackSpeedBonus: 4 });
    const offhand = makeWeaponInventory({ attackSpeedBonus: 2 });
    expect(calculateAttributeBonus('attackSpeed', main, offhand)).toBe(6);
  });

  it('should return 0 when both weapons are null', () => {
    expect(calculateAttributeBonus('combatPower', null, null)).toBe(0);
  });

  it('should return 0 when both weapons are undefined', () => {
    expect(calculateAttributeBonus('combatPower', undefined, undefined)).toBe(0);
  });

  it('should return 0 when attribute is not present on weapon', () => {
    const main = makeWeaponInventory({ combatPowerBonus: 5 });
    expect(calculateAttributeBonus('shieldCapacity', main, null)).toBe(0);
  });

  it('should treat an inventory row loaded without its weapon relation as contributing 0', () => {
    // Test cast: simulates a Prisma inventory row fetched without `include: { weapon: true }`.
    const unloaded = {} as unknown as Parameters<typeof calculateAttributeBonus>[1];
    const offhand = makeWeaponInventory({ combatPowerBonus: 4 });
    expect(calculateAttributeBonus('combatPower', unloaded, null)).toBe(0);
    expect(calculateAttributeBonus('combatPower', unloaded, offhand)).toBe(4);
    expect(calculateAttributeBonus('combatPower', offhand, unloaded)).toBe(4);
    expect(calculateEffectiveStats(makeRobot({ mainWeapon: unloaded, offhandWeapon: unloaded })).combatPower).toBe(10);
  });
});

describe('getLoadoutBonus', () => {
  it('should return correct bonus for weapon_shield loadout', () => {
    expect(getLoadoutBonus('weapon_shield', 'shieldCapacity')).toBe(0.20);
    expect(getLoadoutBonus('weapon_shield', 'armorPlating')).toBe(0.15);
    expect(getLoadoutBonus('weapon_shield', 'counterProtocols')).toBe(0.10);
    expect(getLoadoutBonus('weapon_shield', 'attackSpeed')).toBe(-0.15);
  });

  it('should return correct bonus for two_handed loadout', () => {
    expect(getLoadoutBonus('two_handed', 'combatPower')).toBe(0.10);
    expect(getLoadoutBonus('two_handed', 'criticalSystems')).toBe(0.20);
    expect(getLoadoutBonus('two_handed', 'evasionThrusters')).toBe(-0.10);
  });

  it('should return correct bonus for dual_wield loadout', () => {
    expect(getLoadoutBonus('dual_wield', 'attackSpeed')).toBe(0.30);
    expect(getLoadoutBonus('dual_wield', 'weaponControl')).toBe(0.15);
    expect(getLoadoutBonus('dual_wield', 'penetration')).toBe(-0.20);
    expect(getLoadoutBonus('dual_wield', 'combatPower')).toBe(-0.10);
  });

  it('should return correct bonus for single loadout', () => {
    expect(getLoadoutBonus('single', 'gyroStabilizers')).toBe(0.10);
    expect(getLoadoutBonus('single', 'servoMotors')).toBe(0.05);
  });

  it('should return 0 for unknown loadout type', () => {
    expect(getLoadoutBonus('unknown_type', 'combatPower')).toBe(0);
  });

  it('should return 0 for attribute not in loadout bonuses', () => {
    expect(getLoadoutBonus('single', 'combatPower')).toBe(0);
  });
});

describe('getStanceModifier', () => {
  it('should return correct modifiers for offensive stance', () => {
    expect(getStanceModifier('offensive', 'combatPower')).toBe(0.15);
    expect(getStanceModifier('offensive', 'attackSpeed')).toBe(0.10);
    expect(getStanceModifier('offensive', 'counterProtocols')).toBe(-0.10);
    expect(getStanceModifier('offensive', 'evasionThrusters')).toBe(-0.10);
  });

  it('should return correct modifiers for defensive stance', () => {
    expect(getStanceModifier('defensive', 'armorPlating')).toBe(0.15);
    expect(getStanceModifier('defensive', 'counterProtocols')).toBe(0.15);
    expect(getStanceModifier('defensive', 'combatPower')).toBe(-0.10);
    expect(getStanceModifier('defensive', 'attackSpeed')).toBe(-0.10);
  });

  it('should return 0 for balanced stance (no modifiers)', () => {
    expect(getStanceModifier('balanced', 'combatPower')).toBe(0);
    expect(getStanceModifier('balanced', 'armorPlating')).toBe(0);
  });

  it('should return 0 for unknown stance', () => {
    expect(getStanceModifier('unknown_stance', 'combatPower')).toBe(0);
  });
});

describe('calculateEffectiveStat', () => {
  it('should floor the result', () => {
    // (10 + 3) * 1.15 = 14.95 → floor to 14
    expect(calculateEffectiveStat(10, 3, 0.15)).toBe(14);
  });

  it('should handle zero loadout bonus (multiplier = 1)', () => {
    expect(calculateEffectiveStat(10, 5, 0)).toBe(15);
  });

  it('should apply positive loadout multiplier', () => {
    // (10 + 0) * 1.20 = 12
    expect(calculateEffectiveStat(10, 0, 0.20)).toBe(12);
  });

  it('should apply negative loadout multiplier', () => {
    // (10 + 0) * 0.85 = 8.5 → floor to 8
    expect(calculateEffectiveStat(10, 0, -0.15)).toBe(8);
  });

  it('should combine weapon bonus and loadout multiplier', () => {
    // (20 + 5) * 1.30 = 32.5 → floor to 32
    expect(calculateEffectiveStat(20, 5, 0.30)).toBe(32);
  });
});

// ─── #517: canonical combat-precision calculation ───────────────────────────

describe('calculateCombatEffectiveStat', () => {
  it('keeps two-decimal combat precision', () => {
    // Dual Wield attack speed: (10 + 3 + 3) × 1.30 = 20.8
    expect(calculateCombatEffectiveStat(10, 3 + 3, 0.30)).toBe(20.8);
    expect(COMBAT_STAT_DECIMALS).toBe(2);
    expect(roundToCombatPrecision(1.23456)).toBe(1.23);
  });

  it('applies negative weapon bonuses before the loadout multiplier', () => {
    // Dual Wield penetration: (10 − 3 − 1 + 1.5) × 0.80 = 6
    expect(calculateCombatEffectiveStat(10, -3 + -1, -0.20, 1.5)).toBe(6);
  });

  it('display value is the floor of the combat value', () => {
    const combat = calculateCombatEffectiveStat(10, 6, 0.30);
    expect(calculateEffectiveStat(10, 6, 0.30)).toBe(Math.floor(combat));
  });

  it('display agrees with combat at a rounding boundary', () => {
    // Weapon + Shield, shield capacity 3.33: raw 3.33 × 1.20 = 3.996 → combat 4.00 → display 4
    // (flooring the raw product directly would have shown 3 while combat used 4.00).
    expect(calculateCombatEffectiveStat(3.33, 0, 0.20)).toBe(4);
    expect(calculateEffectiveStat(3.33, 0, 0.20)).toBe(4);
  });

  it.each(
    Object.entries(LOADOUT_BONUSES).flatMap(([loadout, bonuses]) =>
      Object.entries(bonuses).map(([attr, bonus]) => ({ loadout, attr, bonus })),
    ),
  )('applies $loadout $attr modifier ($bonus) exactly once', ({ loadout, attr, bonus }) => {
    const robot = makeRobot({
      loadoutType: loadout,
      mainWeapon: makeWeaponInventory({ [`${attr}Bonus`]: 4 }),
      offhandWeapon: makeWeaponInventory({ [`${attr}Bonus`]: -1 }),
    });
    const tuning: TuningAttributeMap = { [attr]: 2 };
    const combat = calculateCombatEffectiveStats(robot, tuning);
    const display = calculateEffectiveStats(robot, tuning);
    const expected = Math.round((10 + 4 - 1 + 2) * (1 + bonus) * 100) / 100;
    expect(combat[attr]).toBe(expected);
    expect(display[attr]).toBe(Math.floor(expected));
  });

  it('applies no multiplier for an unknown loadout', () => {
    const robot = makeRobot({ loadoutType: 'unknown', attackSpeed: 12.346 });
    expect(calculateCombatEffectiveStats(robot).attackSpeed).toBe(12.35);
  });
});


// ─── Task 1.2 ───────────────────────────────────────────────────────────────

describe('calculateEffectiveStats', () => {
  it('should return all 23 attributes for a robot with no weapons and single loadout', () => {
    const robot = makeRobot();
    const stats = calculateEffectiveStats(robot);

    const expectedAttributes = [
      'combatPower', 'targetingSystems', 'criticalSystems', 'penetration',
      'weaponControl', 'attackSpeed', 'armorPlating', 'shieldCapacity',
      'evasionThrusters', 'damageDampeners', 'counterProtocols', 'hullIntegrity',
      'servoMotors', 'gyroStabilizers', 'hydraulicSystems', 'powerCore',
      'combatAlgorithms', 'threatAnalysis', 'adaptiveAI', 'logicCores',
      'syncProtocols', 'supportSystems', 'formationTactics',
    ];

    expect(Object.keys(stats)).toHaveLength(23);
    expectedAttributes.forEach(attr => {
      expect(stats).toHaveProperty(attr);
    });
  });

  it('should apply weapon bonuses and loadout modifiers to stats', () => {
    const robot = makeRobot({
      loadoutType: 'two_handed',
      mainWeapon: makeWeaponInventory({ combatPowerBonus: 5 }),
      combatPower: 20,
      criticalSystems: 15,
      evasionThrusters: 12,
    });
    const stats = calculateEffectiveStats(robot);

    // combatPower: (20 + 5) * 1.10 = 27.5 → 27
    expect(stats.combatPower).toBe(27);
    // criticalSystems: (15 + 0) * 1.20 = 18
    expect(stats.criticalSystems).toBe(18);
    // evasionThrusters: (12 + 0) * 0.90 = 10.8 → 10
    expect(stats.evasionThrusters).toBe(10);
  });
});

describe('calculateMaxHP', () => {
  it('should calculate HP as 50 + hullIntegrity × 5', () => {
    const robot = makeRobot({ hullIntegrity: 10 });
    // single loadout: hullIntegrity has no bonus → effective = 10
    // HP = 50 + 10 * 5 = 100
    expect(calculateMaxHP(robot)).toBe(100);
  });

  it('should use effective hull integrity (with loadout bonus)', () => {
    const robot = makeRobot({ loadoutType: 'single', hullIntegrity: 20 });
    // single loadout has no hullIntegrity bonus → effective = 20
    // HP = 50 + 20 * 5 = 150
    expect(calculateMaxHP(robot)).toBe(150);
  });

  it('should include weapon bonuses in hull integrity calculation', () => {
    const robot = makeRobot({
      hullIntegrity: 10,
      mainWeapon: makeWeaponInventory({ hullIntegrityBonus: 5 }),
    });
    // effective hullIntegrity = (10 + 5) * 1.0 = 15 (single loadout, no hull bonus)
    // HP = 50 + 15 * 5 = 125
    expect(calculateMaxHP(robot)).toBe(125);
  });
});

describe('calculateMaxShield', () => {
  it('should calculate shield as shieldCapacity × 4', () => {
    const robot = makeRobot({ shieldCapacity: 10 });
    // single loadout: no shieldCapacity bonus → effective = 10
    // Shield = 10 * 4 = 40
    expect(calculateMaxShield(robot)).toBe(40);
  });

  it('should use effective shield capacity with weapon_shield loadout', () => {
    const robot = makeRobot({ loadoutType: 'weapon_shield', shieldCapacity: 20 });
    // weapon_shield: shieldCapacity +20% → effective = floor(20 * 1.20) = 24
    // Shield = 24 * 4 = 96
    expect(calculateMaxShield(robot)).toBe(96);
  });
});


// ─── Task 1.3 ───────────────────────────────────────────────────────────────

describe('getAttributeDisplay', () => {
  it('should show base = effective when no bonus and no loadout modifier', () => {
    const result = getAttributeDisplay(10, 0, 0);
    expect(result.base).toBe(10);
    expect(result.weapon).toBe(0);
    expect(result.effective).toBe(10);
    expect(result.hasBonus).toBe(false);
    expect(result.hasLoadoutMod).toBe(false);
    expect(result.display).toBe('10 = 10');
  });

  it('should include weapon bonus in display when present', () => {
    const result = getAttributeDisplay(10, 3, 0);
    expect(result.hasBonus).toBe(true);
    expect(result.hasLoadoutMod).toBe(false);
    expect(result.weapon).toBe(3);
    expect(result.effective).toBe(13);
    expect(result.display).toBe('10 + +3 = 13');
  });

  it('should include loadout modifier in display when present', () => {
    const result = getAttributeDisplay(10, 0, 0.20);
    expect(result.hasBonus).toBe(false);
    expect(result.hasLoadoutMod).toBe(true);
    expect(result.loadout).toBe('20%');
    expect(result.effective).toBe(12);
    expect(result.display).toBe('10 × +20% = 12');
  });

  it('should include both weapon bonus and loadout modifier', () => {
    const result = getAttributeDisplay(10, 5, 0.15);
    expect(result.hasBonus).toBe(true);
    expect(result.hasLoadoutMod).toBe(true);
    expect(result.effective).toBe(17); // floor((10+5)*1.15) = floor(17.25) = 17
    expect(result.display).toBe('10 + +5 × +15% = 17');
  });

  it('should handle negative loadout modifier', () => {
    const result = getAttributeDisplay(10, 0, -0.15);
    expect(result.loadout).toBe('-15%');
    expect(result.effective).toBe(8); // floor(10 * 0.85) = 8
    expect(result.display).toBe('10 × -15% = 8');
  });

  it('should return "0%" loadout string when no loadout modifier', () => {
    const result = getAttributeDisplay(10, 0, 0);
    expect(result.loadout).toBe('0%');
  });
});

describe('getLoadoutModifiedAttributes', () => {
  it('should return correct attributes for weapon_shield', () => {
    const attrs = getLoadoutModifiedAttributes('weapon_shield');
    expect(attrs).toEqual(expect.arrayContaining(['shieldCapacity', 'armorPlating', 'counterProtocols', 'attackSpeed']));
    expect(attrs).toHaveLength(4);
  });

  it('should return correct attributes for two_handed', () => {
    const attrs = getLoadoutModifiedAttributes('two_handed');
    expect(attrs).toEqual(expect.arrayContaining(['combatPower', 'criticalSystems', 'evasionThrusters']));
    expect(attrs).toHaveLength(3);
  });

  it('should return correct attributes for dual_wield', () => {
    const attrs = getLoadoutModifiedAttributes('dual_wield');
    expect(attrs).toEqual(expect.arrayContaining(['attackSpeed', 'weaponControl', 'penetration', 'combatPower']));
    expect(attrs).toHaveLength(4);
  });

  it('should return correct attributes for single', () => {
    const attrs = getLoadoutModifiedAttributes('single');
    expect(attrs).toEqual(expect.arrayContaining(['gyroStabilizers', 'servoMotors']));
    expect(attrs).toHaveLength(2);
  });

  it('should return empty array for unknown loadout type', () => {
    expect(getLoadoutModifiedAttributes('unknown')).toEqual([]);
  });
});

describe('formatLoadoutName', () => {
  it('should format single as "Single Weapon"', () => {
    expect(formatLoadoutName('single')).toBe('Single Weapon');
  });

  it('should format weapon_shield as "Weapon + Shield"', () => {
    expect(formatLoadoutName('weapon_shield')).toBe('Weapon + Shield');
  });

  it('should format two_handed as "Two-Handed"', () => {
    expect(formatLoadoutName('two_handed')).toBe('Two-Handed');
  });

  it('should format dual_wield as "Dual Wield"', () => {
    expect(formatLoadoutName('dual_wield')).toBe('Dual Wield');
  });

  it('should return the raw type string for unknown loadout', () => {
    expect(formatLoadoutName('unknown_type')).toBe('unknown_type');
  });
});

describe('getLoadoutDescription', () => {
  it('should return description for single', () => {
    expect(getLoadoutDescription('single')).toBe('Balanced approach with mobility bonus');
  });

  it('should return description for weapon_shield', () => {
    expect(getLoadoutDescription('weapon_shield')).toBe('Defensive tank with shield regeneration');
  });

  it('should return description for two_handed', () => {
    expect(getLoadoutDescription('two_handed')).toBe('Glass cannon with massive damage output');
  });

  it('should return description for dual_wield', () => {
    expect(getLoadoutDescription('dual_wield')).toBe('Speed demon with rapid attacks');
  });

  it('should return empty string for unknown loadout', () => {
    expect(getLoadoutDescription('unknown_type')).toBe('');
  });
});

// ─── Task 4.3 — Tuning Bonuses ──────────────────────────────────────────────

describe('TuningAttributeMap type', () => {
  it('should accept a partial record of attribute bonuses', () => {
    const tuning: TuningAttributeMap = { combatPower: 3, armorPlating: 5 };
    expect(tuning.combatPower).toBe(3);
    expect(tuning.armorPlating).toBe(5);
    expect(tuning.attackSpeed).toBeUndefined();
  });
});

describe('calculateEffectiveStat with tuning bonus', () => {
  it('should include tuning bonus in the formula', () => {
    // (10 + 0 + 3) * 1.0 = 13
    expect(calculateEffectiveStat(10, 0, 0, 3)).toBe(13);
  });

  it('should combine weapon bonus, tuning bonus, and loadout multiplier', () => {
    // (10 + 5 + 3) * 1.20 = 21.6 → floor to 21
    expect(calculateEffectiveStat(10, 5, 0.20, 3)).toBe(21);
  });

  it('should default tuning bonus to 0 when omitted (backward compatible)', () => {
    expect(calculateEffectiveStat(10, 5, 0)).toBe(15);
  });
});

describe('calculateEffectiveStats with tuningBonuses', () => {
  it('should apply tuning bonuses to specified attributes', () => {
    const robot = makeRobot({ combatPower: 20, armorPlating: 15 });
    const tuning: TuningAttributeMap = { combatPower: 5, armorPlating: 3 };
    const stats = calculateEffectiveStats(robot, tuning);

    // single loadout: combatPower has no loadout bonus → (20 + 0 + 5) * 1.0 = 25
    expect(stats.combatPower).toBe(25);
    // single loadout: armorPlating has no loadout bonus → (15 + 0 + 3) * 1.0 = 18
    expect(stats.armorPlating).toBe(18);
  });

  it('should leave untuned attributes unchanged', () => {
    const robot = makeRobot({ attackSpeed: 12 });
    const tuning: TuningAttributeMap = { combatPower: 5 };
    const stats = calculateEffectiveStats(robot, tuning);

    // attackSpeed not in tuning map → (12 + 0) * 1.0 = 12
    expect(stats.attackSpeed).toBe(12);
  });

  it('should combine tuning with weapon bonuses and loadout multiplier', () => {
    const robot = makeRobot({
      loadoutType: 'two_handed',
      mainWeapon: makeWeaponInventory({ combatPowerBonus: 5 }),
      combatPower: 20,
    });
    const tuning: TuningAttributeMap = { combatPower: 3 };
    const stats = calculateEffectiveStats(robot, tuning);

    // two_handed: combatPower +10% → (20 + 5 + 3) * 1.10 = 30.8 → floor to 30
    expect(stats.combatPower).toBe(30);
  });

  it('should be backward compatible when tuningBonuses is undefined', () => {
    const robot = makeRobot({ combatPower: 20 });
    const withoutTuning = calculateEffectiveStats(robot);
    const withEmptyTuning = calculateEffectiveStats(robot, {});

    expect(withoutTuning.combatPower).toBe(withEmptyTuning.combatPower);
  });
});

describe('calculateMaxHP with tuningBonuses', () => {
  it('should include tuning bonus in HP calculation', () => {
    const robot = makeRobot({ hullIntegrity: 10 });
    const tuning: TuningAttributeMap = { hullIntegrity: 4 };
    // effective hullIntegrity = (10 + 0 + 4) * 1.0 = 14
    // HP = 50 + 14 * 5 = 120
    expect(calculateMaxHP(robot, tuning)).toBe(120);
  });

  it('should be backward compatible when tuningBonuses is omitted', () => {
    const robot = makeRobot({ hullIntegrity: 10 });
    expect(calculateMaxHP(robot)).toBe(100);
  });
});

describe('calculateMaxShield with tuningBonuses', () => {
  it('should include tuning bonus in shield calculation', () => {
    const robot = makeRobot({ shieldCapacity: 10 });
    const tuning: TuningAttributeMap = { shieldCapacity: 5 };
    // effective shieldCapacity = (10 + 0 + 5) * 1.0 = 15
    // Shield = 15 * 4 = 60
    expect(calculateMaxShield(robot, tuning)).toBe(60);
  });

  it('should be backward compatible when tuningBonuses is omitted', () => {
    const robot = makeRobot({ shieldCapacity: 10 });
    expect(calculateMaxShield(robot)).toBe(40);
  });
});

// ─── Exported Constants ─────────────────────────────────────────────────────

describe('LOADOUT_BONUSES', () => {
  it('should have entries for all four loadout types', () => {
    expect(Object.keys(LOADOUT_BONUSES)).toEqual(
      expect.arrayContaining(['weapon_shield', 'two_handed', 'dual_wield', 'single'])
    );
  });
});

describe('STANCE_MODIFIERS', () => {
  it('should have entries for offensive, defensive, and balanced', () => {
    expect(Object.keys(STANCE_MODIFIERS)).toEqual(
      expect.arrayContaining(['offensive', 'defensive', 'balanced'])
    );
  });

  it('should have empty modifiers for balanced stance', () => {
    expect(Object.keys(STANCE_MODIFIERS.balanced)).toHaveLength(0);
  });
});
