import * as fc from 'fast-check';
import { WEAPON_DEFINITIONS } from '../prisma/seed';

// ============================================================================
// Helper Types
// ============================================================================

type WeaponDef = (typeof WEAPON_DEFINITIONS)[number];

// ============================================================================
// Constants
// ============================================================================

/** The 9 dead attribute bonus fields — no combat formula references */
const DEAD_BONUS_FIELDS = [
  'hydraulicSystemsBonus',
  'servoMotorsBonus',
  'combatAlgorithmsBonus',
  'threatAnalysisBonus',
  'adaptiveAIBonus',
  'logicCoresBonus',
  'syncProtocolsBonus',
  'supportSystemsBonus',
  'formationTacticsBonus',
] as const;

/** All 23 bonus fields (live + dead) used for Σ(bonus²) calculation */
const ALL_BONUS_FIELDS = [
  'combatPowerBonus',
  'targetingSystemsBonus',
  'criticalSystemsBonus',
  'penetrationBonus',
  'weaponControlBonus',
  'attackSpeedBonus',
  'armorPlatingBonus',
  'shieldCapacityBonus',
  'evasionThrustersBonus',
  'damageDampenersBonus',
  'counterProtocolsBonus',
  'hullIntegrityBonus',
  'servoMotorsBonus',
  'gyroStabilizersBonus',
  'hydraulicSystemsBonus',
  'powerCoreBonus',
  'combatAlgorithmsBonus',
  'threatAnalysisBonus',
  'adaptiveAIBonus',
  'logicCoresBonus',
  'syncProtocolsBonus',
  'supportSystemsBonus',
  'formationTacticsBonus',
] as const;

/** The 7 weapons modified in this rebalance */
const MODIFIED_WEAPON_NAMES = [
  'Energy Blade',
  'Plasma Blade',
  'Power Sword',
  'Battle Axe',
  'Heavy Hammer',
  'Reactive Shield',
  'Ion Beam',
] as const;

/** Non-bonus fields that must remain unchanged for every weapon */
const NON_BONUS_FIELDS = [
  'name',
  'baseDamage',
  'cooldown',
  'weaponType',
  'handsRequired',
  'damageType',
  'loadoutType',
  'cost',
  'specialProperty',
  'description',
] as const;

// ============================================================================
// Pre-rebalance snapshot: Σ(bonus²) and cost for ALL 23 weapons
// These values are identical before and after since magnitudes are preserved.
// ============================================================================

const EXPECTED_SUM_OF_SQUARES: Record<string, number> = {
  'Practice Sword': 0,
  'Machine Pistol': 13,
  'Laser Pistol': 13,
  'Combat Knife': 10,
  'Light Shield': 13,
  'Combat Shield': 74,
  'Reactive Shield': 105,
  'Machine Gun': 38,
  'Burst Rifle': 34,
  'Assault Rifle': 45,
  'Energy Blade': 50,
  'Laser Rifle': 54,
  'Plasma Blade': 54,
  'Plasma Rifle': 65,
  'Power Sword': 99,
  'Shotgun': 29,
  'Grenade Launcher': 86,
  'Sniper Rifle': 134,
  'Battle Axe': 65,
  'Plasma Cannon': 110,
  'Heavy Hammer': 138,
  'Railgun': 234,
  'Ion Beam': 205,
};

const EXPECTED_COST: Record<string, number> = {
  'Practice Sword': 62500,
  'Machine Pistol': 94000,
  'Laser Pistol': 94000,
  'Combat Knife': 113000,
  'Light Shield': 62500,
  'Combat Shield': 100000,
  'Reactive Shield': 113000,
  'Machine Gun': 150000,
  'Burst Rifle': 181000,
  'Assault Rifle': 188000,
  'Energy Blade': 238000,
  'Laser Rifle': 244000,
  'Plasma Blade': 269000,
  'Plasma Rifle': 275000,
  'Power Sword': 350000,
  'Shotgun': 269000,
  'Grenade Launcher': 294000,
  'Sniper Rifle': 369000,
  'Battle Axe': 388000,
  'Plasma Cannon': 400000,
  'Heavy Hammer': 450000,
  'Railgun': 488000,
  'Ion Beam': 538000,
};


