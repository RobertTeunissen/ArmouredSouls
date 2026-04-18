/**
 * Per-tier LP thresholds for league promotion.
 * Shared between 1v1 and tag team league rebalancing services.
 *
 * Higher tiers require more LP to earn promotion:
 *   Bronze → Silver: 25 LP
 *   Silver → Gold:   50 LP
 *   Gold → Platinum: 75 LP
 *   Platinum → Diamond: 100 LP
 *   Diamond → Champion: 125 LP
 */

// Use a generic string-keyed record so both LeagueTier and TagTeamLeagueTier work
// without creating a circular dependency between instance services.
const PROMOTION_LP_THRESHOLDS: Readonly<Record<string, number>> = {
  bronze: 25,
  silver: 50,
  gold: 75,
  platinum: 100,
  diamond: 125,
  champion: Infinity, // Cannot promote from Champion
} as const;

/**
 * Get the minimum LP required for promotion from a given tier.
 * Returns 25 as a safe default for unknown tier values.
 */
export function getMinLPForPromotion(tier: string): number {
  return PROMOTION_LP_THRESHOLDS[tier] ?? 25;
}

export { PROMOTION_LP_THRESHOLDS };
