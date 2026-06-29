/**
 * Grand Melee Reward Calculation
 *
 * Computes credits, fame, prestige, and LP delta for each Grand Melee placement.
 * Uses the same tier-based structure as KotH but with:
 * - F1-style LP scale (25/18/15/12/10/8/6/4/2/1 for top 10)
 * - 2.5× credit multiplier (reflecting harder competition vs KotH's 5-6 robots)
 * - Participation floor of 0.2× for positions 11-20
 *
 * Spec #44: Grand Melee — Requirements R3.1–R3.6
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** F1 point scale — LP awarded per placement (positions 1-10, 0 for 11+) */
export const GRAND_MELEE_LP_SCALE: readonly number[] = [
  25, 18, 15, 12, 10, 8, 6, 4, 2, 1,
] as const;

/**
 * Credit placement multipliers (positions 1-10).
 * Same tiered curve as KotH (1st highest, scaling down by placement).
 */
export const GRAND_MELEE_CREDIT_MULTIPLIER: Record<number, number> = {
  1: 1.0, 2: 0.8, 3: 0.65, 4: 0.55, 5: 0.45,
  6: 0.38, 7: 0.32, 8: 0.28, 9: 0.24, 10: 0.22,
};

/** Participation floor for positions 11-20 (same as KotH last-place multiplier) */
const PARTICIPATION_FLOOR = 0.2;

/**
 * Grand Melee credit base multiplier vs KotH.
 * Reflects the increased difficulty of competing against 19 opponents vs KotH's 5.
 */
export const GRAND_MELEE_BASE_MULTIPLIER = 2.5;

/** Tier-based credit base values — same as KotH (R3.5) */
const TIER_CREDIT_BASE: Record<string, number> = {
  bronze: 7500,
  silver: 15000,
  gold: 30000,
  platinum: 60000,
  diamond: 115000,
  champion: 225000,
};

/** Tier factor for fame/prestige scaling */
const TIER_FACTOR: Record<string, number> = {
  bronze: 1.0,
  silver: 1.5,
  gold: 2.0,
  platinum: 3.0,
  diamond: 4.5,
  champion: 7.0,
};

/** Base fame by placement (tier-scaled). 0 for positions 11+ */
const BASE_FAME: Record<number, number> = {
  1: 12, 2: 8, 3: 6, 4: 4, 5: 3,
  6: 2, 7: 2, 8: 2, 9: 1, 10: 1,
};

/** Base prestige for top 3 only (tier-scaled). 0 for positions 4+ */
const BASE_PRESTIGE: Record<number, number> = {
  1: 20, 2: 10, 3: 5,
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GrandMeleeRewardResult {
  credits: number;
  fame: number;
  prestige: number;
  lpDelta: number;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Calculate rewards for a Grand Melee placement.
 *
 * @param placement - 1-based placement (1 = winner, N = first eliminated)
 * @param tier - League tier (bronze through champion)
 * @param totalParticipants - Total robots in the match (for context, not used in formula)
 * @param winnerHPPercent - Winner's final HP percentage (for prestige bonus, only relevant for placement 1)
 * @returns Credits, fame, prestige, and LP delta
 */
export function calculateGrandMeleeRewards(
  placement: number,
  tier: string,
  totalParticipants: number,
  winnerHPPercent?: number,
): GrandMeleeRewardResult {
  const tierKey = tier.toLowerCase();
  const tierFactor = TIER_FACTOR[tierKey] ?? 1.0;
  const creditBase = TIER_CREDIT_BASE[tierKey] ?? TIER_CREDIT_BASE.bronze;

  // LP: F1 scale, 0 for 11+
  const lpDelta = placement <= GRAND_MELEE_LP_SCALE.length
    ? GRAND_MELEE_LP_SCALE[placement - 1]
    : 0;

  // Credits: tier base × grand melee multiplier × placement multiplier (floor 0.2)
  const creditMultiplier = GRAND_MELEE_CREDIT_MULTIPLIER[placement] ?? PARTICIPATION_FLOOR;
  const credits = Math.floor(creditBase * GRAND_MELEE_BASE_MULTIPLIER * creditMultiplier);

  // Fame: tier-scaled, 0 for 11+
  const fame = Math.floor((BASE_FAME[placement] ?? 0) * tierFactor);

  // Prestige: top 3 only, tier-scaled, +50% for winner with >50% HP (R3.4)
  let prestige = Math.floor((BASE_PRESTIGE[placement] ?? 0) * tierFactor);
  if (placement === 1 && winnerHPPercent !== undefined && winnerHPPercent > 50) {
    prestige = Math.floor(prestige * 1.5);
  }

  return { credits, fame, prestige, lpDelta };
}
