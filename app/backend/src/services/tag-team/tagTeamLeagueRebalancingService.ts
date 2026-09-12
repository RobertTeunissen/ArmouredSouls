import { TeamBattle } from '../../../generated/prisma';

import {
  TEAM_BATTLE_LEAGUE_CONFIG,
  TEAM_BATTLE_LEAGUE_TIERS,
  TeamBattleLeagueTier,
  tagTeamLeagueAdapter,
} from '../team-battle/teamBattleAdapter';
import {
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

// Tag team uses the exact same immutable gameplay configuration as 2v2/3v3.
export const TAG_TEAM_LEAGUE_CONFIG = TEAM_BATTLE_LEAGUE_CONFIG;

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
 * Determine which teams occupy effective promotion positions in an instance.
 * The canonical planner fixes the top 10% from total population, then applies
 * five-cycle residency and the source-tier LP threshold without backfill.
 */
export async function determinePromotions(
  instanceId: string,
  excludeTeamIds: Set<number> = new Set()
): Promise<TeamBattle[]> {
  return determinePromotionsForInstance(instanceId, TAG_TEAM_LEAGUE_CONFIG, tagTeamLeagueAdapter, excludeTeamIds);
}

/**
 * Determine which teams occupy effective demotion positions in an instance.
 * The canonical planner applies residency inside the fixed bottom 10% zone
 * without backfilling from positions outside that zone.
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
