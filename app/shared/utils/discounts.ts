/**
 * Shared utility functions for calculating facility discounts
 * Used by both frontend and backend
 */

/**
 * Calculate discount percentage based on Weapon Workshop level
 * Formula: Discount % = Level × 5, level clamped to [0, 10]
 * Level 0: 0%
 * Level 1: 5%
 * Level 5: 25%
 * Level 10: 50%
 *
 * Season 2: reduced from 10% per level (L10 was 100%, i.e. free weapons).
 */
export function calculateWeaponWorkshopDiscount(level: number): number {
  return Math.max(0, Math.min(10, level)) * 5;
}

/**
 * Slot count the Training Facility rate counts down from: the unscaled rate per
 * level is `TRAINING_DISCOUNT_BASE_PER_LEVEL − TRAINING_DISCOUNT_PER_SLOT × Roster_Capacity`.
 */
export const TRAINING_DISCOUNT_BASE_PER_LEVEL = 10;

/** Unscaled percentage points removed from the per-level rate for each robot slot. */
export const TRAINING_DISCOUNT_PER_SLOT = 1;

/**
 * Season 2 (#526): the whole Training Facility curve is scaled by this factor
 * (L10 at Roster_Capacity 1 went from 90% to 67.5%).
 */
export const TRAINING_DISCOUNT_FACTOR = 0.75;

/** Highest Training Facility level the discount counts. */
export const TRAINING_FACILITY_MAX_LEVEL = 10;

/**
 * Calculate the Training Facility discount on attribute upgrade costs, in percent.
 *
 * ```
 * discount% = clamp(level, 0, 10) × max(0, 10 − Roster_Capacity) × 0.75
 * ```
 *
 * Spec #46 R11 made the rate shrink 1 point per robot slot, so the facility
 * rewards concentration in the same direction as the Merchandising Hub. Season 2
 * (#526) scales that curve by 0.75, because late upgrades had become too cheap.
 * Worked examples:
 *
 * | Level | Roster_Capacity | Before Season 2 | Season 2 |
 * |-------|-----------------|-----------------|----------|
 * | 1     | 1               | 9%              | 6.75%    |
 * | 6     | 1               | 54%             | 40.5%    |
 * | 5     | 4               | 30%             | 22.5%    |
 * | 10    | 4               | 60%             | 45%      |
 * | 10    | 1               | 90%             | 67.5%    |
 * | 10    | 10 or more      | 0%              | 0%       |
 *
 * The result is a multiple of 0.25 and is exact in floating point (an integer
 * of at most 100 times 0.75), so fractional rates such as 40.5% need no rounding.
 * The maximum is 67.5% (L10, capacity 1); the former 90% ceiling could no longer
 * bind and was removed rather than kept as a dead cap.
 *
 * Roster_Capacity is an explicit parameter rather than a lookup, keeping this
 * module free of database access — the frontend imports it directly. Use
 * `getRosterCapacity()` from `./rosterCapacity` (purchased capacity, never the
 * robots currently owned) to derive it from the `roster_expansion` level.
 *
 * See docs/game-systems/STABLE_SYSTEM.md for the authoritative specification.
 */
export function calculateTrainingFacilityDiscount(level: number, rosterCapacity: number): number {
  const clampedLevel = Math.min(Math.max(0, level), TRAINING_FACILITY_MAX_LEVEL);
  // Clamped rather than allowed to go negative: roster_expansion caps at level 10
  // (capacity 11), which would land the rate below zero. A larger roster must
  // mean "no discount", never a cost penalty.
  const slotsBelowCeiling = Math.max(
    0,
    TRAINING_DISCOUNT_BASE_PER_LEVEL - TRAINING_DISCOUNT_PER_SLOT * rosterCapacity,
  );
  return clampedLevel * slotsBelowCeiling * TRAINING_DISCOUNT_FACTOR;
}

/**
 * Apply a Training Facility discount to one level's base cost, floored to whole
 * credits: `floor(price × (100 − discount%) / 100)`.
 *
 * Unlike `applyDiscount` (`price × (1 − d/100)`, kept for the Weapons Workshop),
 * this form is exact for the quarter-percent rates `calculateTrainingFacilityDiscount`
 * returns: `100 − d` is exactly representable, the product is an exact multiple
 * of 0.25, and the single division is correctly rounded, so the floor never
 * drops a credit (e.g. 2,000 at 6.75% is exactly 1,865).
 */
export function applyTrainingDiscount(price: number, discountPercent: number): number {
  return Math.floor((price * (100 - discountPercent)) / 100);
}

/**
 * Calculate weapon resale rate based on Weapon Workshop level.
 * Formula: level × 10, clamped to [0, 100].
 *
 * Steeper than the Workshop purchase discount (5% per level), so at L10 a
 * player buys at half price and sells back at the full price paid, which
 * supports trading up.
 *
 * Level 0:  0% (resale gated behind Workshop L1 — selling at L0 yields ₡0)
 * Level 1:  10%
 * Level 3:  30% (top of new-player range — first prestige gate is at L4)
 * Level 5:  50%
 * Level 10: 100% (full credit recovery; exploit-safe via pricePaid anchor)
 *
 * Resale rate is applied to `WeaponInventory.pricePaid` (the credits the player
 * actually paid), NOT the catalog price, so a player can never recover more
 * than they spent.
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
