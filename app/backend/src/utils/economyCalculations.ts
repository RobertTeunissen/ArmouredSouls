/**
 * Economy System Calculations
 * Based on PRD_ECONOMY_SYSTEM.md specifications
 *
 * Pure calculation functions live in `./economyFormulas.ts` (no Prisma dependency).
 * This file re-exports them for backward compatibility and contains the
 * Prisma-dependent daily operating cost and passive income reads. Settlement itself
 * is `services/financial/settlementService.ts`.
 */

import prisma from '../lib/prisma';

// Re-export all pure calculation functions for backward compatibility
export {
  calculateFacilityOperatingCost,
  getMerchandisingBaseRate,
  calculateMerchandisingIncome,
  getRosterCapacity,
  getLeagueWinReward,
  getParticipationReward,
  PARTICIPATION_REWARD_FRACTION,
  getFacilityName,
} from './economyFormulas';

import {
  calculateFacilityOperatingCost,
  calculateMerchandisingIncome,
  getRosterCapacity,
  getFacilityName,
} from './economyFormulas';

/**
 * Calculate total daily operating costs for a user
 */
export async function calculateTotalDailyOperatingCosts(userId: number): Promise<{
  total: number;
  breakdown: Array<{ facilityType: string; facilityName: string; cost: number; level?: number }>;
}> {
  const facilities = await prisma.facility.findMany({
    where: { userId },
  });

  const robots = await prisma.robot.findMany({
    where: { userId },
  });

  const breakdown: Array<{ facilityType: string; facilityName: string; cost: number; level?: number }> = [];
  let total = 0;

  // Calculate facility operating costs
  for (const facility of facilities) {
    const cost = calculateFacilityOperatingCost(facility.facilityType, facility.level);
    
    if (cost > 0) {
      breakdown.push({
        facilityType: facility.facilityType,
        facilityName: getFacilityName(facility.facilityType),
        cost,
        level: facility.level,
      });
      total += cost;
    }
  }

  // Roster Expansion: ₡500/day per robot beyond first
  const rosterCount = robots.length;
  if (rosterCount > 1) {
    const rosterCost = (rosterCount - 1) * 500;
    breakdown.push({
      facilityType: 'roster_expansion',
      facilityName: 'Roster Expansion',
      cost: rosterCost,
    });
    total += rosterCost;
  }

  return { total, breakdown };
}

// ==================== REVENUE STREAMS ====================

/**
 * Calculate total daily passive income from Merchandising Hub
 * Note: Streaming revenue is now awarded per-battle via Streaming Studio facility
 */
export async function calculateDailyPassiveIncome(userId: number): Promise<{
  merchandising: number;
  total: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return { merchandising: 0, total: 0 };
  }

  // Load both facilities in one query — merchandising level for the base rate,
  // roster_expansion level for Roster_Capacity (Spec #46 R2)
  const facilities = await prisma.facility.findMany({
    where: { userId, facilityType: { in: ['merchandising_hub', 'roster_expansion'] } },
    select: { facilityType: true, level: true },
  });

  const merchandisingHubLevel = facilities.find(f => f.facilityType === 'merchandising_hub')?.level ?? 0;
  const rosterCapacity = getRosterCapacity(
    facilities.find(f => f.facilityType === 'roster_expansion')?.level ?? 0,
  );

  // Calculate merchandising (available at level 1+)
  const merchandising = calculateMerchandisingIncome(merchandisingHubLevel, user.prestige, rosterCapacity);

  return {
    merchandising,
    total: merchandising,
  };
}

// ==================== DAILY FINANCIAL PROCESSING ====================

export interface DailyFinancialSummary {
  userId: number;
  username: string;
  startingBalance: number;
  operatingCosts: {
    total: number;
    breakdown: Array<{ facilityType: string; facilityName: string; cost: number }>;
  };
  repairCosts: {
    total: number;
    robotsRepaired: number;
  };
  totalCosts: number;
  endingBalance: number;
  balanceChange: number;
  isBankrupt: boolean;
  canAffordCosts: boolean;
}
