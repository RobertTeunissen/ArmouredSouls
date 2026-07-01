/**
 * Robot stat calculations for the backend (combat simulation, HP/shield derivation).
 *
 * Constants (LOADOUT_BONUSES, STANCE_MODIFIERS, BASE_HP, HP_MULTIPLIER) are imported
 * from the shared module — single source of truth for both frontend and backend.
 *
 * The backend's `calculateEffectiveStats` uses `roundToTwo` (2 decimal precision)
 * instead of `Math.floor` because the combat simulator applies additional stance
 * multipliers on top and needs fractional precision to avoid compound rounding errors.
 * The frontend uses `Math.floor` via the shared module for integer display values.
 */

import { Robot, WeaponInventory, Weapon, Prisma } from '../../generated/prisma';
import { toNumber } from '../lib/prismaHelpers';
import { ROBOT_ATTRIBUTES } from '../shared/utils/robotAttributes';
import type { TuningAttributeMap } from '../services/tuning-pool';
import {
  applyRefinementsToWeapon,
  type RefinementRow,
  type RefinementTier,
} from '../shared/utils/weaponRefinement';

// Re-export shared constants so existing consumers don't need to change import paths
export {
  LOADOUT_BONUSES,
  STANCE_MODIFIERS,
  BASE_HP,
  HP_MULTIPLIER,
  SHIELD_MULTIPLIER,
  getLoadoutBonus,
  getLoadoutModifiedAttributes,
  getStanceModifier,
  isValidStance,
  isValidYieldThreshold,
} from '../shared/utils/robotStats';

import {
  LOADOUT_BONUSES,
  STANCE_MODIFIERS,
  BASE_HP,
  HP_MULTIPLIER,
} from '../shared/utils/robotStats';

/**
 * Round to 2 decimal places — used by backend for combat precision.
 */
function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

type RobotWithWeapons = Robot & {
  mainWeapon?: (WeaponInventory & { weapon: Weapon }) | null;
  offhandWeapon?: (WeaponInventory & { weapon: Weapon }) | null;
};

/**
 * Calculate effective stats for a robot including base attributes,
 * weapon bonuses, optional tuning bonuses, and loadout modifiers.
 *
 * Formula: roundToTwo((base + weaponBonus + tuningBonus) × loadoutMultiplier)
 *
 * Uses `roundToTwo` (not `Math.floor`) because the combat simulator applies
 * additional stance multipliers on top and needs fractional precision.
 *
 * @param robot - Robot with optional weapon includes
 * @param tuningBonuses - Optional sparse map of attribute → tuning bonus value
 */
export function calculateEffectiveStats(robot: RobotWithWeapons, tuningBonuses?: TuningAttributeMap): Record<string, number> {
  const loadoutType = robot.loadoutType as keyof typeof LOADOUT_BONUSES;
  const loadoutBonuses = LOADOUT_BONUSES[loadoutType] || {};

  const effectiveStats: Record<string, number> = {};

  for (const attr of ROBOT_ATTRIBUTES) {
    // Convert Prisma Decimal to JavaScript number
    const baseValue = toNumber(robot[attr as keyof Robot] as number | Prisma.Decimal);
    const weaponBonus = getWeaponBonus(robot, attr);
    const tuningBonus = tuningBonuses?.[attr as keyof TuningAttributeMap] ?? 0;
    const loadoutMultiplier = (loadoutBonuses[attr as keyof typeof loadoutBonuses] || 0) + 1;

    // Formula: (base + weaponBonus + tuningBonus) × loadoutMultiplier
    // Round to 2 decimal places for precision
    effectiveStats[attr] = roundToTwo((baseValue + weaponBonus + tuningBonus) * loadoutMultiplier);
  }

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
  tuningBonuses?: TuningAttributeMap,
): void {
  // Spec #34: Fold weapon refinements into the weapon's effective stats here.
  foldWeaponRefinements(robot.mainWeapon ?? null);
  foldWeaponRefinements(robot.offhandWeapon ?? null);

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
  robot.maxHP = BASE_HP + Number(robot.hullIntegrity) * HP_MULTIPLIER;
  robot.maxShield = Number(robot.shieldCapacity) * 4;

  // Set current HP and shield to max (robots enter combat at full health)
  robot.currentHP = robot.maxHP;
  robot.currentShield = robot.maxShield;
}

/**
 * Get total weapon bonus for a specific attribute from equipped weapons.
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
 * Spec #34 — Fold a weapon-inventory row's refinements into the weapon record's
 * effective stats. Mutates the inventory's `weapon` object in place so downstream
 * readers see the post-refinement values.
 */
