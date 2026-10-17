/**
 * Weapon pricing — shared module (Season 2).
 *
 * Single source of truth for the weapon catalogue price. `WEAPON_DEFINITIONS`
 * in `app/backend/prisma/seed.ts` keeps literal `cost` values so the catalogue
 * stays a reviewable data table; a unit test asserts every literal equals
 * `calculateWeaponPrice(def)`.
 *
 * ```
 * dpsRatio      = (baseDamage / cooldown) / BASELINE_DPS            (BASELINE_DPS = 2.0)
 * dpsCost       = WEAPON_BASE_COST × (dpsRatio − 1) × DPS_COST_MULTIPLIER   (0 for shields)
 * attributeCost = ATTRIBUTE_COST_MULTIPLIER × (Σ bonus)²             (signed sum)
 * price         = round1000((WEAPON_BASE_COST + dpsCost + attributeCost) × handMultiplier)
 * ```
 *
 * Hand multipliers: one-handed 1.0, two-handed 1.5, shield 1.3. Starter weapons
 * (no bonuses, baseline DPS 6/3, not a shield) are a flat `STARTER_WEAPON_COST`
 * regardless of hands.
 *
 * Bug fix (Season 2): the previous attribute part was `Σ(500 × bonus²)`, which
 * squared each bonus separately, so a penalty such as −3 Evasion Thrusters
 * *raised* the price. The sum is now signed: negative bonuses reduce Σ bonus
 * before it is squared, so a penalty lowers the price.
 *
 * See docs/game-systems/PRD_WEAPON_ECONOMY.md for the authoritative specification.
 */

import { ROBOT_ATTRIBUTES } from './robotAttributes';
import type { WeaponBonuses } from './robotStats';

/** Base cost every weapon starts from. */
export const WEAPON_BASE_COST = 50_000;

/** Flat price of a starter weapon (no bonuses, baseline DPS), regardless of hands. */
export const STARTER_WEAPON_COST = 50_000;

/** Baseline damage per second (starter weapons: 6 damage / 3 s). */
export const BASELINE_DPS = 2.0;

/** Multiplier on the DPS ratio above baseline. */
export const DPS_COST_MULTIPLIER = 6.0;

/** `m` in `m × (Σ bonus)²`. */
export const ATTRIBUTE_COST_MULTIPLIER = 500;

/** Hands a weapon occupies; `shield` is the offhand shield slot. */
export type WeaponHands = 'one' | 'two' | 'shield';

/** Price multiplier per hand type. */
export const HAND_MULTIPLIERS: Readonly<Record<WeaponHands, number>> = {
  one: 1.0,
  two: 1.5,
  shield: 1.3,
};

/** Fields `calculateWeaponPrice` reads from a catalogue entry. */
export interface WeaponPricingInput extends WeaponBonuses {
  baseDamage: number;
  cooldown: number;
  handsRequired: WeaponHands;
}

/** Signed sum of all 23 `<attr>Bonus` fields (missing fields count as 0). */
export function sumWeaponBonuses(bonuses: WeaponBonuses): number {
  let total = 0;
  for (const attr of ROBOT_ATTRIBUTES) {
    const key = `${attr}Bonus` as keyof WeaponBonuses;
    total += bonuses[key] ?? 0;
  }
  return total;
}

/** DPS part of the price: `50,000 × ((baseDamage / cooldown) / 2.0 − 1) × 6.0`; shields pay none. */
export function calculateWeaponDpsCost(input: WeaponPricingInput): number {
  if (input.handsRequired === 'shield') return 0;
  const dpsRatio = input.baseDamage / input.cooldown / BASELINE_DPS;
  return WEAPON_BASE_COST * (dpsRatio - 1) * DPS_COST_MULTIPLIER;
}

/** Attribute part of the price: `500 × (Σ bonus)²` with negatives included in the sum. */
export function calculateWeaponAttributeCost(bonuses: WeaponBonuses): number {
  const sum = sumWeaponBonuses(bonuses);
  return ATTRIBUTE_COST_MULTIPLIER * sum * sum;
}

/** A starter has no bonuses, baseline DPS and is not a shield. */
export function isStarterWeapon(input: WeaponPricingInput): boolean {
  if (input.handsRequired === 'shield') return false;
  const hasBonus = ROBOT_ATTRIBUTES.some(
    (attr) => (input[`${attr}Bonus` as keyof WeaponBonuses] ?? 0) !== 0,
  );
  return !hasBonus && input.baseDamage / input.cooldown === BASELINE_DPS;
}

/** Catalogue price, rounded to the nearest ₡1,000; starters are a flat ₡50,000. */
export function calculateWeaponPrice(input: WeaponPricingInput): number {
  if (isStarterWeapon(input)) return STARTER_WEAPON_COST;
  const raw =
    (WEAPON_BASE_COST + calculateWeaponDpsCost(input) + calculateWeaponAttributeCost(input)) *
    HAND_MULTIPLIERS[input.handsRequired];
  return Math.round(raw / 1000) * 1000;
}
