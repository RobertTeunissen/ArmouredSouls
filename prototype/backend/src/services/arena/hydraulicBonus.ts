/**
 * Hydraulic Systems Proximity-Scaled Damage Bonus
 *
 * Calculates a damage multiplier based on hydraulicSystems attribute
 * and current range band. Melee range gets the strongest bonus,
 * short range gets a reduced bonus, mid/long get no bonus.
 *
 * All functions are pure with no module-level mutable state.
 *
 * Requirements: 4.1, 4.2, 4.3
 *
 * Balance Update (March 2026): Reduced melee coefficient from 0.03 to 0.02
 * to address melee dominance. Max bonus at melee range is now 2.0× (was 2.5×).
 */

import { RangeBand } from './types';

/** Melee range bonus coefficient per hydraulicSystems point (reduced from 0.03) */
const MELEE_COEFFICIENT = 0.02;

/** Short range bonus coefficient per hydraulicSystems point */
const SHORT_COEFFICIENT = 0.015;

/**
 * Calculate the hydraulic damage bonus multiplier.
 *
 * - Melee (0–2 units): 1 + hydraulicSystems × 0.02
 *   Range: 1.02 (hydro=1) to 2.0 (hydro=50)
 * - Short (3–6 units): 1 + hydraulicSystems × 0.015
 *   Range: 1.015 (hydro=1) to 1.75 (hydro=50)
 * - Mid/Long: 1.0 (no bonus)
 *
 * Req 4.1, 4.2, 4.3
 */
export function calculateHydraulicBonus(
  hydraulicSystems: number,
  rangeBand: RangeBand,
): number {
  if (rangeBand === 'melee') {
    return 1 + hydraulicSystems * MELEE_COEFFICIENT;
  }
  if (rangeBand === 'short') {
    return 1 + hydraulicSystems * SHORT_COEFFICIENT;
  }
  return 1.0;
}
