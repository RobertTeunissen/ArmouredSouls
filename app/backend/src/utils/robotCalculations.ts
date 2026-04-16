// Robot stat calculations including weapon bonuses, loadout modifiers, and stance modifiers

import { Robot, WeaponInventory, Weapon, Prisma } from '../../generated/prisma';
import { ROBOT_ATTRIBUTES } from '../services/tuning-pool/tuningPoolConfig';
import type { TuningAttributeMap } from '../services/tuning-pool';

/**
 * Convert Prisma Decimal to JavaScript number for calculations
 */
function toNumber(value: number | Prisma.Decimal): number {
  if (typeof value === 'number') return value;
  return value.toNumber();
}

/**
 * Round to 2 decimal places
 */
function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

// Stance modifiers (percentage bonuses/penalties)
export const STANCE_MODIFIERS = {
  offensive: {
    combatPower: 0.15,         // +15%
    attackSpeed: 0.10,         // +10%
    counterProtocols: -0.10,   // -10%
    evasionThrusters: -0.10,   // -10%
  },
  defensive: {
    armorPlating: 0.15,        // +15%
    counterProtocols: 0.15,    // +15%
    shieldRegen: 0.20,         // +20% (applied to powerCore for shield regeneration)
    combatPower: -0.10,        // -10%
    attackSpeed: -0.10,        // -10%
  },
  balanced: {
    // No modifiers - base stats only
  },
};

// Loadout bonus multipliers (percentage bonuses/penalties)
export const LOADOUT_BONUSES = {
  weapon_shield: {
    shieldCapacity: 0.20,      // +20%
    armorPlating: 0.15,        // +15%
    counterProtocols: 0.10,    // +10%
    attackSpeed: -0.15,        // -15%
  },
  two_handed: {
    combatPower: 0.10,         // +10% (v1.2: reduced from 0.25 for balance)
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
 * weapon bonuses, optional tuning bonuses, and loadout modifiers.
 *
 * Formula: (base + weaponBonus + tuningBonus) × loadoutMultiplier
 *
 * @param robot - Robot with optional weapon includes
 * @param tuningBonuses - Optional sparse map of attribute → tuning bonus value.
 *                        When not provided, behaviour is unchanged (backward compatible).
 */
export function calculateEffectiveStats(robot: RobotWithWeapons, tuningBonuses?: TuningAttributeMap): Record<string, number> {
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
    // Convert Prisma Decimal to JavaScript number
    const baseValue = toNumber(robot[attr as keyof Robot] as number | Prisma.Decimal);
    const weaponBonus = getWeaponBonus(robot, attr);
    const tuningBonus = tuningBonuses?.[attr as keyof TuningAttributeMap] ?? 0;
    const loadoutMultiplier = (loadoutBonuses[attr as keyof typeof loadoutBonuses] || 0) + 1;

    // Formula: (base + weaponBonus + tuningBonus) × loadoutMultiplier
    // Round to 2 decimal places for precision
    effectiveStats[attr] = roundToTwo((baseValue + weaponBonus + tuningBonus) * loadoutMultiplier);
  });

  return effectiveStats;
}

/**
 * Prepare a robot for combat by computing all 23 effective attribute values
 * and writing them directly onto the robot object. This replaces scattered
 * `getEffectiveAttribute()` calls and raw `Number()` reads in the combat simulator.
 *
 * For each attribute:
 * 1. Read the base value: `Number(robot[attr])` (handles Prisma Decimal)
 * 2. Add weapon bonuses from BOTH main and offhand weapons
 * 3. Add tuning bonus (if provided)
 * 4. Write the effective value back onto the robot
 *
 * Then recalculates maxHP, maxShield, currentHP, and currentShield using
 * the now-effective attribute values.
 *
 * After this function runs, the robot's attribute fields contain effective values
 * (base + all weapon bonuses + tuning). The combat simulator can then read them
 * directly with `Number(robot.combatPower)` and get the correct effective value.
 *
 * @param robot - Robot with optional weapon includes (mutated in place)
 * @param tuningBonuses - Optional sparse map of attribute → tuning bonus value
 */
