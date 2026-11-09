
import {
  TEAM_BATTLE_LEAGUE_CONFIG,
  TeamBattleLeagueTier,
  tagTeamLeagueAdapter,
} from '../team-battle/teamBattleAdapter';
import {
  LeagueEngineConfig,
  rebalanceAllTiers,
} from '../league/leagueEngine';

// Re-export for consumers that need the helper
export { getMinLPForPromotion } from '../league/leaguePromotionThresholds';

// Re-export for consumers that need the helper

export type TagTeamLeagueTier = TeamBattleLeagueTier;

// Tag Team shares the exact gameplay policy with 2v2/3v3 but keeps distinct operational logging.
export const TAG_TEAM_LEAGUE_CONFIG: LeagueEngineConfig = {
  ...TEAM_BATTLE_LEAGUE_CONFIG,
  logPrefix: 'TagTeamRebalancing',
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
