// Helper utilities for robot stats and weapon bonuses

interface Weapon {
  combatPowerBonus?: number;
  targetingSystemsBonus?: number;
  criticalSystemsBonus?: number;
  penetrationBonus?: number;
  weaponControlBonus?: number;
  attackSpeedBonus?: number;
  armorPlatingBonus?: number;
  shieldCapacityBonus?: number;
  evasionThrustersBonus?: number;
  damageDampenersBonus?: number;
  counterProtocolsBonus?: number;
  hullIntegrityBonus?: number;
  servoMotorsBonus?: number;
  gyroStabilizersBonus?: number;
  hydraulicSystemsBonus?: number;
  powerCoreBonus?: number;
  combatAlgorithmsBonus?: number;
  threatAnalysisBonus?: number;
  adaptiveAIBonus?: number;
  logicCoresBonus?: number;
  syncProtocolsBonus?: number;
  supportSystemsBonus?: number;
  formationTacticsBonus?: number;
}

interface WeaponInventory {
  weapon: Weapon;
}

interface Robot {
  loadoutType: string;
  mainWeapon?: WeaponInventory | null;
  offhandWeapon?: WeaponInventory | null;
  // All 23 attributes
  combatPower: number;
  targetingSystems: number;
  criticalSystems: number;
  penetration: number;
  weaponControl: number;
  attackSpeed: number;
  armorPlating: number;
  shieldCapacity: number;
  evasionThrusters: number;
  damageDampeners: number;
  counterProtocols: number;
  hullIntegrity: number;
  servoMotors: number;
  gyroStabilizers: number;
  hydraulicSystems: number;
  powerCore: number;
  combatAlgorithms: number;
  threatAnalysis: number;
  adaptiveAI: number;
  logicCores: number;
  syncProtocols: number;
  supportSystems: number;
  formationTactics: number;
}

