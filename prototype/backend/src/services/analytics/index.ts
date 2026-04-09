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

export { getCurrentCycle } from './cycleAnalyticsService';
export type { CurrentCycleInfo } from './cycleAnalyticsService';

export { getStableSummary } from './stableAnalyticsService';
export type { StableSummary } from './stableAnalyticsService';

export { getLeaderboardWithTotal } from './leaderboardAnalyticsService';
export type { LeaderboardResult } from './leaderboardAnalyticsService';

export { getAllFacilityROIs } from './facilityAnalyticsService';
export type { AllFacilityROIResult } from './facilityAnalyticsService';

export { getKothPerformance } from './kothAnalyticsService';
export type { KothPerformance } from './kothAnalyticsService';

export { calculateEloMovingAverage, calculateTrendLine } from './trendHelpers';
export type { TrendLine } from './trendHelpers';
