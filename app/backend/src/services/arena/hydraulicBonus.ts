/**
 * Hydraulic Systems Proximity-Scaled Damage Bonus
 *
 * Calculates a damage multiplier based on hydraulicSystems attribute
 * and current range band. Melee range gets the strongest bonus,
 * short range gets a reduced bonus, mid/long get no bonus.
 * The bonus is uncapped and linear in hydraulicSystems.
 *
 * All functions are pure with no module-level mutable state.
 *
 * Requirements: 4.1, 4.2, 4.3
 *
 * Balance Update (Season 2, #519): coefficients one step less steep —
 * melee 0.02 → 0.015 and short 0.015 → 0.01. At 50 Hydraulic Systems the
 * bonus is now 1.75× at melee (was 2.0×) and 1.5× at short (was 1.75×).
 * Logic Cores mirrors this for mid/long range (see logicCoresBonus.ts).
 */
import { RangeBand } from './types';
/** Melee range bonus coefficient per hydraulicSystems point (Season 2: 0.02 → 0.015) */
const MELEE_COEFFICIENT = 0.015;
/** Short range bonus coefficient per hydraulicSystems point (Season 2: 0.015 → 0.01) */
const SHORT_COEFFICIENT = 0.01;
/**
 * Calculate the hydraulic damage bonus multiplier.
 *
 * - Melee (0–2 units): 1 + hydraulicSystems × 0.015
 *   Range: 1.015 (hydro=1) to 1.75 (hydro=50), uncapped
 * - Short (3–6 units): 1 + hydraulicSystems × 0.01
 *   Range: 1.01 (hydro=1) to 1.5 (hydro=50), uncapped
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