// Loadout bonus multipliers (matching backend)
export const LOADOUT_BONUSES: { [key: string]: { [key: string]: number } } = {
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

// Stance modifiers (matching backend)
export const STANCE_MODIFIERS: { [key: string]: { [key: string]: number } } = {
  offensive: {
    combatPower: 0.15,         // +15%
    attackSpeed: 0.10,         // +10%
    counterProtocols: -0.10,   // -10%
    evasionThrusters: -0.10,   // -10%
  },
  defensive: {
    armorPlating: 0.15,        // +15%
    counterProtocols: 0.15,    // +15%
    combatPower: -0.10,        // -10%
    attackSpeed: -0.10,        // -10%
  },
  balanced: {
    // No modifiers - base stats only
  },
};

/**
 * Calculate total bonus for an attribute from equipped weapons
 */
export function calculateAttributeBonus(
  attributeKey: string,
  mainWeapon: WeaponInventory | null | undefined,
  offhandWeapon: WeaponInventory | null | undefined
): number {
  let bonus = 0;
  
  const bonusKey = `${attributeKey}Bonus` as keyof Weapon;
  
  if (mainWeapon?.weapon[bonusKey] !== undefined) {
    bonus += mainWeapon.weapon[bonusKey] as number;
  }
  
  if (offhandWeapon?.weapon[bonusKey] !== undefined) {
    bonus += offhandWeapon.weapon[bonusKey] as number;
  }
  
  return bonus;
}

/**
 * Get loadout bonus multiplier for an attribute
 */
export function getLoadoutBonus(loadoutType: string, attribute: string): number {
  const bonuses = LOADOUT_BONUSES[loadoutType];
  if (!bonuses) return 0;
  return bonuses[attribute] || 0;
}

/**
 * Get stance modifier for an attribute
 */
export function getStanceModifier(stance: string, attribute: string): number {
  const modifiers = STANCE_MODIFIERS[stance];
  if (!modifiers) return 0;
  return modifiers[attribute] || 0;
}

/**
 * Calculate effective stat value including weapon bonuses and loadout modifiers
 */
export function calculateEffectiveStat(
  baseValue: number,
  weaponBonus: number,
  loadoutBonus: number
): number {
  const loadoutMultiplier = 1 + loadoutBonus;
  return Math.floor((baseValue + weaponBonus) * loadoutMultiplier);
}

/**
 * Calculate all effective stats for a robot
 */
export function calculateEffectiveStats(robot: Robot): Record<string, number> {
  const attributes = [
    'combatPower', 'targetingSystems', 'criticalSystems', 'penetration', 'weaponControl', 'attackSpeed',
    'armorPlating', 'shieldCapacity', 'evasionThrusters', 'damageDampeners', 'counterProtocols',
    'hullIntegrity', 'servoMotors', 'gyroStabilizers', 'hydraulicSystems', 'powerCore',
    'combatAlgorithms', 'threatAnalysis', 'adaptiveAI', 'logicCores',
    'syncProtocols', 'supportSystems', 'formationTactics',
  ];

  const effectiveStats: Record<string, number> = {};

  attributes.forEach(attr => {
    const baseValue = robot[attr as keyof Robot] as number;
    const weaponBonus = calculateAttributeBonus(attr, robot.mainWeapon, robot.offhandWeapon);
    const loadoutBonus = getLoadoutBonus(robot.loadoutType, attr);
    effectiveStats[attr] = calculateEffectiveStat(baseValue, weaponBonus, loadoutBonus);
  });

  return effectiveStats;
}

/**
 * Calculate max HP based on effective hull integrity
 * Formula: 50 + (hullIntegrity × 5)
 */
export function calculateMaxHP(robot: Robot): number {
  const effectiveStats = calculateEffectiveStats(robot);
  return 50 + (effectiveStats.hullIntegrity * 5);
}

/**
 * Calculate max Shield based on effective shield capacity
 */
export function calculateMaxShield(robot: Robot): number {
  const effectiveStats = calculateEffectiveStats(robot);
  return effectiveStats.shieldCapacity * 2;
}

/**
 * Get display string for attribute with bonuses and loadout modifiers
 */
export function getAttributeDisplay(
  baseValue: number,
  weaponBonus: number,
  loadoutBonus: number
): { 
  base: number; 
  weapon: number; 
  loadout: string; 
  effective: number; 
  display: string;
  hasBonus: boolean;
  hasLoadoutMod: boolean;
} {
  const effective = calculateEffectiveStat(baseValue, weaponBonus, loadoutBonus);
  const hasBonus = weaponBonus !== 0;
  const hasLoadoutMod = loadoutBonus !== 0;
  
  let display = `${baseValue}`;
  if (hasBonus) {
    display += ` + ${weaponBonus > 0 ? '+' : ''}${weaponBonus}`;
  }
  if (hasLoadoutMod) {
    const loadoutPercent = Math.round(loadoutBonus * 100);
    display += ` × ${loadoutPercent > 0 ? '+' : ''}${loadoutPercent}%`;
  }
  display += ` = ${effective}`;
  
  return {
    base: baseValue,
    weapon: weaponBonus,
    loadout: hasLoadoutMod ? `${Math.round(loadoutBonus * 100)}%` : '0%',
    effective,
    display,
    hasBonus,
    hasLoadoutMod,
  };
}

/**
 * Get all attributes modified by a loadout type
 */
export function getLoadoutModifiedAttributes(loadoutType: string): string[] {
  const bonuses = LOADOUT_BONUSES[loadoutType];
  if (!bonuses) return [];
  return Object.keys(bonuses);
}

/**
 * Format loadout name for display
 */
export function formatLoadoutName(loadoutType: string): string {
  const names: { [key: string]: string } = {
    single: 'Single Weapon',
    weapon_shield: 'Weapon + Shield',
    two_handed: 'Two-Handed',
    dual_wield: 'Dual Wield',
  };
  return names[loadoutType] || loadoutType;
}

/**
 * Get loadout description
 */
export function getLoadoutDescription(loadoutType: string): string {
  const descriptions: { [key: string]: string } = {
    single: 'Balanced approach with mobility bonus',
    weapon_shield: 'Defensive tank with shield regeneration',
    two_handed: 'Glass cannon with massive damage output',
    dual_wield: 'Speed demon with rapid attacks',
  };
  return descriptions[loadoutType] || '';
}

