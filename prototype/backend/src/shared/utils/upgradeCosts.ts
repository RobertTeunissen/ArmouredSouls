/**
 * Attribute upgrade cost calculations
 *
 * ⚠️  MIRRORED from prototype/shared/utils/upgradeCosts.ts
 * Keep both files in sync. The frontend imports from shared/utils/ directly.
 * The backend needs this copy inside src/ due to the rootDir constraint.
 *
 * See docs/prd_core/STABLE_SYSTEM.md for authoritative specification.
 */

import { calculateTrainingFacilityDiscount } from './discounts';

/** Base cost for upgrading from currentLevel to currentLevel+1 (before discounts). */
export function calculateBaseCost(currentLevel: number): number {
  return (Math.floor(currentLevel) + 1) * 1500;
}

/** Discounted cost for a single level upgrade, applying Training Facility discount. */
export function calculateDiscountedUpgradeCost(currentLevel: number, trainingLevel: number): number {
  const baseCost = calculateBaseCost(currentLevel);
  const discountPercent = calculateTrainingFacilityDiscount(trainingLevel);
  return Math.floor(baseCost * (1 - discountPercent / 100));
}

/** Total base cost for upgrading from fromLevel to toLevel (before discounts). */
export function calculateUpgradeCostRange(fromLevel: number, toLevel: number): number {
  let total = 0;
  for (let level = fromLevel; level < toLevel; level++) {
    total += calculateBaseCost(level);
  }
  return total;
}
