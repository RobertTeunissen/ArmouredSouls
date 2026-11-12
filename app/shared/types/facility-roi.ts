/**
 * Wire contracts for the Facilities page's Investment Overview:
 * `GET /api/analytics/facility/:userId/roi/all-economic` and
 * `GET /api/analytics/facility/:userId/recommendations`.
 */

/** ROI of one owned economic facility over its ownership window. */
export interface UnifiedFacilityROI {
  facilityType: string;
  currentLevel: number;
  totalInvestment: number;
  totalReturns: number;
  totalOperatingCosts: number;
  netROI: number;
  paidOff: boolean;
  /** Cycles until paid off; null when already paid off. */
  projectedPayoffCycles: number | null;
  cyclesSincePurchase: number;
  dataSource: 'snapshot' | 'estimate';
}

/** Response of `/roi/all-economic`. */
export interface AllEconomicROIsResult {
  facilities: UnifiedFacilityROI[];
  totals: {
    totalInvestment: number;
    totalReturns: number;
    totalOperatingCosts: number;
    overallNetROI: number;
  };
}

export type FacilityRecommendationPriority = 'high' | 'medium' | 'low';

export interface FacilityRecommendation {
  facilityType: string;
  facilityName: string;
  currentLevel: number;
  recommendedLevel: number;
  upgradeCost: number;
  projectedROI: number;
  projectedPayoffCycles: number | null;
  reason: string;
  priority: FacilityRecommendationPriority;
}

/** Response of `/recommendations`. */
export interface RecommendationSummary {
  recommendations: FacilityRecommendation[];
  totalRecommendedInvestment: number;
  userCurrency: number;
  userPrestige: number;
  analysisWindow: {
    startCycle: number;
    endCycle: number;
    cycleCount: number;
  };
}
