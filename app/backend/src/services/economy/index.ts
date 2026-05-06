// Economy domain barrel file — re-exports the public API

export {
  repairAllRobots,
} from './repairService';
export type {
  RepairSummary,
} from './repairService';

export {
  calculateStreamingRevenue,
  awardStreamingRevenue,
  getStreamingStudioLevel,
} from './streamingRevenueService';
export type {
  StreamingRevenueCalculation,
} from './streamingRevenueService';

export {
  trackSpending,
} from './spendingTracker';
export type {
  SpendingCategory,
} from './spendingTracker';

export {
  unifiedFacilityROIService,
  UnifiedFacilityROIService,
} from './unifiedFacilityROIService';
export type {
  UnifiedFacilityROI,
  AllEconomicROIsResult,
} from './unifiedFacilityROIService';

export {
  facilityRecommendationService,
} from './facilityRecommendationService';
export type {
  FacilityRecommendation,
  RecommendationSummary,
} from './facilityRecommendationService';
