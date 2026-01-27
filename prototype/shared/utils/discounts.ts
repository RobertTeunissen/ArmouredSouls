/**
 * Shared utility functions for calculating facility discounts
 * Used by both frontend and backend
 */

/**
 * Calculate discount percentage based on Weapon Workshop level
 * Level 0: 0%
 * Level 1: 10%
 * Level 2: 15%
 * Level 3+: 5% increments per level
 */
export function calculateWeaponWorkshopDiscount(level: number): number {
  if (level === 0) return 0;
  return level * 5 + 5; // 10% at level 1, 15% at level 2, etc.
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
