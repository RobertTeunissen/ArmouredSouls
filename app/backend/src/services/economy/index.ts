// Economy domain barrel file — re-exports the public API

export {
  repairAllRobots,
  repairRobotsForEvent,
} from './repairService';
export type {
  RepairSummary,
} from './repairService';

export {
  resolveRobotIdsForEvent,
} from './repairScope';

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

// Spec #55 Domain_Service_Extraction
export {
  upgradeFacility,
  getFacilityUpgradeRequirement,
} from './facilityUpgradeService';
export type {
  FacilityUpgradeResult,
  FacilityUpgradeRequirement,
} from './facilityUpgradeService';
export { purchaseWeapon } from './weaponPurchaseService';
export type { WeaponPurchaseResult } from './weaponPurchaseService';
export { sellWeapon } from './weaponSaleService';
export type { WeaponSaleResult } from './weaponSaleService';
export { refineWeapon, refinementMagnitudeForStorage } from './weaponRefinementService';
export type { RefinementRequest, WeaponRefinementResult } from './weaponRefinementService';
export type { PurchaseServiceOptions, SpendingMonitorContext } from './purchaseOptions';
