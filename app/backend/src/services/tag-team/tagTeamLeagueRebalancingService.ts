import { TeamBattle } from '../../../generated/prisma';

import {
  TEAM_BATTLE_LEAGUE_TIERS,
  TeamBattleLeagueTier,
  tagTeamLeagueAdapter,
} from '../team-battle/teamBattleAdapter';
import {
  LeagueEngineConfig,
  rebalanceAllTiers,
  determinePromotionsForInstance,
  determineDemotionsForInstance,
  promoteEntity,
  demoteEntity,
} from '../league/leagueEngine';

// Re-export for consumers that need the helper
export { getMinLPForPromotion } from '../league/leaguePromotionThresholds';

// Re-export tiers with tag-team-specific names for backward compatibility
export const TAG_TEAM_LEAGUE_TIERS = TEAM_BATTLE_LEAGUE_TIERS;
export type TagTeamLeagueTier = TeamBattleLeagueTier;

// ─── Configuration ───────────────────────────────────────────────────────────

const PROMOTION_PERCENTAGE = 0.10;
const DEMOTION_PERCENTAGE = 0.10;
const MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING = 5;
const MIN_TEAMS_FOR_REBALANCING = 10;
const MIN_COHORT_FOR_NEW_TIER = 3;

const TAG_TEAM_LEAGUE_CONFIG: LeagueEngineConfig = {
  promotionPercentage: PROMOTION_PERCENTAGE,
  demotionPercentage: DEMOTION_PERCENTAGE,
  minCyclesForRebalancing: MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING,
  minEntitiesForRebalancing: MIN_TEAMS_FOR_REBALANCING,
  minCohortForNewTier: MIN_COHORT_FOR_NEW_TIER,
  logPrefix: 'TagTeamRebalancing',
  tiers: TAG_TEAM_LEAGUE_TIERS,
  entityLabel: 'team',
};

// ─── Public API (unchanged signatures) ──────────────────────────────────────

export interface TagTeamRebalancingSummary {
  tier: TagTeamLeagueTier;
  teamsInTier: number;
  promoted: number;
  demoted: number;
  eligibleTeams: number;
}

export interface FullTagTeamRebalancingSummary {
  totalTeams: number;
  totalPromoted: number;
  totalDemoted: number;
  tierSummaries: TagTeamRebalancingSummary[];
  errors: string[];
}

/**
 * Determine which teams should be promoted from a SPECIFIC INSTANCE
 * Requirement 6.3: Promote top 10% of eligible teams (≥5 cycles in tier AND per-tier LP threshold)
 */
export async function determinePromotions(
  instanceId: string,
  excludeTeamIds: Set<number> = new Set()
): Promise<TeamBattle[]> {
  return determinePromotionsForInstance(instanceId, TAG_TEAM_LEAGUE_CONFIG, tagTeamLeagueAdapter, excludeTeamIds);
}

/**
 * Determine which teams should be demoted from a SPECIFIC INSTANCE
 * Requirement 6.4: Demote bottom 10% of eligible teams (≥5 cycles in tier)
 */
export async function determineDemotions(
  instanceId: string,
  excludeTeamIds: Set<number> = new Set()
): Promise<TeamBattle[]> {
  return determineDemotionsForInstance(instanceId, TAG_TEAM_LEAGUE_CONFIG, tagTeamLeagueAdapter, excludeTeamIds);
}

/**
 * Promote a team to the next tier
 * LP retention - league points are NOT reset to 0
 */
export async function promoteTeam(team: TeamBattle): Promise<void> {
  return promoteEntity(team, TAG_TEAM_LEAGUE_CONFIG, tagTeamLeagueAdapter);
}

/**
 * Demote a team to the previous tier
 * LP retention - league points are NOT reset to 0
 */
export async function demoteTeam(team: TeamBattle): Promise<void> {
  return demoteEntity(team, TAG_TEAM_LEAGUE_CONFIG, tagTeamLeagueAdapter);
}

/**
 * Rebalance all tag team league tiers
 * This is called every cycle (daily cadence)
 */
export async function rebalanceTagTeamLeagues(): Promise<FullTagTeamRebalancingSummary> {
  const result = await rebalanceAllTiers(TAG_TEAM_LEAGUE_CONFIG, tagTeamLeagueAdapter);

  // Map engine result to the existing public interface
  return {
    totalTeams: result.totalEntities,
    totalPromoted: result.totalPromoted,
    totalDemoted: result.totalDemoted,
    tierSummaries: result.tierSummaries.map(s => ({
      tier: s.tier as TagTeamLeagueTier,
      teamsInTier: s.entitiesInTier,
      promoted: s.promoted,
      demoted: s.demoted,
      eligibleTeams: s.eligibleEntities,
    })),
    errors: result.errors,
  };
}