// ============================================================================
// Pre-rebalance non-bonus field snapshots for ALL 23 weapons
// ============================================================================

const NON_BONUS_SNAPSHOT: Record<string, Record<string, unknown>> = {
  'Practice Sword': {
    name: 'Practice Sword', baseDamage: 8, cooldown: 3, weaponType: 'melee',
    handsRequired: 'one', damageType: 'melee', loadoutType: 'single',
    cost: 62500, specialProperty: null, description: 'Basic training weapon establishing baseline cost',
  },
  'Machine Pistol': {
    name: 'Machine Pistol', baseDamage: 6, cooldown: 2, weaponType: 'ballistic',
    handsRequired: 'one', damageType: 'ballistic', loadoutType: 'single',
    cost: 94000, specialProperty: null, description: 'Rapid-fire sidearm with quick attacks',
  },
  'Laser Pistol': {
    name: 'Laser Pistol', baseDamage: 8, cooldown: 3, weaponType: 'energy',
    handsRequired: 'one', damageType: 'energy', loadoutType: 'single',
    cost: 94000, specialProperty: null, description: 'Precise energy sidearm with good accuracy',
  },
  'Combat Knife': {
    name: 'Combat Knife', baseDamage: 6, cooldown: 2, weaponType: 'melee',
    handsRequired: 'one', damageType: 'melee', loadoutType: 'single',
    cost: 113000, specialProperty: null, description: 'Fast melee weapon for close combat',
  },
  'Light Shield': {
    name: 'Light Shield', baseDamage: 0, cooldown: 0, weaponType: 'shield',
    handsRequired: 'shield', damageType: 'none', loadoutType: 'weapon_shield',
    cost: 62500, specialProperty: null, description: 'Basic defensive shield for protection',
  },
  'Combat Shield': {
    name: 'Combat Shield', baseDamage: 0, cooldown: 0, weaponType: 'shield',
    handsRequired: 'shield', damageType: 'none', loadoutType: 'weapon_shield',
    cost: 100000, specialProperty: null, description: 'Heavy-duty shield with counter capabilities',
  },
  'Reactive Shield': {
    name: 'Reactive Shield', baseDamage: 0, cooldown: 0, weaponType: 'shield',
    handsRequired: 'shield', damageType: 'none', loadoutType: 'weapon_shield',
    cost: 113000, specialProperty: null, description: 'Advanced shield with energy-reactive plating',
  },
  'Machine Gun': {
    name: 'Machine Gun', baseDamage: 7, cooldown: 2, weaponType: 'ballistic',
    handsRequired: 'one', damageType: 'ballistic', loadoutType: 'single',
    cost: 150000, specialProperty: null, description: 'Sustained fire support weapon',
  },
  'Burst Rifle': {
    name: 'Burst Rifle', baseDamage: 11, cooldown: 3, weaponType: 'ballistic',
    handsRequired: 'one', damageType: 'ballistic', loadoutType: 'single',
    cost: 181000, specialProperty: null, description: '3-round burst fire weapon with controlled recoil',
  },
  'Assault Rifle': {
    name: 'Assault Rifle', baseDamage: 13, cooldown: 3, weaponType: 'ballistic',
    handsRequired: 'one', damageType: 'ballistic', loadoutType: 'single',
    cost: 188000, specialProperty: null, description: 'Versatile military-grade firearm',
  },
  'Energy Blade': {
    name: 'Energy Blade', baseDamage: 13, cooldown: 3, weaponType: 'melee',
    handsRequired: 'one', damageType: 'melee', loadoutType: 'single',
    cost: 238000, specialProperty: null, description: 'Energy-infused blade for swift strikes',
  },
  'Laser Rifle': {
    name: 'Laser Rifle', baseDamage: 15, cooldown: 3, weaponType: 'energy',
    handsRequired: 'one', damageType: 'energy', loadoutType: 'single',
    cost: 244000, specialProperty: null, description: 'Precision energy rifle with excellent accuracy',
  },
  'Plasma Blade': {
    name: 'Plasma Blade', baseDamage: 14, cooldown: 3, weaponType: 'melee',
    handsRequired: 'one', damageType: 'melee', loadoutType: 'single',
    cost: 269000, specialProperty: null, description: 'Energy-enhanced melee blade with rapid strikes',
  },
  'Plasma Rifle': {
    name: 'Plasma Rifle', baseDamage: 17, cooldown: 3, weaponType: 'energy',
    handsRequired: 'one', damageType: 'energy', loadoutType: 'single',
    cost: 275000, specialProperty: null, description: 'Advanced energy weapon with high damage output',
  },
  'Power Sword': {
    name: 'Power Sword', baseDamage: 20, cooldown: 3, weaponType: 'melee',
    handsRequired: 'one', damageType: 'melee', loadoutType: 'single',
    cost: 350000, specialProperty: null, description: 'High-tech melee weapon with superior handling',
  },
  'Shotgun': {
    name: 'Shotgun', baseDamage: 18, cooldown: 4, weaponType: 'ballistic',
    handsRequired: 'two', damageType: 'ballistic', loadoutType: 'two_handed',
    cost: 269000, specialProperty: null, description: 'Close-range devastation with wide spread',
  },
  'Grenade Launcher': {
    name: 'Grenade Launcher', baseDamage: 21, cooldown: 5, weaponType: 'ballistic',
    handsRequired: 'two', damageType: 'ballistic', loadoutType: 'two_handed',
    cost: 294000, specialProperty: null, description: 'Explosive area damage with arc trajectory',
  },
  'Sniper Rifle': {
    name: 'Sniper Rifle', baseDamage: 29, cooldown: 6, weaponType: 'ballistic',
    handsRequired: 'two', damageType: 'ballistic', loadoutType: 'two_handed',
    cost: 369000, specialProperty: null, description: 'Long-range precision weapon with high damage',
  },
  'Battle Axe': {
    name: 'Battle Axe', baseDamage: 23, cooldown: 4, weaponType: 'melee',
    handsRequired: 'two', damageType: 'melee', loadoutType: 'two_handed',
    cost: 388000, specialProperty: null, description: 'Brutal melee weapon with devastating power',
  },
  'Plasma Cannon': {
    name: 'Plasma Cannon', baseDamage: 27, cooldown: 5, weaponType: 'energy',
    handsRequired: 'two', damageType: 'energy', loadoutType: 'two_handed',
    cost: 400000, specialProperty: null, description: 'Heavy plasma weapon with devastating firepower',
  },
  'Heavy Hammer': {
    name: 'Heavy Hammer', baseDamage: 29, cooldown: 5, weaponType: 'melee',
    handsRequired: 'two', damageType: 'melee', loadoutType: 'two_handed',
    cost: 450000, specialProperty: null, description: 'Massive impact weapon for maximum damage',
  },
  'Railgun': {
    name: 'Railgun', baseDamage: 33, cooldown: 6, weaponType: 'ballistic',
    handsRequired: 'two', damageType: 'ballistic', loadoutType: 'two_handed',
    cost: 488000, specialProperty: null, description: 'Ultra-high velocity kinetic weapon with extreme penetration',
  },
  'Ion Beam': {
    name: 'Ion Beam', baseDamage: 24, cooldown: 4, weaponType: 'energy',
    handsRequired: 'two', damageType: 'energy', loadoutType: 'two_handed',
    cost: 538000, specialProperty: null, description: 'Focused energy beam with shield disruption',
  },
};


