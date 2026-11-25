import {
  TEAM_BATTLE_LEAGUE_CONFIG,
  tagTeamLeagueAdapter,
  toTeamRebalancingSummary,
  type FullTeamBattleRebalancingSummary,
  type TeamBattleLeagueTier,
} from '../team-battle/teamBattleAdapter';
import { LeagueEngineConfig, rebalanceAllTiers } from '../league/leagueEngine';

export type TagTeamLeagueTier = TeamBattleLeagueTier;

// Tag Team shares the exact gameplay policy with 2v2/3v3 but keeps distinct operational logging.
export const TAG_TEAM_LEAGUE_CONFIG: LeagueEngineConfig = {
  ...TEAM_BATTLE_LEAGUE_CONFIG,
  logPrefix: 'TagTeamRebalancing',
};

export type FullTagTeamRebalancingSummary = FullTeamBattleRebalancingSummary;

/**
 * Rebalance all tag team league tiers.
 * Called every cycle (daily cadence).
 */
export async function rebalanceTagTeamLeagues(): Promise<FullTagTeamRebalancingSummary> {
  return toTeamRebalancingSummary(await rebalanceAllTiers(TAG_TEAM_LEAGUE_CONFIG, tagTeamLeagueAdapter));
}
