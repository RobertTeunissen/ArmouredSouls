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
 * Calculate weapon resale rate based on Weapon Workshop level.
 * Formula: level × 10, clamped to [0, 100].
 *
 * Mirrors the Workshop purchase discount slope (10% per level).
 * "Workshop level rewards you 10% on both ends of every transaction."
 *
 * Level 0:  0% (resale gated behind Workshop L1 — selling at L0 yields ₡0)
 * Level 1:  10%
 * Level 3:  30% (top of new-player range — first prestige gate is at L4)
 * Level 5:  50%
 * Level 10: 100% (full credit recovery; exploit-safe via pricePaid anchor)
 *
 * Resale rate is applied to `WeaponInventory.pricePaid` (the credits the player
 * actually paid), NOT the catalog price, so a Workshop L10 player who buys
 * for free recovers ₡0 on resale.
 */
export function calculateWeaponResaleRate(level: number): number {
  const clampedLevel = Math.max(0, Math.min(10, level));
  return clampedLevel * 10;
}

/**
 * Apply resale rate to a price.
 * Floor-rounded to keep values integer-cents-equivalent.
 */
export function applyResaleRate(pricePaid: number, ratePercent: number): number {
  return Math.floor((pricePaid * ratePercent) / 100);
}

/**
 * Apply discount to a price
 */
export function applyDiscount(price: number, discountPercent: number): number {
  return Math.floor(price * (1 - discountPercent / 100));
}
