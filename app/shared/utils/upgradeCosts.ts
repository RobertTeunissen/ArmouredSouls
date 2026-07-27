/**
 * Attribute upgrade cost calculations
 *
 * Base cost formula: (Math.floor(currentLevel) + 1) × 1500 credits per level.
 * Training Facility discount is applied via calculateTrainingFacilityDiscount.
 *
 * See docs/game-systems/STABLE_SYSTEM.md for authoritative specification.
 */

import { calculateTrainingFacilityDiscount } from './discounts';

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
  const baseCost = calculateBaseCost(currentLevel);
  const discountPercent = calculateTrainingFacilityDiscount(trainingLevel, rosterCapacity);
  return Math.floor(baseCost * (100 - discountPercent) / 100);
}

/** Total base cost for upgrading from fromLevel to toLevel (before discounts). */
export function calculateUpgradeCostRange(fromLevel: number, toLevel: number): number {
  let total = 0;
  for (let level = fromLevel; level < toLevel; level++) {
    total += calculateBaseCost(level);
  }
  return total;
}
