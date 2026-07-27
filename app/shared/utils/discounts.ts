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
 * Per-level Training Facility discount at Roster_Capacity 1, as a percentage.
 * The rate shrinks by `TRAINING_DISCOUNT_PER_SLOT` for each additional slot.
 */
export const TRAINING_DISCOUNT_BASE_PER_LEVEL = 10;

/** Percentage points removed from the per-level rate for each robot slot. */
export const TRAINING_DISCOUNT_PER_SLOT = 1;

/** Hard ceiling on the Training Facility discount. */
export const TRAINING_DISCOUNT_MAX = 90;

/**
 * Calculate the Training Facility discount on attribute upgrade costs.
 *
 * ```
 * rate_per_level = max(0, 10 - Roster_Capacity)
 * discount%      = clamp(rate_per_level × level, 0, 90)
 * ```
 *
 * Spec #46 R11: the discount was a flat `min(level × 10, 90)`, which saturated at
 * level 9 and made level 10 worthless — the facility's own max level bought
 * nothing. It also ignored roster size entirely, so a ten-robot stable got the
 * same per-level rate as a one-robot stable while having ten times as many
 * attributes to upgrade.
 *
 * The rate now shrinks 1 percentage point per robot slot, so the facility rewards
 * concentration in the same direction as the Merchandising Hub. Worked examples:
 *
 * | Level | Roster_Capacity | Rate/level | Discount |
 * |-------|-----------------|-----------|----------|
 * | 5     | 4               | 6%        | 30%      |
 * | 8     | 2               | 8%        | 64%      |
 * | 10    | 1               | 9%        | 90%      |
 * | 10    | 10              | 0%        | 0%       |
 *
 * The 90% ceiling is unchanged but is now reachable only by a single-robot stable
 * at level 10, rather than by any stable at level 9.
 *
 * Roster_Capacity is an explicit parameter rather than a lookup, keeping this
 * module free of database access — the frontend imports it directly. Use
 * `getRosterCapacity()` from `./rosterCapacity` to derive it from the
 * `roster_expansion` facility level.
 *
 * See docs/prd_core/STABLE_SYSTEM.md for the authoritative specification.
 */
export function calculateTrainingFacilityDiscount(level: number, rosterCapacity: number): number {
  // Clamped rather than allowed to go negative: roster_expansion caps at level 9
  // (capacity 10) today, which lands the rate exactly on 0. If that cap ever
  // rises, a larger roster must mean "no discount", never a cost penalty.
  const ratePerLevel = Math.max(
    0,
    TRAINING_DISCOUNT_BASE_PER_LEVEL - TRAINING_DISCOUNT_PER_SLOT * rosterCapacity,
  );
  return Math.min(Math.max(0, level) * ratePerLevel, TRAINING_DISCOUNT_MAX);
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
