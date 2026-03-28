/**
 * Shared utility functions for calculating facility discounts
 * Used by both frontend and backend
 */

/**
 * Calculate discount percentage based on Weapon Workshop level
 * Formula: Discount % = Level × 10
 * Level 0: 0%
 * Level 1: 10%
 * Level 5: 50%
 * Level 10: 100%
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
