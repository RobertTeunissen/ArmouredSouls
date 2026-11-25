/**
 * The player Facilities overview (`GET /api/facilities`).
 */

/** One implemented facility with the stable's level and next-level figures. */
export interface FacilityOverviewEntry {
  type: string;
  name: string;
  description: string;
  maxLevel: number;
  /** Upgrade cost per level (index 0 = level 1). */
  costs: number[];
  /** Benefit text per level (index 0 = level 1). */
  benefits: string[];
  implemented: boolean;
  /** Prestige needed per level (index 0 = level 1); 0 means none. */
  prestigeRequirements?: number[];
  currentLevel: number;
  upgradeCost: number;
  canUpgrade: boolean;
  nextLevelPrestigeRequired: number;
  hasPrestige: boolean;
  canAfford: boolean;
  currentBenefit: string;
  nextBenefit: string;
  currentOperatingCost: number;
  nextOperatingCost: number;
}

export interface FacilitiesOverviewResponse {
  facilities: FacilityOverviewEntry[];
  userPrestige: number;
  userCurrency: number;
  robotCount: number;
  /** Drives the Training Facility discount and merchandising (Spec #46). */
  rosterCapacity: number;
}
