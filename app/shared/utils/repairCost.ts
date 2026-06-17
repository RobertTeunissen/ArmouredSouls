/**
 * Repair cost calculation shared between backend and frontend.
 *
 * The formula mirrors the backend's `calculateRepairCost` in
 * `app/backend/src/utils/robotCalculations.ts`. Any changes there
 * must be reflected here (and vice-versa) until the backend is
 * migrated to import from this shared module.
 *
 * Formula:
 *   baseRepairCost = sumOfAllAttributes × 100
 *   multiplier     = 2.0 if hpPercent === 0
 *                    1.5 if hpPercent < 10
 *                    1.0 otherwise
 *   rawCost        = baseRepairCost × (damagePercent / 100) × multiplier
 *   repairBayDiscount = min(90, repairBayLevel × (5 + activeRobotCount)) / 100
 *   finalCost      = round(rawCost × (1 - repairBayDiscount))
 */

import { ROBOT_ATTRIBUTES } from './robotAttributes';

/** Cost multiplier per attribute point */
const ATTRIBUTE_COST_MULTIPLIER = 100;

/** Multiplier when robot is at exactly 0% HP (total destruction) */
const DESTRUCTION_MULTIPLIER = 2.0;

/** Multiplier when robot is below 10% HP (heavily damaged) */
const HEAVY_DAMAGE_MULTIPLIER = 1.5;

/** Maximum Repair Bay discount percentage */
const MAX_REPAIR_BAY_DISCOUNT = 90;

/** Manual repair discount (50% off auto-repair cost) */
export const MANUAL_REPAIR_DISCOUNT = 0.5;

/**
 * Minimal robot shape needed to compute repair cost.
 * Works with both Prisma model objects and plain API response objects.
 */
export interface RepairCostRobot {
  currentHP: number;
  maxHP: number;
}

/**
 * Round to 2 decimal places — mirrors the backend's `roundToTwo`.
 */
function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Sum all 23 attribute values on a robot object.
 * Handles both numeric values and Prisma Decimal objects (via `Number()`).
 * Applies `roundToTwo` to the sum to match the backend's `calculateAttributeSum`.
 */
export function sumAttributes(robot: RepairCostRobot): number {
  let sum = 0;
  const rec = robot as unknown as Record<string, unknown>;
  for (const key of ROBOT_ATTRIBUTES) {
    const val = rec[key];
    if (val != null) {
      sum += Number(val);
    }
  }
  return roundToTwo(sum);
}

/**
 * Calculate the automatic repair cost for a single robot.
 * This is the cost before the manual repair discount is applied.
 *
 * Signature matches the backend's `calculateRepairCost` in robotCalculations.ts
 * (including the unused `_medicalBayLevel` placeholder for future use).
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

  const baseRepairCost = sumOfAllAttributes * ATTRIBUTE_COST_MULTIPLIER;

  // Determine multiplier based on HP percentage
  let multiplier = 1.0;
  if (hpPercent === 0) {
    multiplier = DESTRUCTION_MULTIPLIER;
  } else if (hpPercent < 10) {
    multiplier = HEAVY_DAMAGE_MULTIPLIER;
  }

  const rawCost = baseRepairCost * (damagePercent / 100) * multiplier;

  // Repair Bay discount with multi-robot bonus
  const rawDiscount = repairBayLevel * (5 + activeRobotCount);
  const repairBayDiscount = Math.min(rawDiscount, MAX_REPAIR_BAY_DISCOUNT) / 100;
  const finalCost = rawCost * (1 - repairBayDiscount);

  return Math.round(finalCost);
}

/**
 * Calculate the automatic repair cost for a robot given its full object.
 * Convenience wrapper that derives damagePercent and hpPercent from the robot.
 */
export function calculateRobotRepairCost(
  robot: RepairCostRobot,
  repairBayLevel: number = 0,
  activeRobotCount: number = 0,
): number {
  const damageTaken = robot.maxHP - robot.currentHP;
  if (damageTaken <= 0) return 0;

  const damagePercent = (damageTaken / robot.maxHP) * 100;
  const hpPercent = (robot.currentHP / robot.maxHP) * 100;
  const attributeSum = sumAttributes(robot);

  return calculateRepairCost(attributeSum, damagePercent, hpPercent, repairBayLevel, 0, activeRobotCount);
}

/**
 * Calculate the Repair Bay discount percentage.
 */
export function calculateRepairBayDiscount(repairBayLevel: number, activeRobotCount: number): number {
  return Math.min(MAX_REPAIR_BAY_DISCOUNT, repairBayLevel * (5 + activeRobotCount));
}
