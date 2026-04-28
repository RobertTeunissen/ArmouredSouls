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
  validateTeam,
  createTeam,
  getTeamById,
  getTeamsByStable,
  disbandTeam,
  checkTeamReadiness,
  checkTeamSchedulingReadiness,
  calculateCombinedELO,
} from './tagTeamService';
export type {
  ValidationResult,
  TeamCreationResult,
  RobotReadinessStatus,
  TeamReadinessResult,
  TagTeamWithRobots,
} from './tagTeamService';

export {
  shouldRunTagTeamMatchmaking,
  getEligibleTeams,
  runTagTeamMatchmaking,
} from './tagTeamMatchmakingService';
export type {
  TagTeamMatchPair,
} from './tagTeamMatchmakingService';

export {
  getInstancesForTier,
  assignTagTeamLeagueInstance,
  createTagTeamWithInstanceAssignment,
  rebalanceTagTeamInstances,
  getTeamsInInstance,
  moveTeamToInstance,
  getStandingsForInstance,
  getStandingsForTier,
  TAG_TEAM_LEAGUE_TIERS,
} from './tagTeamLeagueInstanceService';
export type {
  TagTeamLeagueInstance,
} from './tagTeamLeagueInstanceService';

export {
  rebalanceTagTeamLeagues,
} from './tagTeamLeagueRebalancingService';
export type {
  TagTeamRebalancingSummary,
  FullTagTeamRebalancingSummary,
} from './tagTeamLeagueRebalancingService';