// ============================================================================
// Full field snapshots for the 16 UNMODIFIED weapons (including all bonus fields)
// ============================================================================

const UNMODIFIED_WEAPON_SNAPSHOTS: Record<string, Record<string, unknown>> = {
  'Practice Sword': {
    name: 'Practice Sword', weaponType: 'melee', baseDamage: 8, cooldown: 3,
    cost: 62500, handsRequired: 'one', damageType: 'melee', loadoutType: 'single',
    specialProperty: null, description: 'Basic training weapon establishing baseline cost',
  },
  'Machine Pistol': {
    name: 'Machine Pistol', weaponType: 'ballistic', baseDamage: 6, cooldown: 2,
    cost: 94000, handsRequired: 'one', damageType: 'ballistic', loadoutType: 'single',
    specialProperty: null, description: 'Rapid-fire sidearm with quick attacks',
    attackSpeedBonus: 3, weaponControlBonus: 2,
  },
  'Laser Pistol': {
    name: 'Laser Pistol', weaponType: 'energy', baseDamage: 8, cooldown: 3,
    cost: 94000, handsRequired: 'one', damageType: 'energy', loadoutType: 'single',
    specialProperty: null, description: 'Precise energy sidearm with good accuracy',
    targetingSystemsBonus: 3, combatPowerBonus: 2,
  },
  'Combat Knife': {
    name: 'Combat Knife', weaponType: 'melee', baseDamage: 6, cooldown: 2,
    cost: 113000, handsRequired: 'one', damageType: 'melee', loadoutType: 'single',
    specialProperty: null, description: 'Fast melee weapon for close combat',
    attackSpeedBonus: 3, gyroStabilizersBonus: 1,
  },
  'Light Shield': {
    name: 'Light Shield', weaponType: 'shield', baseDamage: 0, cooldown: 0,
    cost: 62500, handsRequired: 'shield', damageType: 'none', loadoutType: 'weapon_shield',
    specialProperty: null, description: 'Basic defensive shield for protection',
    armorPlatingBonus: 3, shieldCapacityBonus: 2,
  },
  'Combat Shield': {
    name: 'Combat Shield', weaponType: 'shield', baseDamage: 0, cooldown: 0,
    cost: 100000, handsRequired: 'shield', damageType: 'none', loadoutType: 'weapon_shield',
    specialProperty: null, description: 'Heavy-duty shield with counter capabilities',
    armorPlatingBonus: 6, counterProtocolsBonus: 3, evasionThrustersBonus: -2, shieldCapacityBonus: 5,
  },
  'Machine Gun': {
    name: 'Machine Gun', weaponType: 'ballistic', baseDamage: 7, cooldown: 2,
    cost: 150000, handsRequired: 'one', damageType: 'ballistic', loadoutType: 'single',
    specialProperty: null, description: 'Sustained fire support weapon',
    combatPowerBonus: 3, attackSpeedBonus: 5, weaponControlBonus: 2,
  },
  'Burst Rifle': {
    name: 'Burst Rifle', weaponType: 'ballistic', baseDamage: 11, cooldown: 3,
    cost: 181000, handsRequired: 'one', damageType: 'ballistic', loadoutType: 'single',
    specialProperty: null, description: '3-round burst fire weapon with controlled recoil',
    attackSpeedBonus: 4, targetingSystemsBonus: 3, criticalSystemsBonus: 3,
  },
  'Assault Rifle': {
    name: 'Assault Rifle', weaponType: 'ballistic', baseDamage: 13, cooldown: 3,
    cost: 188000, handsRequired: 'one', damageType: 'ballistic', loadoutType: 'single',
    specialProperty: null, description: 'Versatile military-grade firearm',
    combatPowerBonus: 4, targetingSystemsBonus: 4, weaponControlBonus: 3, attackSpeedBonus: 2,
  },
  'Laser Rifle': {
    name: 'Laser Rifle', weaponType: 'energy', baseDamage: 15, cooldown: 3,
    cost: 244000, handsRequired: 'one', damageType: 'energy', loadoutType: 'single',
    specialProperty: null, description: 'Precision energy rifle with excellent accuracy',
    targetingSystemsBonus: 5, weaponControlBonus: 4, attackSpeedBonus: 3, combatPowerBonus: 2,
  },
  'Plasma Rifle': {
    name: 'Plasma Rifle', weaponType: 'energy', baseDamage: 17, cooldown: 3,
    cost: 275000, handsRequired: 'one', damageType: 'energy', loadoutType: 'single',
    specialProperty: null, description: 'Advanced energy weapon with high damage output',
    combatPowerBonus: 6, targetingSystemsBonus: 4, weaponControlBonus: 3, powerCoreBonus: -2,
  },
  'Shotgun': {
    name: 'Shotgun', weaponType: 'ballistic', baseDamage: 18, cooldown: 4,
    cost: 269000, handsRequired: 'two', damageType: 'ballistic', loadoutType: 'two_handed',
    specialProperty: null, description: 'Close-range devastation with wide spread',
    combatPowerBonus: 4, criticalSystemsBonus: 3, targetingSystemsBonus: -2,
  },
  'Grenade Launcher': {
    name: 'Grenade Launcher', weaponType: 'ballistic', baseDamage: 21, cooldown: 5,
    cost: 294000, handsRequired: 'two', damageType: 'ballistic', loadoutType: 'two_handed',
    specialProperty: null, description: 'Explosive area damage with arc trajectory',
    combatPowerBonus: 6, penetrationBonus: 5, criticalSystemsBonus: 4, targetingSystemsBonus: -3,
  },
  'Sniper Rifle': {
    name: 'Sniper Rifle', weaponType: 'ballistic', baseDamage: 29, cooldown: 6,
    cost: 369000, handsRequired: 'two', damageType: 'ballistic', loadoutType: 'two_handed',
    specialProperty: null, description: 'Long-range precision weapon with high damage',
    targetingSystemsBonus: 8, penetrationBonus: 6, criticalSystemsBonus: 5, attackSpeedBonus: -3,
  },
  'Plasma Cannon': {
    name: 'Plasma Cannon', weaponType: 'energy', baseDamage: 27, cooldown: 5,
    cost: 400000, handsRequired: 'two', damageType: 'energy', loadoutType: 'two_handed',
    specialProperty: null, description: 'Heavy plasma weapon with devastating firepower',
    combatPowerBonus: 7, criticalSystemsBonus: 6, penetrationBonus: 4, powerCoreBonus: -3,
  },
  'Railgun': {
    name: 'Railgun', weaponType: 'ballistic', baseDamage: 33, cooldown: 6,
    cost: 488000, handsRequired: 'two', damageType: 'ballistic', loadoutType: 'two_handed',
    specialProperty: null, description: 'Ultra-high velocity kinetic weapon with extreme penetration',
    penetrationBonus: 12, targetingSystemsBonus: 7, combatPowerBonus: 5, attackSpeedBonus: -4,
  },
};