export function prepareRobotForCombat(
  robot: RobotWithWeapons,
  tuningBonuses?: TuningAttributeMap
): void {
  // Store tuning bonuses on the robot for downstream access
  (robot as RobotWithWeapons & { tuningBonuses?: TuningAttributeMap }).tuningBonuses = tuningBonuses ?? {};

  // Compute and write effective values for all 23 attributes
  for (const attr of ROBOT_ATTRIBUTES) {
    const baseValue = Number(robot[attr as keyof Robot]);
    const weaponBonus = getWeaponBonus(robot, attr);
    const tuningBonus = tuningBonuses?.[attr] ?? 0;
    const effectiveValue = baseValue + weaponBonus + tuningBonus;

    // Write effective value back — combat simulator reads with Number()
    (robot as Record<string, unknown>)[attr] = effectiveValue;
  }

  // Recalculate maxHP and maxShield using the now-effective attribute values
  // hullIntegrity and shieldCapacity are already effective (plain numbers) at this point
  robot.maxHP = BASE_HP + Number(robot.hullIntegrity) * HP_MULTIPLIER;
  robot.maxShield = Number(robot.shieldCapacity) * 4;

  // Set current HP and shield to max (robots enter combat at full health)
  robot.currentHP = robot.maxHP;
  robot.currentShield = robot.maxShield;
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
 * Formula: BASE_HP + (hullIntegrity × HP_MULTIPLIER)
 * This gives starting robots (hull=1) a reasonable base HP while maintaining scaling
 * Updated for better weapon damage scaling: 50 + (hull × 5)
 */
export const BASE_HP = 50; // Base HP for all robots
export const HP_MULTIPLIER = 5; // Multiplier per hull integrity point

/**
 * Calculate maximum HP based on hull integrity, weapon bonuses, tuning bonuses, and loadout
 * Formula: BASE_HP + (hullIntegrity × HP_MULTIPLIER)
 * This gives starting robots (hull=1) a reasonable base HP while maintaining scaling
 * Updated for better weapon damage scaling: 50 + (hull × 5)
 *
 * @param robot - Robot with optional weapon includes
 * @param tuningBonuses - Optional tuning bonuses passed through to effective stats calculation
 */
export function calculateMaxHP(robot: RobotWithWeapons, tuningBonuses?: TuningAttributeMap): number {
  const effectiveStats = calculateEffectiveStats(robot, tuningBonuses);
  return BASE_HP + (effectiveStats.hullIntegrity * HP_MULTIPLIER);
}

/**
 * Calculate maximum Shield based on shield capacity, weapon bonuses, tuning bonuses, and loadout
 *
 * @param robot - Robot with optional weapon includes
 * @param tuningBonuses - Optional tuning bonuses passed through to effective stats calculation
 */
export function calculateMaxShield(robot: RobotWithWeapons, tuningBonuses?: TuningAttributeMap): number {
  const effectiveStats = calculateEffectiveStats(robot, tuningBonuses);
  return effectiveStats.shieldCapacity * 4;
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

/**
 * Calculate effective stats including stance modifiers
 * Stance modifiers are applied after loadout modifiers
 *
 * @param robot - Robot with optional weapon includes
 * @param tuningBonuses - Optional tuning bonuses passed through to effective stats calculation
 */
export function calculateEffectiveStatsWithStance(robot: RobotWithWeapons, tuningBonuses?: TuningAttributeMap): Record<string, number> {
  // First get base effective stats with weapons, tuning, and loadout
  const baseEffectiveStats = calculateEffectiveStats(robot, tuningBonuses);
  
  // Apply stance modifiers
  const stance = robot.stance as keyof typeof STANCE_MODIFIERS;
  const stanceModifiers = STANCE_MODIFIERS[stance] || STANCE_MODIFIERS.balanced;
  
  const effectiveStatsWithStance: Record<string, number> = { ...baseEffectiveStats };
  
  // Apply stance modifiers to relevant attributes
  Object.entries(stanceModifiers).forEach(([attr, modifier]) => {
    if (attr === 'shieldRegen') {
      // shieldRegen is a special case - it modifies powerCore for regeneration calculations
      // For now, we store it separately but don't modify the powerCore attribute directly
      return;
    }
    
    if (effectiveStatsWithStance[attr] !== undefined && typeof modifier === 'number') {
      const multiplier = 1 + modifier;
      // Round to 2 decimal places for precision
      effectiveStatsWithStance[attr] = roundToTwo(effectiveStatsWithStance[attr] * multiplier);
    }
  });
  
  return effectiveStatsWithStance;
}

/**
 * Get the stance modifier for a specific attribute
 */
export function getStanceModifier(stance: string, attribute: string): number {
  const modifiers = STANCE_MODIFIERS[stance as keyof typeof STANCE_MODIFIERS];
  if (!modifiers) return 0;
  return modifiers[attribute as keyof typeof modifiers] || 0;
}

/**
 * Validate stance value
 */
export function isValidStance(stance: string): boolean {
  return ['offensive', 'defensive', 'balanced'].includes(stance.toLowerCase());
}

/**
 * Validate yield threshold value (must be integer 0-50)
 */
export function isValidYieldThreshold(threshold: number): boolean {
  return typeof threshold === 'number' && !isNaN(threshold) && isFinite(threshold) && threshold >= 0 && threshold <= 50;
}

/**
 * Calculate repair cost based on damage, HP, Repair Bay level, Medical Bay level, and active robot count
 * Formula: baseRepairCost × (damagePercent / 100) × multiplier × (1 - repairBayDiscount)
 * Medical Bay reduces critical damage multiplier (HP = 0)
 * Multi-robot discount: repairBayLevel × (5 + activeRobotCount), capped at 90%
 */
export function calculateRepairCost(
  sumOfAllAttributes: number,
  damagePercent: number,
  hpPercent: number,
  repairBayLevel: number = 0,
  medicalBayLevel: number = 0,
  activeRobotCount: number = 0
): number {
  const baseRepairCost = sumOfAllAttributes * 100;
  
  // Determine multiplier based on HP percentage
  let multiplier = 1.0;
  if (hpPercent === 0) {
    // Total destruction - apply Medical Bay reduction to 2.0x multiplier
    if (medicalBayLevel > 0) {
      const medicalReduction = medicalBayLevel * 0.1;
      multiplier = 2.0 * (1 - medicalReduction);
    } else {
      multiplier = 2.0;
    }
  } else if (hpPercent < 10) {
    // Heavily damaged
    multiplier = 1.5;
  }
  
  // Calculate raw cost
  const rawCost = baseRepairCost * (damagePercent / 100) * multiplier;
  
  // Apply Repair Bay discount with multi-robot bonus
  // Formula: repairBayLevel × (5 + activeRobotCount), capped at 90%
  const rawDiscount = repairBayLevel * (5 + activeRobotCount);
  const repairBayDiscount = Math.min(rawDiscount, 90) / 100;
  const finalCost = rawCost * (1 - repairBayDiscount);
  
  return Math.round(finalCost);
}

/**
 * Calculate sum of all 23 robot attributes
 */
export function calculateAttributeSum(robot: Robot): number {
  return roundToTwo(
    toNumber(robot.combatPower) +
    toNumber(robot.targetingSystems) +
    toNumber(robot.criticalSystems) +
    toNumber(robot.penetration) +
    toNumber(robot.weaponControl) +
    toNumber(robot.attackSpeed) +
    toNumber(robot.armorPlating) +
    toNumber(robot.shieldCapacity) +
    toNumber(robot.evasionThrusters) +
    toNumber(robot.damageDampeners) +
    toNumber(robot.counterProtocols) +
    toNumber(robot.hullIntegrity) +
    toNumber(robot.servoMotors) +
    toNumber(robot.gyroStabilizers) +
    toNumber(robot.hydraulicSystems) +
    toNumber(robot.powerCore) +
    toNumber(robot.combatAlgorithms) +
    toNumber(robot.threatAnalysis) +
    toNumber(robot.adaptiveAI) +
    toNumber(robot.logicCores) +
    toNumber(robot.syncProtocols) +
    toNumber(robot.supportSystems) +
    toNumber(robot.formationTactics)
  );
}
