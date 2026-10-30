import { LEAGUE_TIERS } from './leagueInstanceService';

/**
 * Promotion and demotion policy shared by every head-to-head league mode.
 * Mode adapters may vary persistence details, but not these gameplay rules.
 */
export const HEAD_TO_HEAD_LEAGUE_RULES = {
  promotionPercentage: 0.10,
  demotionPercentage: 0.10,
  minCyclesForRebalancing: 5,
  minEntitiesForRebalancing: 10,
  minCohortForNewTier: 3,
  tiers: LEAGUE_TIERS,
} as const;

/**
 * Policy for the placement modes (King of the Hill, Grand Melee). Ranking is by
 * position points, so there is no LP gate, and residency is 10 cycles because
 * placement points accumulate faster than head-to-head LP.
 */
export const PLACEMENT_LEAGUE_RULES = {
  ...HEAD_TO_HEAD_LEAGUE_RULES,
  minCyclesForRebalancing: 10,
  promotionMinLPOverride: 0,
} as const;

export interface LeagueRuleSet {
  promotionPercentage: number;
  demotionPercentage: number;
  minCyclesForRebalancing: number;
  minEntitiesForRebalancing: number;
  minCohortForNewTier: number;
  tiers: readonly string[];
  promotionMinLPOverride?: number;
}

/** The standings modes that have tiers and a nightly rebalance. */
export const TIERED_LEAGUE_MODES = [
  'league_1v1',
  'league_2v2',
  'league_3v3',
  'tag_team',
  'koth',
  'grand_melee',
] as const;

export type TieredLeagueMode = typeof TIERED_LEAGUE_MODES[number];

/** Whether a mode ranks by placement points (no LP gate) rather than head-to-head LP. */
export function isPlacementLeagueMode(mode: string): boolean {
  return mode === 'koth' || mode === 'grand_melee';
}

/** The rule set the rebalancer applies to a standings mode. */
export function getLeagueRulesForMode(mode: string): LeagueRuleSet {
  return isPlacementLeagueMode(mode) ? PLACEMENT_LEAGUE_RULES : HEAD_TO_HEAD_LEAGUE_RULES;
}
