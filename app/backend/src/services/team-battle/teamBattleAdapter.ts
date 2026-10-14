/**
 * Team Battle League Adapter
 *
 * Implements `LeagueAdapter<any>` for the generic league engine using the
 * unified `createStandingsAdapter` factory. Handles promotion/demotion and
 * rebalancing for 2v2, 3v3, and tag team leagues. Initial placement (a team's
 * first standings row) is `services/standings/standingPlacement`.
 *
 * All modes share the same code path with the only differences being:
 *  - mode string ('league_2v2' | 'league_3v3' | 'tag_team')
 *  - maxPerInstance: 100 for every head-to-head mode
 *  - entityType: 'team'
 *  - useLocking: true (teams are created concurrently via API)
 *
 * Config is the canonical head-to-head rule object: 10% fixed zones, five-cycle
 * residency, minimum population 10, and an empty-destination cohort of three.
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
  LEAGUE_TIERS,
  MAX_TEAMS_PER_INSTANCE,
} from '../league/leagueInstanceService';
import { HEAD_TO_HEAD_LEAGUE_RULES } from '../league/league-rules';

// Re-export for consumers that need the helper
export { getMinLPForPromotion } from '../league/leaguePromotionThresholds';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Six-tier structure shared by every head-to-head league mode. */
export const TEAM_BATTLE_LEAGUE_TIERS = LEAGUE_TIERS;
export type TeamBattleLeagueTier = typeof TEAM_BATTLE_LEAGUE_TIERS[number];

export { MAX_TEAMS_PER_INSTANCE };

// ─── Configuration ───────────────────────────────────────────────────────────

export const TEAM_BATTLE_LEAGUE_CONFIG: LeagueEngineConfig = {
  ...HEAD_TO_HEAD_LEAGUE_RULES,
  logPrefix: 'TeamBattleRebalancing',
  entityLabel: 'team',
};

// ─── Adapters (all use unified createStandingsAdapter) ───────────────────────

/** Adapter for 2v2 team battle leagues */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const teamBattle2v2Adapter: LeagueAdapter<any> = createStandingsAdapter('league_2v2', {
  maxPerInstance: MAX_TEAMS_PER_INSTANCE,
  entityType: 'team_battle',
  useLocking: true,
});

/** Adapter for 3v3 team battle leagues */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const teamBattle3v3Adapter: LeagueAdapter<any> = createStandingsAdapter('league_3v3', {
  maxPerInstance: MAX_TEAMS_PER_INSTANCE,
  entityType: 'team_battle',
  useLocking: true,
});

/** Tag-team-scoped league adapter */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
 * Determine which teams occupy effective promotion positions in an instance.
 * The shared planner sizes the fixed zone from total population before applying
 * five-cycle residency and the source-tier LP threshold.
 */
export async function determineTeamBattlePromotions(
  instanceId: string,
  excludeTeamIds: Set<number> = new Set()
): Promise<TeamBattle[]> {
  return determinePromotionsForInstance(instanceId, TEAM_BATTLE_LEAGUE_CONFIG, teamBattleAdapter, excludeTeamIds);
}

/**
 * Determine which teams occupy effective demotion positions in an instance.
 * The shared planner applies residency inside the fixed bottom 10% zone without
 * backfilling from lower-ranked positions.
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
