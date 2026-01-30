// Robot stat calculations including weapon bonuses, loadout modifiers, and stance modifiers

import { Robot, WeaponInventory, Weapon } from '@prisma/client';

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

/**
 * Calculate effective stats including stance modifiers
 * Stance modifiers are applied after loadout modifiers
 */
export function calculateEffectiveStatsWithStance(robot: RobotWithWeapons): Record<string, number> {
  // First get base effective stats with weapons and loadout
  const baseEffectiveStats = calculateEffectiveStats(robot);
  
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
      effectiveStatsWithStance[attr] = Math.floor(effectiveStatsWithStance[attr] * multiplier);
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
 * Calculate repair cost based on damage, HP, and optional Repair Bay level
 * Formula: baseRepairCost × (damagePercent / 100) × multiplier × (1 - repairBayDiscount)
 */
export function calculateRepairCost(
  sumOfAllAttributes: number,
  damagePercent: number,
  hpPercent: number,
  repairBayLevel: number = 0
): number {
  const baseRepairCost = sumOfAllAttributes * 100;
  
  // Determine multiplier based on HP percentage
  let multiplier = 1.0;
  if (hpPercent === 0) {
    // Total destruction
    multiplier = 2.0;
  } else if (hpPercent < 10) {
    // Heavily damaged
    multiplier = 1.5;
  }
  
  // Calculate raw cost
  const rawCost = baseRepairCost * (damagePercent / 100) * multiplier;
  
  // Apply Repair Bay discount (5% per level, max 50% at level 10)
  const repairBayDiscount = Math.min(repairBayLevel * 5, 50) / 100;
  const finalCost = rawCost * (1 - repairBayDiscount);
  
  return Math.round(finalCost);
}

/**
 * Calculate sum of all 23 robot attributes
 */
export function calculateAttributeSum(robot: Robot): number {
  return (
    robot.combatPower +
    robot.targetingSystems +
    robot.criticalSystems +
    robot.penetration +
    robot.weaponControl +
    robot.attackSpeed +
    robot.armorPlating +
    robot.shieldCapacity +
    robot.evasionThrusters +
    robot.damageDampeners +
    robot.counterProtocols +
    robot.hullIntegrity +
    robot.servoMotors +
    robot.gyroStabilizers +
    robot.hydraulicSystems +
    robot.powerCore +
    robot.combatAlgorithms +
    robot.threatAnalysis +
    robot.adaptiveAI +
    robot.logicCores +
    robot.syncProtocols +
    robot.supportSystems +
    robot.formationTactics
  );
}
