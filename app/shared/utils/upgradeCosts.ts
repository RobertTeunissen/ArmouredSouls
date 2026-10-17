/**
 * Attribute upgrade cost calculations
 *
 * Base cost formula: (Math.floor(currentLevel) + 1) × 1500 credits per level.
 * Training Facility discount is applied via calculateTrainingFacilityDiscount,
 * per level and floored (applyTrainingDiscount), then summed.
 *
 * See docs/game-systems/STABLE_SYSTEM.md for authoritative specification.
 */

import { calculateTrainingFacilityDiscount, applyTrainingDiscount } from './discounts';

/** Base cost for upgrading from currentLevel to currentLevel+1 (before discounts). */
export function calculateBaseCost(currentLevel: number): number {
  return (Math.floor(currentLevel) + 1) * 1500;
}

/**
 * Discounted cost for a single level upgrade, applying the Training Facility discount.
 *
 * Spec #46 R11: `rosterCapacity` is required because the discount rate now shrinks
 * as the roster grows. Derive it with `getRosterCapacity()` from
 * `./rosterCapacity`; a single-robot stable passes 1.
 */
export function calculateDiscountedUpgradeCost(
  currentLevel: number,
  trainingLevel: number,
  rosterCapacity: number,
): number {
  const discountPercent = calculateTrainingFacilityDiscount(trainingLevel, rosterCapacity);
  return applyTrainingDiscount(calculateBaseCost(currentLevel), discountPercent);
}

/**
 * Credits charged for raising one attribute from `fromLevel` to `toLevel` with a
 * Training Facility discount of `discountPercent` (from
 * `calculateTrainingFacilityDiscount`): each level's base cost is discounted with
 * `applyTrainingDiscount` (floored per level), then the levels are summed.
 *
 * This is the formula `robotUpgradeService` charges; the Automaton pricing module
 * (Spec #55) and the frontend previews use the same function so a planned
 * upgrade costs exactly what the purchase will charge. `fromLevel` is an integer
 * level (callers floor it).
 */
export function calculateTrainingDiscountedUpgradeCost(
  fromLevel: number,
  toLevel: number,
  discountPercent: number,
): number {
  let total = 0;
  for (let level = fromLevel; level < toLevel; level++) {
    total += applyTrainingDiscount(calculateBaseCost(level), discountPercent);
  }
  return total;
}

/** Total base cost for upgrading from fromLevel to toLevel (before discounts). */
export function calculateUpgradeCostRange(fromLevel: number, toLevel: number): number {
  let total = 0;
  for (let level = fromLevel; level < toLevel; level++) {
    total += calculateBaseCost(level);
  }
  return total;
}
