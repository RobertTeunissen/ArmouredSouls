/**
 * Team Battle League Adapter
 *
 * Implements `LeagueAdapter<Standing>` for the generic league engine using the
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

import { StandingsMode, type Standing } from '../../../generated/prisma';
import {
  FullRebalancingResult,
  LeagueAdapter,
  LeagueEngineConfig,
  rebalanceAllTiers,
} from '../league/leagueEngine';
import { createStandingsAdapter } from '../league/leagueRebalancingService';
import {
  LEAGUE_TIERS,
  MAX_TEAMS_PER_INSTANCE,
} from '../league/leagueInstanceService';
import { HEAD_TO_HEAD_LEAGUE_RULES } from '../league/league-rules';

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
export const teamBattle2v2Adapter: LeagueAdapter<Standing> = createStandingsAdapter(StandingsMode.league_2v2, {
  maxPerInstance: MAX_TEAMS_PER_INSTANCE,
  entityType: 'team_battle',
  useLocking: true,
});

/** Adapter for 3v3 team battle leagues */
export const teamBattle3v3Adapter: LeagueAdapter<Standing> = createStandingsAdapter(StandingsMode.league_3v3, {
  maxPerInstance: MAX_TEAMS_PER_INSTANCE,
  entityType: 'team_battle',
  useLocking: true,
});

/** Tag-team-scoped league adapter */
export const tagTeamLeagueAdapter: LeagueAdapter<Standing> = createStandingsAdapter(StandingsMode.tag_team, {
  maxPerInstance: MAX_TEAMS_PER_INSTANCE,
  entityType: 'tag_team',
  useLocking: true,
});

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

/** Engine result in the team-mode summary shape (2v2, 3v3 and tag team). */
export function toTeamRebalancingSummary(result: FullRebalancingResult): FullTeamBattleRebalancingSummary {
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

/**
 * Rebalance all team battle league tiers for a specific team size.
 * Called every cycle (daily cadence) after team battles are executed.
 * Requirements: R8.1–R8.8
 */
export async function rebalanceTeamBattleLeagues(teamSize: 2 | 3 = 2): Promise<FullTeamBattleRebalancingSummary> {
  const adapter = teamSize === 2 ? teamBattle2v2Adapter : teamBattle3v3Adapter;
  return toTeamRebalancingSummary(await rebalanceAllTiers(TEAM_BATTLE_LEAGUE_CONFIG, adapter));
}
