// KotH domain barrel file — re-exports the public API

export {
  executeScheduledKothBattles,
  calculateKothRewards,
} from './kothBattleOrchestrator';
export type {
  KothBattleExecutionSummary,
} from './kothBattleOrchestrator';

export {
  getEligibleRobots,
  distributeIntoGroups,
  resolveStableConflicts,
  runKothMatchmaking,
} from './kothMatchmakingService';
export type {
  EligibleRobot,
  KothMatchGroup,
} from './kothMatchmakingService';
