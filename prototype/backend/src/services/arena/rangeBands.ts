/**
 * Range Band Classification and Weapon Range Mapping
 *
 * Classifies distances into range bands, calculates range penalties,
 * maps weapons to their optimal range, and enforces melee attack restrictions.
 *
 * All functions are pure with no module-level mutable state.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { RangeBand, RANGE_BAND_BOUNDARIES, RANGE_PENALTY } from './types';

/** Minimal weapon shape needed for range classification */
export interface WeaponLike {
  name: string;
  rangeBand: RangeBand;
}

/** Ordered range bands from closest to farthest */
const BAND_ORDER: RangeBand[] = ['melee', 'short', 'mid', 'long'];

/**
 * Classify a distance (in grid units) into a range band.
 *
 * melee: 0–2, short: 3–6, mid: 7–12, long: 13+
 * Negative distances are treated as 0 (melee).
 */
export function classifyRangeBand(distance: number): RangeBand {
  if (distance <= RANGE_BAND_BOUNDARIES.melee.max) return 'melee';
  if (distance <= RANGE_BAND_BOUNDARIES.short.max) return 'short';
  if (distance <= RANGE_BAND_BOUNDARIES.mid.max) return 'mid';
  return 'long';
}

/**
 * Get the damage multiplier for attacking from a given range band
 * with a weapon whose optimal range is a different band.
 *
 * - Same band (optimal): 1.1×
 * - One band away: 0.75×
 * - Two+ bands away: 0.5×
 */
export function getRangePenalty(weaponRange: RangeBand, currentRange: RangeBand): number {
  const weaponIdx = BAND_ORDER.indexOf(weaponRange);
  const currentIdx = BAND_ORDER.indexOf(currentRange);
  const bandDiff = Math.abs(weaponIdx - currentIdx);

  if (bandDiff === 0) return RANGE_PENALTY.optimal;
  if (bandDiff === 1) return RANGE_PENALTY.oneAway;
  return RANGE_PENALTY.twoOrMore;
}

/**
 * Determine a weapon's optimal range band from its stored rangeBand value.
 */
export function getWeaponOptimalRange(weapon: WeaponLike): RangeBand {
  return weapon.rangeBand;
}

/**
 * Check whether a weapon can attack at the given distance.
 *
 * Melee weapons are blocked beyond 2 grid units (melee band max).
 * All other weapons can attack at any distance.
 */
export function canAttack(weapon: WeaponLike, distance: number): boolean {
  if (weapon.rangeBand === 'melee' && distance > RANGE_BAND_BOUNDARIES.melee.max) {
    return false;
  }
  return true;
}
