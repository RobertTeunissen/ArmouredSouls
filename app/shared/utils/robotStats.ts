/**
 * Robot Stat Calculations — Shared Module
 *
 * Single source of truth for loadout bonuses, stance modifiers, and effective
 * stat calculations used by both the backend (combat simulation, HP/shield
 * derivation) and the frontend (stat display, tooltips, loadout selection).
 *
 * Formula: effective = floor((base + weaponBonus + tuningBonus) × (1 + loadoutBonus))
 *
 * Note: The backend's `calculateEffectiveStats` in `robotCalculations.ts` uses
 * `roundToTwo` instead of `Math.floor` because the combat simulator needs fractional
 * precision for chained multiplier calculations (stance modifiers are applied on top).
 * The frontend uses `Math.floor` for display (players see integer stats).
 * Both formulas share the same constants and loadout/stance definitions from this module.
 */

import { ROBOT_ATTRIBUTES } from './robotAttributes';

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Minimal weapon shape needed for bonus calculation.
 * Works with both Prisma models and plain API response objects.
 */
export interface WeaponBonuses {
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

export interface WeaponInventoryLike {
  weapon: WeaponBonuses;
}

/**
 * Minimal robot shape needed for stat calculations.
 * Works with both Prisma models (after Number() conversion) and plain API responses.
 */
export interface RobotStatsInput {
  loadoutType: string;
  mainWeapon?: WeaponInventoryLike | null;
  offhandWeapon?: WeaponInventoryLike | null;
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

/** Sparse map of attribute → tuning bonus value. */
export type TuningAttributeMap = Partial<Record<string, number>>;

// ─── Constants ──────────────────────────────────────────────────────────────

/** Base HP for all robots */
export const BASE_HP = 50;

/** HP gained per point of effective hull integrity */
export const HP_MULTIPLIER = 5;

/** Shield points per point of effective shield capacity */
export const SHIELD_MULTIPLIER = 4;

/**
 * Loadout bonus multipliers (percentage bonuses/penalties).
 * Applied as: effective = (base + weaponBonus + tuningBonus) × (1 + loadoutBonus)
 */
export const LOADOUT_BONUSES: Record<string, Record<string, number>> = {
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

/**
 * Stance modifiers (percentage bonuses/penalties).
 * Applied after loadout modifiers: final = effectiveStat × (1 + stanceModifier)
 *
 * Note: `shieldRegen` in defensive stance is a special server-side-only modifier
 * used by the combat simulator for shield regeneration calculations. It does NOT
 * modify the powerCore attribute directly in stat calculations.
 */
export const STANCE_MODIFIERS: Record<string, Record<string, number>> = {
  offensive: {
    combatPower: 0.15,         // +15%
    attackSpeed: 0.10,         // +10%
    counterProtocols: -0.10,   // -10%
    evasionThrusters: -0.10,   // -10%
  },
  defensive: {
    armorPlating: 0.15,        // +15%
    counterProtocols: 0.15,    // +15%
    shieldRegen: 0.20,         // +20% (server-side only: applied to powerCore for shield regen)
    combatPower: -0.10,        // -10%
    attackSpeed: -0.10,        // -10%
  },
  balanced: {
    // No modifiers - base stats only
  },
};

// ─── Core Calculation Functions ─────────────────────────────────────────────

/**
 * Calculate total bonus for an attribute from equipped weapons.
 */
export function calculateAttributeBonus(
  attributeKey: string,
  mainWeapon: WeaponInventoryLike | null | undefined,
  offhandWeapon: WeaponInventoryLike | null | undefined,
): number {
  let bonus = 0;
  const bonusKey = `${attributeKey}Bonus` as keyof WeaponBonuses;

  if (mainWeapon?.weapon[bonusKey] !== undefined) {
    bonus += mainWeapon.weapon[bonusKey] as number;
  }

  if (offhandWeapon?.weapon[bonusKey] !== undefined) {
    bonus += offhandWeapon.weapon[bonusKey] as number;
  }

  return bonus;
}

/**
 * Get loadout bonus multiplier for an attribute.
 */
export function getLoadoutBonus(loadoutType: string, attribute: string): number {
  const bonuses = LOADOUT_BONUSES[loadoutType];
  if (!bonuses) return 0;
  return bonuses[attribute] || 0;
}

/**
 * Get stance modifier for an attribute.
 */
export function getStanceModifier(stance: string, attribute: string): number {
  const modifiers = STANCE_MODIFIERS[stance];
  if (!modifiers) return 0;
  return modifiers[attribute] || 0;
}

/**
 * Calculate a single effective stat value including weapon bonuses, tuning bonuses,
 * and loadout modifiers. Returns a floored integer for display purposes.
 *
 * Formula: floor((base + weaponBonus + tuningBonus) × (1 + loadoutBonus))
 */
export function calculateEffectiveStat(
  baseValue: number,
  weaponBonus: number,
  loadoutBonus: number,
  tuningBonus: number = 0,
): number {
  const loadoutMultiplier = 1 + loadoutBonus;
  return Math.floor((baseValue + weaponBonus + tuningBonus) * loadoutMultiplier);
}

/**
 * Calculate all effective stats for a robot (floored integers for display).
 *
 * @param robot - Robot with attributes and optional weapons
 * @param tuningBonuses - Optional sparse map of attribute → tuning bonus value
 */
export function calculateEffectiveStats(
  robot: RobotStatsInput,
  tuningBonuses?: TuningAttributeMap,
): Record<string, number> {
  const effectiveStats: Record<string, number> = {};

  for (const attr of ROBOT_ATTRIBUTES) {
    const baseValue = robot[attr as keyof RobotStatsInput] as number;
    const weaponBonus = calculateAttributeBonus(attr, robot.mainWeapon, robot.offhandWeapon);
    const loadoutBonus = getLoadoutBonus(robot.loadoutType, attr);
    const tuningBonus = tuningBonuses?.[attr] ?? 0;
    effectiveStats[attr] = calculateEffectiveStat(baseValue, weaponBonus, loadoutBonus, tuningBonus);
  }

  return effectiveStats;
}

/**
 * Calculate max HP based on effective hull integrity.
 * Formula: BASE_HP + (effectiveHullIntegrity × HP_MULTIPLIER)
 */
export function calculateMaxHP(
  robot: RobotStatsInput,
  tuningBonuses?: TuningAttributeMap,
): number {
  const effectiveStats = calculateEffectiveStats(robot, tuningBonuses);
  return BASE_HP + (effectiveStats.hullIntegrity * HP_MULTIPLIER);
}

/**
 * Calculate max Shield based on effective shield capacity.
 * Formula: effectiveShieldCapacity × SHIELD_MULTIPLIER
 */
export function calculateMaxShield(
  robot: RobotStatsInput,
  tuningBonuses?: TuningAttributeMap,
): number {
  const effectiveStats = calculateEffectiveStats(robot, tuningBonuses);
  return effectiveStats.shieldCapacity * SHIELD_MULTIPLIER;
}

// ─── Utility Functions ──────────────────────────────────────────────────────

/**
 * Get all attributes modified by a specific loadout type.
 */
export function getLoadoutModifiedAttributes(loadoutType: string): string[] {
  const bonuses = LOADOUT_BONUSES[loadoutType];
  if (!bonuses) return [];
  return Object.keys(bonuses);
}

/**
 * Format loadout type key for display.
 */
export function formatLoadoutName(loadoutType: string): string {
  const names: Record<string, string> = {
    single: 'Single Weapon',
    weapon_shield: 'Weapon + Shield',
    two_handed: 'Two-Handed',
    dual_wield: 'Dual Wield',
  };
  return names[loadoutType] || loadoutType;
}

/**
 * Get loadout description text.
 */
export function getLoadoutDescription(loadoutType: string): string {
  const descriptions: Record<string, string> = {
    single: 'Balanced approach with mobility bonus',
    weapon_shield: 'Defensive tank with shield regeneration',
    two_handed: 'Glass cannon with massive damage output',
    dual_wield: 'Speed demon with rapid attacks',
  };
  return descriptions[loadoutType] || '';
}

/**
 * Get display string for attribute with bonuses and loadout modifiers.
 */
export function getAttributeDisplay(
  baseValue: number,
  weaponBonus: number,
  loadoutBonus: number,
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
 * Validate stance value.
 */
export function isValidStance(stance: string): boolean {
  return ['offensive', 'defensive', 'balanced'].includes(stance.toLowerCase());
}

/**
 * Validate yield threshold value (must be integer 0-50).
 */
export function isValidYieldThreshold(threshold: number): boolean {
  return typeof threshold === 'number' && !isNaN(threshold) && isFinite(threshold) && threshold >= 0 && threshold <= 50;
}
