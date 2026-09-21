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

export interface LeagueRuleSet {
  promotionPercentage: number;
  demotionPercentage: number;
  minCyclesForRebalancing: number;
  minEntitiesForRebalancing: number;
  minCohortForNewTier: number;
  tiers: readonly string[];
  promotionMinLPOverride?: number;
}
