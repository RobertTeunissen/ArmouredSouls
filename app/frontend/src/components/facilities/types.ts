/**
 * Shared types for Facilities page components.
 *
 * Extracted from FacilitiesPage.tsx during component splitting (Spec 18).
 * Updated in Spec 30 to use UnifiedFacilityROI and consolidated tabs.
 */

export type TabType = 'facilities' | 'investment-overview';

export interface Facility {
  type: string;
  name: string;
  description: string;
  maxLevel: number;
  costs: number[];
  benefits: string[];
  currentLevel: number;
  upgradeCost: number;
  canUpgrade: boolean;
  implemented: boolean;
  currentBenefit?: string;
  nextBenefit?: string;
  nextLevelPrestigeRequired?: number;
  hasPrestige?: boolean;
  canAfford?: boolean;
  currentOperatingCost?: number;
  nextOperatingCost?: number;
}

export interface UnifiedFacilityROI {
  facilityType: string;
  currentLevel: number;
  totalInvestment: number;
  totalReturns: number;
  totalOperatingCosts: number;
  netROI: number;
  paidOff: boolean;
  projectedPayoffCycles: number | null;
  cyclesSincePurchase: number;
  dataSource: 'snapshot' | 'estimate';
}

export interface FacilityRecommendation {
  facilityType: string;
  facilityName: string;
  currentLevel: number;
  recommendedLevel: number;
  upgradeCost: number;
  projectedROI: number;
  projectedPayoffCycles: number | null;
  reason: string;
  priority: string;
}

export interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  facilityTypes: string[];
}