function foldWeaponRefinements(
  inventory:
    | (WeaponInventory & {
        weapon?: Weapon;
        refinements?: Array<{ tier: string; magnitude: number; targetAttribute: string | null }>;
      })
    | null,
): void {
  if (!inventory?.weapon) return;

  const refinements: RefinementRow[] = (inventory.refinements ?? []).map((r) => ({
    tier: r.tier as RefinementTier,
    magnitude: r.magnitude,
    targetAttribute: r.targetAttribute,
  }));

  // Always attach markers so consumers can rely on them being present.
  const markerTarget = inventory.weapon as unknown as Record<string, unknown>;
  markerTarget.__refinementCount = refinements.length;
  markerTarget.__customName = inventory.customName ?? null;

  if (refinements.length === 0) return;

  const effective = applyRefinementsToWeapon(inventory.weapon, refinements);

  // Overwrite catalog values with effective ones.
  const writable = inventory.weapon as unknown as Record<string, unknown>;
  writable.baseDamage = effective.effectiveBaseDamage;
  writable.cooldown = effective.effectiveCooldown;

  for (const [field, value] of Object.entries(effective.effectiveAttributeBonuses)) {
    writable[field] = value;
  }
}

/**
 * Calculate maximum HP based on hull integrity, weapon bonuses, tuning bonuses, and loadout.
 * Formula: BASE_HP + (hullIntegrity × HP_MULTIPLIER)
 */
export function calculateMaxHP(robot: RobotWithWeapons, tuningBonuses?: TuningAttributeMap): number {
  const effectiveStats = calculateEffectiveStats(robot, tuningBonuses);
  return BASE_HP + (effectiveStats.hullIntegrity * HP_MULTIPLIER);
}

/**
 * Calculate maximum Shield based on shield capacity, weapon bonuses, tuning bonuses, and loadout.
 */
export function calculateMaxShield(robot: RobotWithWeapons, tuningBonuses?: TuningAttributeMap): number {
  const effectiveStats = calculateEffectiveStats(robot, tuningBonuses);
  return effectiveStats.shieldCapacity * 4;
}

/**
 * Calculate effective stats including stance modifiers.
 * Stance modifiers are applied after loadout modifiers.
 */
export function calculateEffectiveStatsWithStance(robot: RobotWithWeapons, tuningBonuses?: TuningAttributeMap): Record<string, number> {
  // First get base effective stats with weapons, tuning, and loadout
  const baseEffectiveStats = calculateEffectiveStats(robot, tuningBonuses);

  // Apply stance modifiers
  const stance = robot.stance as keyof typeof STANCE_MODIFIERS;
  const stanceModifiers = STANCE_MODIFIERS[stance] || STANCE_MODIFIERS.balanced;

  const effectiveStatsWithStance: Record<string, number> = { ...baseEffectiveStats };

  // Apply stance modifiers to relevant attributes
  for (const [attr, modifier] of Object.entries(stanceModifiers)) {
    if (attr === 'shieldRegen') {
      // shieldRegen is a special case — modifies powerCore for regeneration calculations only
      continue;
    }

    if (effectiveStatsWithStance[attr] !== undefined && typeof modifier === 'number') {
      const multiplier = 1 + modifier;
      effectiveStatsWithStance[attr] = roundToTwo(effectiveStatsWithStance[attr] * multiplier);
    }
  }

  return effectiveStatsWithStance;
}

/**
 * Calculate repair cost based on damage, HP, Repair Bay level, and active robot count.
 * Formula: baseRepairCost × (damagePercent / 100) × multiplier × (1 - repairBayDiscount)
 * Multi-robot discount: repairBayLevel × (5 + activeRobotCount), capped at 90%
 */
export function calculateRepairCost(
  sumOfAllAttributes: number,
  damagePercent: number,
  hpPercent: number,
  repairBayLevel: number = 0,
  _medicalBayLevel: number = 0,
  activeRobotCount: number = 0,
): number {
  if (damagePercent <= 0) return 0;

  const baseRepairCost = sumOfAllAttributes * 100;

  // Determine multiplier based on HP percentage
  let multiplier = 1.0;
  if (hpPercent === 0) {
    multiplier = 2.0; // Total destruction
  } else if (hpPercent < 10) {
    multiplier = 1.5; // Heavily damaged
  }

  const rawCost = baseRepairCost * (damagePercent / 100) * multiplier;

  // Apply Repair Bay discount with multi-robot bonus
  const rawDiscount = repairBayLevel * (5 + activeRobotCount);
  const repairBayDiscount = Math.min(rawDiscount, 90) / 100;
  const finalCost = rawCost * (1 - repairBayDiscount);

  return Math.round(finalCost);
}

/**
 * Calculate sum of all 23 robot attributes.
 */
export function calculateAttributeSum(robot: Robot): number {
  let sum = 0;
  for (const attr of ROBOT_ATTRIBUTES) {
    sum += toNumber(robot[attr as keyof Robot] as number | Prisma.Decimal);
  }
  return roundToTwo(sum);
}
