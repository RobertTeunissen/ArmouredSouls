/**
 * Shared display copy and number formatting for the Weapon Refinement UIs.
 *
 * Spec #46 turned Sharpen and Forge from flat adjustments (`-0.25s`, `+1.0`)
 * into proportional ones. The percentages are derived from the shared formula
 * module rather than retyped, so a future balance pass changes one constant and
 * every surface follows: the refinement modal, the slot bar tooltips, the
 * history popover, and the admin adoption dashboard.
 */

import {
  SHARPEN_COOLDOWN_REDUCTION_PER_INSTANCE,
  FORGE_DAMAGE_INCREASE_PER_INSTANCE,
} from '../../../../shared/utils/weaponRefinement';

/** Per-instance Sharpen reduction as a whole-number percentage (10). */
export const SHARPEN_PCT = Math.round(SHARPEN_COOLDOWN_REDUCTION_PER_INSTANCE * 100);

/** Per-instance Forge increase as a whole-number percentage (8). */
export const FORGE_PCT = Math.round(FORGE_DAMAGE_INCREASE_PER_INSTANCE * 100);

/** Per-tier instance cap for the two proportional tiers. */
export const PROPORTIONAL_TIER_CAP = 2;

/** Sharpen effect for one filled slot, e.g. `−10% cooldown`. */
export const SHARPEN_EFFECT_LABEL = `−${SHARPEN_PCT}% cooldown`;

/** Forge effect for one filled slot, e.g. `+8% base damage`. */
export const FORGE_EFFECT_LABEL = `+${FORGE_PCT}% base damage`;

/** Sharpen effect at the instance cap, e.g. `−20%`. */
export const SHARPEN_CAP_LABEL = `−${SHARPEN_PCT * PROPORTIONAL_TIER_CAP}%`;

/** Forge effect at the instance cap, e.g. `+16%`. */
export const FORGE_CAP_LABEL = `+${FORGE_PCT * PROPORTIONAL_TIER_CAP}%`;

/**
 * Render a refinement stat with trailing zeros trimmed.
 *
 * Proportional refinements produce one *or* two meaningful decimals depending
 * on the weapon: a 2.0s cooldown at the Sharpen cap is 1.6s, while a 3.5s
 * cooldown at one instance is 3.15s. A fixed `toFixed(1)` would round 3.15 to
 * 3.2 and a fixed `toFixed(2)` would pad 1.6 to `1.60`, so we format at the
 * Refinement_Rounding_Precision of 2 and then strip the padding.
 */
export function formatRefinementStat(value: number): string {
  return String(Math.round(value * 100) / 100);
}
