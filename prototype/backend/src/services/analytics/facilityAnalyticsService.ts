/**
 * Facility Analytics Service
 *
 * Aggregates facility ROI data across all facilities for a user.
 *
 * Requirements: 12.3, 5.5, 8.2
 */

import { roiCalculatorService } from '../economy/roiCalculatorService';

interface FacilityROI {
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

export interface AllFacilityROIResult {
  userId: number;
  facilities: FacilityROI[];
  totalInvestment: number;
  totalReturns: number;
  totalOperatingCosts: number;
  overallNetROI: number;
}

/**
 * Calculate ROI for all facilities owned by a user, with overall totals.
 */
export async function getAllFacilityROIs(userId: number): Promise<AllFacilityROIResult> {
  const facilities = await roiCalculatorService.calculateAllFacilityROIs(userId);

  const totalInvestment = facilities.reduce((sum, f) => sum + f.totalInvestment, 0);
  const totalReturns = facilities.reduce((sum, f) => sum + f.totalReturns, 0);
  const totalOperatingCosts = facilities.reduce((sum, f) => sum + f.totalOperatingCosts, 0);

  const overallNetProfit = totalReturns - totalOperatingCosts - totalInvestment;
  const overallNetROI = totalInvestment > 0 ? overallNetProfit / totalInvestment : 0;

  return {
    userId,
    facilities,
    totalInvestment,
    totalReturns,
    totalOperatingCosts,
    overallNetROI,
  };
}
