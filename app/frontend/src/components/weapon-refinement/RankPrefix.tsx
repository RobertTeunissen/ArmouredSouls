/**
 * RankPrefix — Tiny presentation component that renders the rank prefix
 * derived from a weapon's filled refinement slot count.
 *
 *   0 slots → renders nothing (returns null).
 *   1–2     → "Refined"        (cyan)
 *   3       → "Crafted"        (emerald)
 *   4       → "Mastercrafted"  (amber)
 *   5       → "Legendary"      (red-orange)
 *
 * Color choice tracks the tier-color rhythm of `TIER_VISUALS` so the
 * progression feels visually coherent: each rank step lights up using the
 * next tier's accent color. Pure presentation — no logic beyond a switch on
 * the rank string returned by `calculateRankPrefix`.
 *
 * Spec: 34-weapon-refinement (design.md → Components and Interfaces → Frontend Components)
 */

import type { JSX } from 'react';
import {
  calculateRankPrefix,
  type RankPrefix as RankPrefixValue,
} from '../../../../shared/utils/weaponRefinement';

interface RankPrefixProps {
  /** Number of filled refinement slots on the weapon (0-5). */
  refinementCount: number;
  /**
   * Visual variant:
   *  - `default`: standard inline tier-colored span
   *  - `subtle` : smaller, lower-contrast text for tight inline use
   *  - `badge`  : pill with background fill, used for emphasis (e.g. on weapon cards)
   */
  variant?: 'default' | 'subtle' | 'badge';
}

// ── Color mapping ────────────────────────────────────────────────────

/**
 * Map a non-null `RankPrefix` value to Tailwind utility classes for each
 * variant. Keeping the mapping co-located with the component avoids
 * stamping color literals across consumers — RankPrefix is the only place
 * the rank-prefix → color decision happens.
 */
const RANK_STYLES: Record<
  Exclude<RankPrefixValue, null>,
  { text: string; subtleText: string; badgeBg: string; badgeBorder: string }
> = {
  Refined: {
    text: 'text-cyan-300',
    subtleText: 'text-cyan-400/80',
    badgeBg: 'bg-cyan-500/15',
    badgeBorder: 'border-cyan-500/50',
  },
  Crafted: {
    text: 'text-emerald-300',
    subtleText: 'text-emerald-400/80',
    badgeBg: 'bg-emerald-500/15',
    badgeBorder: 'border-emerald-500/50',
  },
  Mastercrafted: {
    text: 'text-amber-300',
    subtleText: 'text-amber-400/80',
    badgeBg: 'bg-amber-500/15',
    badgeBorder: 'border-amber-500/50',
  },
  Legendary: {
    text: 'text-red-300',
    subtleText: 'text-red-400/80',
    badgeBg: 'bg-red-500/15',
    badgeBorder: 'border-red-500/50',
  },
};

// ── Component ────────────────────────────────────────────────────────

export function RankPrefix({ refinementCount, variant = 'default' }: RankPrefixProps): JSX.Element | null {
  const prefix = calculateRankPrefix(refinementCount);
  if (prefix === null) return null;

  const styles = RANK_STYLES[prefix];

  switch (variant) {
    case 'badge':
      return (
        <span
          data-testid="rank-prefix-badge"
          className={
            `inline-flex items-center text-xs font-semibold uppercase tracking-wide ` +
            `px-2 py-0.5 rounded border ${styles.badgeBg} ${styles.badgeBorder} ${styles.text}`
          }
        >
          {prefix}
        </span>
      );

    case 'subtle':
      return (
        <span
          data-testid="rank-prefix-subtle"
          className={`text-xs font-medium ${styles.subtleText}`}
        >
          {prefix}
        </span>
      );

    case 'default':
    default:
      return (
        <span
          data-testid="rank-prefix"
          className={`font-semibold ${styles.text}`}
        >
          {prefix}
        </span>
      );
  }
}
