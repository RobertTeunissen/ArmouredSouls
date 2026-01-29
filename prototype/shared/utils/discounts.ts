/**
 * Shared utility functions for calculating facility discounts
 * Used by both frontend and backend
 */

/**
 * Calculate discount percentage based on Weapon Workshop level
 * Formula: Discount % = Level × 5
 * Level 0: 0%
 * Level 1: 5%
 * Level 2: 10%
 * Level 3: 15%
 * Level 10: 50%
 */
export function calculateWeaponWorkshopDiscount(level: number): number {
  return level * 5;
}

/**
 * Calculate discount percentage based on Training Facility level
 * 5% per level
 */
export function calculateTrainingFacilityDiscount(level: number): number {
  return level * 5;
}

/**
 * Apply discount to a price
 */
export function applyDiscount(price: number, discountPercent: number): number {
  return Math.floor(price * (1 - discountPercent / 100));
}
