/**
 * Team Battle League Adapter
 *
 * Implements `LeagueAdapter<any>` for the generic league engine using the
 * unified `createStandingsAdapter` factory. Handles promotion/demotion,
 * instance assignment, and rebalancing for 2v2, 3v3, and tag team leagues.
 *
 * All modes share the same code path with the only differences being:
 *  - mode string ('league_2v2' | 'league_3v3' | 'tag_team')
 *  - maxPerInstance: 50 (teams, vs 100 for robots in 1v1/koth)
 *  - entityType: 'team'
 *  - useLocking: true (teams are created concurrently via API)
 *
 * Config mirrors 1v1 league: 10% promote, 10% demote, 5 min cycles.
 * Min entities for rebalancing is 4 (smaller cohorts than 1v1).
 *
 * @module services/team-battle/teamBattleAdapter
 */

import { TeamBattle } from '../../../generated/prisma';
import {
  LeagueAdapter,
  LeagueEngineConfig,
  rebalanceAllTiers,
  determinePromotionsForInstance,
  determineDemotionsForInstance,
  promoteEntity,
  demoteEntity,
} from '../league/leagueEngine';
import { createStandingsAdapter } from '../league/leagueRebalancingService';
import {
  assignLeagueInstanceWithLock,
  MAX_TEAMS_PER_INSTANCE,
  LeagueTier,
} from '../league/leagueInstanceService';

// Re-export for consumers that need the helper
export { getMinLPForPromotion } from '../league/leaguePromotionThresholds';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Six-tier structure matching all league modes */
export const TEAM_BATTLE_LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;
export type TeamBattleLeagueTier = typeof TEAM_BATTLE_LEAGUE_TIERS[number];

export { MAX_TEAMS_PER_INSTANCE };

/** Starting tier for new teams */
export const STARTING_TIER: TeamBattleLeagueTier = 'bronze';

/** Starting LP for new teams */
export const STARTING_LP = 0;

// ─── Configuration ───────────────────────────────────────────────────────────

const PROMOTION_PERCENTAGE = 0.10;
const DEMOTION_PERCENTAGE = 0.10;
const MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING = 5;
const MIN_TEAMS_FOR_REBALANCING = 4;
const MIN_COHORT_FOR_NEW_TIER = 3;

export const TEAM_BATTLE_LEAGUE_CONFIG: LeagueEngineConfig = {
  promotionPercentage: PROMOTION_PERCENTAGE,
  demotionPercentage: DEMOTION_PERCENTAGE,
  minCyclesForRebalancing: MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING,
  minEntitiesForRebalancing: MIN_TEAMS_FOR_REBALANCING,
  minCohortForNewTier: MIN_COHORT_FOR_NEW_TIER,
  logPrefix: 'TeamBattleRebalancing',
  tiers: TEAM_BATTLE_LEAGUE_TIERS,
  entityLabel: 'team',
};

// ─── Instance Assignment (public, for team creation) ─────────────────────────

/**
 * Assign a team battle to an appropriate league instance.
 * Uses advisory locking to prevent race conditions during concurrent team creation.
 * Delegates to the unified leagueInstanceService.
 */
export async function assignTeamBattleLeagueInstance(tier: TeamBattleLeagueTier, teamSize: 2 | 3 = 2): Promise<string> {
  const mode = teamSize === 2 ? 'league_2v2' : 'league_3v3';
  return assignLeagueInstanceWithLock(tier as LeagueTier, { mode, maxPerInstance: MAX_TEAMS_PER_INSTANCE });
}

/**
 * Assign a tag team to an appropriate tag team league instance.
 * Uses advisory locking to prevent race conditions.
 * Delegates to the unified leagueInstanceService.
 */
export async function assignTagTeamLeagueInstanceOnTeamBattle(tier: TeamBattleLeagueTier): Promise<string> {
  return assignLeagueInstanceWithLock(tier as LeagueTier, { mode: 'tag_team', maxPerInstance: MAX_TEAMS_PER_INSTANCE });
}

// ─── Adapters (all use unified createStandingsAdapter) ───────────────────────

