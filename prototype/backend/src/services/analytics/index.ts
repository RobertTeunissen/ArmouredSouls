// Analytics domain barrel file — re-exports the public API

export {
  checkBattleReadiness,
  checkSchedulingReadiness,
  runMatchmaking,
  runMatchmakingForTier,
} from './matchmakingService';
export type {
  BattleReadinessCheck,
  MatchPair,
} from './matchmakingService';

export {
  robotStatsViewService,
  RobotStatsViewService,
} from './robotStatsViewService';
export type {
  RobotStats,
  LeaderboardOptions,
} from './robotStatsViewService';

export {
  robotPerformanceService,
} from './robotPerformanceService';
export type {
  RobotPerformanceSummary,
  ELODataPoint,
  ELOProgressionData,
  MetricDataPoint,
  MetricProgressionData,
} from './robotPerformanceService';

export {
  recordEvents,
  getEvents,
  getSummary,
  clearEvents,
} from './onboardingAnalyticsService';
export type {
  OnboardingAnalyticsEvent,
  StoredEvent,
} from './onboardingAnalyticsService';
