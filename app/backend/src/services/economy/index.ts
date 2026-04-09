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
  getSpending,
} from './spendingTracker';
export type {
  SpendingCategory,
} from './spendingTracker';

export {
  roiCalculatorService,
  ROICalculatorService,
} from './roiCalculatorService';
export type {
  FacilityROI,
  FacilityIncome,
  FacilityDiscount,
} from './roiCalculatorService';

export {
  facilityRecommendationService,
} from './facilityRecommendationService';
export type {
  FacilityRecommendation,
  RecommendationSummary,
} from './facilityRecommendationService';
