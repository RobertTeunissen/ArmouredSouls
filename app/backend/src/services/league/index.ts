// League domain barrel file — re-exports the public API

export {
  processBattle,
  executeScheduledBattles,
  getCurrentCycleNumber,
} from './leagueBattleOrchestrator';
export type {
  BattleResult,
  BattleExecutionSummary,
} from './leagueBattleOrchestrator';

// League instance management
export {
  getInstancesForTier,
  getLeagueInstanceStats,
  assignLeagueInstance,
  assignLeagueInstanceWithLock,
  rebalanceInstances,
  getRobotsInInstance,
  moveRobotToInstance,
  LEAGUE_TIERS,
  MAX_ROBOTS_PER_INSTANCE,
  MAX_TEAMS_PER_INSTANCE,
  REBALANCE_THRESHOLD,
} from './leagueInstanceService';
export type {
  LeagueTier,
  LeagueInstance,
  LeagueInstanceStats,
  InstanceOptions,
} from './leagueInstanceService';

// League rebalancing (promotions/demotions)
export {
  determinePromotions,
  determineDemotions,
  promoteRobot,
  demoteRobot,
  rebalanceLeagues,
} from './leagueRebalancingService';
export type {
  RebalancingSummary,
  FullRebalancingSummary,
} from './leagueRebalancingService';
