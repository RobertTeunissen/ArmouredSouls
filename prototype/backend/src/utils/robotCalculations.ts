// Robot stat calculations including weapon bonuses and loadout modifiers

import { Robot, WeaponInventory, Weapon } from '@prisma/client';

// Loadout bonus multipliers (percentage bonuses/penalties)
export const LOADOUT_BONUSES = {
  weapon_shield: {
    shieldCapacity: 0.20,      // +20%
    armorPlating: 0.15,        // +15%
    counterProtocols: 0.10,    // +10%
    attackSpeed: -0.15,        // -15%
  },
  two_handed: {
    combatPower: 0.25,         // +25%
    criticalSystems: 0.20,     // +20%
    evasionThrusters: -0.10,   // -10%
  },
  dual_wield: {
    attackSpeed: 0.30,         // +30%
    weaponControl: 0.15,       // +15%
    penetration: -0.20,        // -20%
    combatPower: -0.10,        // -10%
  },
  single: {
    gyroStabilizers: 0.10,     // +10%
    servoMotors: 0.05,         // +5%
  },
};

type RobotWithWeapons = Robot & {
  mainWeapon?: (WeaponInventory & { weapon: Weapon }) | null;
  offhandWeapon?: (WeaponInventory & { weapon: Weapon }) | null;
};

/**
 * Calculate effective stats for a robot including base attributes,
 * weapon bonuses, and loadout modifiers
 */
export function calculateEffectiveStats(robot: RobotWithWeapons): Record<string, number> {
  const loadoutType = robot.loadoutType as keyof typeof LOADOUT_BONUSES;
  const loadoutBonuses = LOADOUT_BONUSES[loadoutType] || {};

  // All 23 attributes
  const attributes = [
    // Combat Systems
    'combatPower',
    'targetingSystems',
    'criticalSystems',
    'penetration',
    'weaponControl',
    'attackSpeed',
    // Defensive Systems
    'armorPlating',
    'shieldCapacity',
    'evasionThrusters',
    'damageDampeners',
    'counterProtocols',
    // Chassis & Mobility
    'hullIntegrity',
    'servoMotors',
    'gyroStabilizers',
    'hydraulicSystems',
    'powerCore',
    // AI Processing
    'combatAlgorithms',
    'threatAnalysis',
    'adaptiveAI',
    'logicCores',
    // Team Coordination
    'syncProtocols',
    'supportSystems',
    'formationTactics',
  ];

  const effectiveStats: Record<string, number> = {};

  attributes.forEach((attr) => {
    const baseValue = robot[attr as keyof Robot] as number;
    const weaponBonus = getWeaponBonus(robot, attr);
    const loadoutMultiplier = (loadoutBonuses[attr as keyof typeof loadoutBonuses] || 0) + 1;

    // Formula: (base + weaponBonus) × loadoutMultiplier
    effectiveStats[attr] = Math.floor((baseValue + weaponBonus) * loadoutMultiplier);
  });

  return effectiveStats;
}

/**
 * Get total weapon bonus for a specific attribute from equipped weapons
 */
function getWeaponBonus(robot: RobotWithWeapons, attribute: string): number {
  let bonus = 0;

  const bonusField = `${attribute}Bonus` as keyof Weapon;

  if (robot.mainWeapon?.weapon) {
    bonus += (robot.mainWeapon.weapon[bonusField] as number) || 0;
  }

  if (robot.offhandWeapon?.weapon) {
    bonus += (robot.offhandWeapon.weapon[bonusField] as number) || 0;
  }

  return bonus;
}

/**
 * Calculate maximum HP based on hull integrity, weapon bonuses, and loadout
 */
export function calculateMaxHP(robot: RobotWithWeapons): number {
  const effectiveStats = calculateEffectiveStats(robot);
  return effectiveStats.hullIntegrity * 10;
}

/**
 * Calculate maximum Shield based on shield capacity, weapon bonuses, and loadout
 */
export function calculateMaxShield(robot: RobotWithWeapons): number {
  const effectiveStats = calculateEffectiveStats(robot);
  return effectiveStats.shieldCapacity * 2;
}

/**
 * Get the loadout bonus multiplier for a specific attribute
 */
export function getLoadoutBonus(loadoutType: string, attribute: string): number {
  const bonuses = LOADOUT_BONUSES[loadoutType as keyof typeof LOADOUT_BONUSES];
  if (!bonuses) return 0;
  return bonuses[attribute as keyof typeof bonuses] || 0;
}

/**
 * Get all attributes that are modified by a specific loadout type
 */
export function getLoadoutModifiedAttributes(loadoutType: string): string[] {
  const bonuses = LOADOUT_BONUSES[loadoutType as keyof typeof LOADOUT_BONUSES];
  if (!bonuses) return [];
  return Object.keys(bonuses);
}