// ============================================================================
// Helpers
// ============================================================================

/** Get a bonus field value from a weapon, treating missing fields as 0 */
function getBonus(weapon: WeaponDef, field: string): number {
  return ((weapon as Record<string, unknown>)[field] as number) ?? 0;
}

/** Compute Σ(bonus²) across all 23 bonus fields for a weapon */
function sumOfSquares(weapon: WeaponDef): number {
  return ALL_BONUS_FIELDS.reduce((sum, field) => {
    const val = getBonus(weapon, field);
    return sum + val * val;
  }, 0);
}

/** Find a weapon by name in WEAPON_DEFINITIONS */
function findWeapon(name: string): WeaponDef {
  const w = WEAPON_DEFINITIONS.find((w) => w.name === name);
  if (!w) throw new Error(`Weapon not found: ${name}`);
  return w;
}

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Feature: weapon-bonus-rebalance', () => {
  // --------------------------------------------------------------------------
  // Property 1: No Dead Attribute Bonuses
  // --------------------------------------------------------------------------
  describe('Property 1: No Dead Attribute Bonuses', () => {
    /**
     * **Validates: Requirements 9.1, 9.2**
     * For any weapon in WEAPON_DEFINITIONS, all 9 dead attribute bonus fields
     * must be zero or undefined.
     */
    test('all weapons have zero or undefined dead attribute bonuses', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...WEAPON_DEFINITIONS),
          (weapon) => {
            for (const field of DEAD_BONUS_FIELDS) {
              const val = getBonus(weapon, field);
              expect(val).toBe(0);
            }
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });
  });

  // --------------------------------------------------------------------------
  // Property 2: Bonus Magnitudes Preserved and Prices Unchanged
  // --------------------------------------------------------------------------
  describe('Property 2: Bonus Magnitudes Preserved and Prices Unchanged', () => {
    /**
     * **Validates: Requirements 8.1, 8.2, 8.3**
     * For any weapon, Σ(bonus²) equals the known pre-rebalance value
     * and cost matches the expected value.
     */
    test('sum of squares and cost match expected values for every weapon', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...WEAPON_DEFINITIONS),
          (weapon) => {
            const expectedSoS = EXPECTED_SUM_OF_SQUARES[weapon.name];
            expect(expectedSoS).toBeDefined();
            expect(sumOfSquares(weapon)).toBe(expectedSoS);

            const expectedCost = EXPECTED_COST[weapon.name];
            expect(expectedCost).toBeDefined();
            expect(weapon.cost).toBe(expectedCost);
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });
  });

  // --------------------------------------------------------------------------
  // Property 3: Non-Bonus Fields Unchanged
  // --------------------------------------------------------------------------
  describe('Property 3: Non-Bonus Fields Unchanged', () => {
    /**
     * **Validates: Requirements 10.2, 13.2**
     * For any weapon, non-bonus fields match pre-rebalance snapshot values.
     */
    test('non-bonus fields match snapshot for every weapon', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...WEAPON_DEFINITIONS),
          (weapon) => {
            const snapshot = NON_BONUS_SNAPSHOT[weapon.name];
            expect(snapshot).toBeDefined();
            for (const field of NON_BONUS_FIELDS) {
              expect((weapon as Record<string, unknown>)[field]).toEqual(
                snapshot[field]
              );
            }
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });
  });

  // --------------------------------------------------------------------------
  // Property 4: Unmodified Weapons Fully Unchanged
  // --------------------------------------------------------------------------
  describe('Property 4: Unmodified Weapons Fully Unchanged', () => {
    const unmodifiedWeapons = WEAPON_DEFINITIONS.filter(
      (w) => !(MODIFIED_WEAPON_NAMES as readonly string[]).includes(w.name)
    );

    /**
     * **Validates: Requirements 13.3**
     * For each of the 16 unmodified weapons, ALL fields (including bonuses)
     * match the pre-rebalance snapshot exactly.
     */
    test('all fields match snapshot for unmodified weapons', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...unmodifiedWeapons),
          (weapon) => {
            const snapshot = UNMODIFIED_WEAPON_SNAPSHOTS[weapon.name];
            expect(snapshot).toBeDefined();

            // Check every key in the snapshot exists on the weapon with the same value
            for (const [key, expectedVal] of Object.entries(snapshot)) {
              expect((weapon as Record<string, unknown>)[key]).toEqual(expectedVal);
            }

            // Check every key on the weapon exists in the snapshot
            // (bonus fields not in snapshot should be undefined)
            for (const field of ALL_BONUS_FIELDS) {
              const weaponVal = getBonus(weapon, field);
              const snapshotVal = (snapshot[field] as number) ?? 0;
              expect(weaponVal).toBe(snapshotVal);
            }
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });
  });

  // --------------------------------------------------------------------------
  // Unit Tests: Modified weapon specific bonus values
  // --------------------------------------------------------------------------
  describe('Unit tests: modified weapon bonus values', () => {
    test('WEAPON_DEFINITIONS.length === 23', () => {
      expect(WEAPON_DEFINITIONS.length).toBe(23);
    });

    test('Energy Blade has correct bonuses after rebalance', () => {
      const w = findWeapon('Energy Blade');
      expect(getBonus(w, 'combatPowerBonus')).toBe(4);
      expect(getBonus(w, 'hydraulicSystemsBonus')).toBe(0);
      expect(getBonus(w, 'attackSpeedBonus')).toBe(5);
      expect(getBonus(w, 'weaponControlBonus')).toBe(3);
    });

    test('Plasma Blade has correct bonuses after rebalance', () => {
      const w = findWeapon('Plasma Blade');
      expect(getBonus(w, 'combatPowerBonus')).toBe(5);
      expect(getBonus(w, 'hydraulicSystemsBonus')).toBe(0);
      expect(getBonus(w, 'attackSpeedBonus')).toBe(4);
      expect(getBonus(w, 'criticalSystemsBonus')).toBe(3);
      expect(getBonus(w, 'gyroStabilizersBonus')).toBe(2);
    });

    test('Power Sword has correct bonuses after rebalance', () => {
      const w = findWeapon('Power Sword');
      expect(getBonus(w, 'penetrationBonus')).toBe(7);
      expect(getBonus(w, 'criticalSystemsBonus')).toBe(5);
      expect(getBonus(w, 'weaponControlBonus')).toBe(4);
      expect(getBonus(w, 'combatPowerBonus')).toBe(3);
      expect(getBonus(w, 'hydraulicSystemsBonus')).toBe(0);
      expect(getBonus(w, 'counterProtocolsBonus')).toBe(0);
      expect(getBonus(w, 'gyroStabilizersBonus')).toBe(0);
    });

    test('Battle Axe has correct bonuses after rebalance', () => {
      const w = findWeapon('Battle Axe');
      expect(getBonus(w, 'penetrationBonus')).toBe(6);
      expect(getBonus(w, 'attackSpeedBonus')).toBe(-2);
      expect(getBonus(w, 'combatPowerBonus')).toBe(4);
      expect(getBonus(w, 'criticalSystemsBonus')).toBe(3);
      expect(getBonus(w, 'hydraulicSystemsBonus')).toBe(0);
      expect(getBonus(w, 'servoMotorsBonus')).toBe(0);
    });

    test('Heavy Hammer has correct bonuses after rebalance', () => {
      const w = findWeapon('Heavy Hammer');
      expect(getBonus(w, 'penetrationBonus')).toBe(8);
      expect(getBonus(w, 'attackSpeedBonus')).toBe(-3);
      expect(getBonus(w, 'combatPowerBonus')).toBe(7);
      expect(getBonus(w, 'criticalSystemsBonus')).toBe(4);
      expect(getBonus(w, 'hydraulicSystemsBonus')).toBe(0);
      expect(getBonus(w, 'servoMotorsBonus')).toBe(0);
    });

    test('Reactive Shield has correct bonuses after rebalance', () => {
      const w = findWeapon('Reactive Shield');
      expect(getBonus(w, 'evasionThrustersBonus')).toBe(-2);
      expect(getBonus(w, 'shieldCapacityBonus')).toBe(7);
      expect(getBonus(w, 'counterProtocolsBonus')).toBe(6);
      expect(getBonus(w, 'powerCoreBonus')).toBe(4);
      expect(getBonus(w, 'servoMotorsBonus')).toBe(0);
    });

    test('Ion Beam has correct bonuses after rebalance', () => {
      const w = findWeapon('Ion Beam');
      expect(getBonus(w, 'combatPowerBonus')).toBe(8);
      expect(getBonus(w, 'shieldCapacityBonus')).toBe(0);
      expect(getBonus(w, 'penetrationBonus')).toBe(10);
      expect(getBonus(w, 'attackSpeedBonus')).toBe(5);
      expect(getBonus(w, 'targetingSystemsBonus')).toBe(4);
    });
  });
});
