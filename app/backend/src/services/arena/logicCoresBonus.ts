/**
 * Logic Cores Range-Scaled Damage Bonus
 *
 * Ranged counterpart of the Hydraulic Systems bonus (Season 2, #519).
 * Long range uses the hydraulic melee coefficient (0.015); mid range keeps
 * 0.01, which no longer equals the hydraulic short coefficient since Season 2
 * round 3 lowered that to 0.005.
 * Calculates a damage multiplier based on the logicCores attribute and
 * the current range band. Long range gets the strongest bonus, mid range
 * gets a reduced bonus, short/melee get no bonus. The bonus is uncapped,
 * linear in logicCores and affects damage only — Logic Cores keeps its
 * separate pressure/composure role (pressureSystem.ts).
 *
 * All functions are pure with no module-level mutable state.
 */
import { RangeBand } from './types';
/** Long range bonus coefficient per logicCores point */
const LONG_COEFFICIENT = 0.015;
/** Mid range bonus coefficient per logicCores point */
const MID_COEFFICIENT = 0.01;
/**
 * Calculate the Logic Cores damage bonus multiplier.
 *
 * - Long (13+ units): 1 + logicCores × 0.015
 *   Range: 1.015 (LC=1) to 1.75 (LC=50), uncapped
 * - Mid (7–12 units): 1 + logicCores × 0.01
 *   Range: 1.01 (LC=1) to 1.5 (LC=50), uncapped
 * - Short/Melee: 1.0 (no bonus)
 */
export function calculateLogicCoresBonus(
  logicCores: number,
  rangeBand: RangeBand,
): number {
  if (rangeBand === 'long') {
    return 1 + logicCores * LONG_COEFFICIENT;
  }
  if (rangeBand === 'mid') {
    return 1 + logicCores * MID_COEFFICIENT;
  }
  return 1.0;
}
