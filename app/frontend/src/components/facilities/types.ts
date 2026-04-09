/**
 * Shared types for Facilities page components.
 *
 * Extracted from FacilitiesPage.tsx during component splitting (Spec 18).
 */

export type TabType = 'facilities' | 'investments' | 'advisor';

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

export interface FacilityROI {
  facilityType: string;
  currentLevel: number;
  totalInvestment: number;
  totalReturns: number;
  totalOperatingCosts: number;
  netROI: number;
  breakevenCycle: number | null;
  cyclesSincePurchase: number;
  isProfitable: boolean;
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