/** Adapter for 2v2 team battle leagues */
export const teamBattle2v2Adapter: LeagueAdapter<any> = createStandingsAdapter('league_2v2', {
  maxPerInstance: MAX_TEAMS_PER_INSTANCE,
  entityType: 'team_battle',
  useLocking: true,
});

/** Adapter for 3v3 team battle leagues */
export const teamBattle3v3Adapter: LeagueAdapter<any> = createStandingsAdapter('league_3v3', {
  maxPerInstance: MAX_TEAMS_PER_INSTANCE,
  entityType: 'team_battle',
  useLocking: true,
});

/** Tag-team-scoped league adapter */
export const tagTeamLeagueAdapter: LeagueAdapter<any> = createStandingsAdapter('tag_team', {
  maxPerInstance: MAX_TEAMS_PER_INSTANCE,
  entityType: 'tag_team',
  useLocking: true,
});

/**
 * Legacy adapter — aliases to teamBattle2v2Adapter.
 * @deprecated Use teamBattle2v2Adapter or teamBattle3v3Adapter instead.
 */
export const teamBattleAdapter: LeagueAdapter<TeamBattle> = teamBattle2v2Adapter;

// ─── Public API ──────────────────────────────────────────────────────────────

export interface TeamBattleRebalancingSummary {
  tier: TeamBattleLeagueTier;
  teamsInTier: number;
  promoted: number;
  demoted: number;
  eligibleTeams: number;
}

export interface FullTeamBattleRebalancingSummary {
  totalTeams: number;
  totalPromoted: number;
  totalDemoted: number;
  tierSummaries: TeamBattleRebalancingSummary[];
  errors: string[];
}

/**
 * Determine which teams should be promoted from a specific instance.
 * Requirement R8.2: Promote top 10% of eligible teams (≥5 cycles in tier AND per-tier LP threshold)
 */
export async function determineTeamBattlePromotions(
  instanceId: string,
  excludeTeamIds: Set<number> = new Set()
): Promise<TeamBattle[]> {
  return determinePromotionsForInstance(instanceId, TEAM_BATTLE_LEAGUE_CONFIG, teamBattleAdapter, excludeTeamIds);
}

/**
 * Determine which teams should be demoted from a specific instance.
 * Requirement R8.3: Demote bottom 10% of eligible teams (≥5 cycles in tier)
 */
export async function determineTeamBattleDemotions(
  instanceId: string,
  excludeTeamIds: Set<number> = new Set()
): Promise<TeamBattle[]> {
  return determineDemotionsForInstance(instanceId, TEAM_BATTLE_LEAGUE_CONFIG, teamBattleAdapter, excludeTeamIds);
}

/**
 * Promote a team to the next tier.
 * LP retention — league points are NOT reset to 0.
 */
export async function promoteTeamBattle(team: TeamBattle): Promise<void> {
  return promoteEntity(team, TEAM_BATTLE_LEAGUE_CONFIG, teamBattleAdapter);
}

/**
 * Demote a team to the previous tier.
 * LP retention — league points are NOT reset to 0.
 */
export async function demoteTeamBattle(team: TeamBattle): Promise<void> {
  return demoteEntity(team, TEAM_BATTLE_LEAGUE_CONFIG, teamBattleAdapter);
}

/**
 * Rebalance all team battle league tiers for a specific team size.
 * Called every cycle (daily cadence) after team battles are executed.
 * Requirements: R8.1–R8.8
 */
export async function rebalanceTeamBattleLeagues(teamSize: 2 | 3 = 2): Promise<FullTeamBattleRebalancingSummary> {
  const adapter = teamSize === 2 ? teamBattle2v2Adapter : teamBattle3v3Adapter;
  const result = await rebalanceAllTiers(TEAM_BATTLE_LEAGUE_CONFIG, adapter);

  return {
    totalTeams: result.totalEntities,
    totalPromoted: result.totalPromoted,
    totalDemoted: result.totalDemoted,
    tierSummaries: result.tierSummaries.map(s => ({
      tier: s.tier as TeamBattleLeagueTier,
      teamsInTier: s.entitiesInTier,
      promoted: s.promoted,
      demoted: s.demoted,
      eligibleTeams: s.eligibleEntities,
    })),
    errors: result.errors,
  };
}
