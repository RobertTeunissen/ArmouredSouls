// Tag-team domain barrel file — re-exports the public API

export {
  executeTagTeamBattle,
  executeScheduledTagTeamBattles,
  shouldTagOut,
  calculateTagTeamRewards,
  calculateTagTeamELOChanges,
  calculateTagTeamLeaguePoints,
  calculateTagTeamPrestige,
  calculateTagTeamFame,
} from './tagTeamBattleOrchestrator';

export {
  getEligibleTeams,
  runTagTeamMatchmaking,
} from './tagTeamMatchmakingService';
export type {
  TagTeamMatchPair,
} from './tagTeamMatchmakingService';

export {
  assignTagTeamLeagueInstanceOnTeamBattle as assignTagTeamLeagueInstance,
  rebalanceTagTeamLeagueInstances as rebalanceTagTeamInstances,
  TEAM_BATTLE_LEAGUE_TIERS as TAG_TEAM_LEAGUE_TIERS,
  MAX_TEAMS_PER_INSTANCE,
} from '../team-battle/teamBattleAdapter';
export type {
  TeamBattleLeagueTier as TagTeamLeagueTier,
} from '../team-battle/teamBattleAdapter';

export {
  rebalanceTagTeamLeagues,
} from './tagTeamLeagueRebalancingService';
export type {
  TagTeamRebalancingSummary,
  FullTagTeamRebalancingSummary,
} from './tagTeamLeagueRebalancingService';
