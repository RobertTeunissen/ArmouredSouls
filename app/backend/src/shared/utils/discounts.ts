/**
 * Shared utility functions for calculating facility discounts
 *
 * ⚠️  MIRRORED from app/shared/utils/discounts.ts
 * Keep both files in sync. The frontend imports from shared/utils/ directly.
 * The backend needs this copy inside src/ due to the rootDir constraint.
 */

/**
 * Calculate discount percentage based on Weapon Workshop level
 * Formula: Discount % = Level × 10
 */
export function calculateWeaponWorkshopDiscount(level: number): number {
  return level * 10;
}

/**
 * Calculate discount percentage based on Training Facility level
 * 10% per level, capped at 90% (Level 9 max)
 * See docs/prd_core/STABLE_SYSTEM.md for authoritative specification
 */
export function calculateTrainingFacilityDiscount(level: number): number {
  return Math.min(level * 10, 90);
}

/**
 * Apply discount to a price
 */
export function applyDiscount(price: number, discountPercent: number): number {
  return Math.floor(price * (1 - discountPercent / 100));
}
