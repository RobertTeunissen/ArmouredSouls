/**
 * Economy System Calculations
 * Based on PRD_ECONOMY_SYSTEM.md specifications
 *
 * Pure calculation functions live in `./economyFormulas.ts` (no Prisma dependency).
 * This file re-exports them for backward compatibility and contains the
 * Prisma-dependent service functions (financial reports, daily processing).
 */

import prisma from '../lib/prisma';
import logger from '../config/logger';
import { StandingsMode } from '../../generated/prisma';

// Re-export all pure calculation functions for backward compatibility
export {
  calculateFacilityOperatingCost,
  getPrestigeMultiplier,
  calculateBattleWinnings,
  getNextPrestigeTier,
  getMerchandisingBaseRate,
  calculateMerchandisingIncome,
  calculateFinancialHealth,
  getLeagueWinReward,
  getParticipationReward,
  getFacilityName,
} from './economyFormulas';

import {
  calculateFacilityOperatingCost,
  getPrestigeMultiplier,
  calculateMerchandisingIncome,
  calculateFinancialHealth,
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

  const merchandisingHub = await prisma.facility.findUnique({
    where: {
      userId_facilityType: {
        userId,
        facilityType: 'merchandising_hub',
      },
    },
  });

  const merchandisingHubLevel = merchandisingHub?.level || 0;

  // Calculate merchandising (available at level 1+)
  const merchandising = calculateMerchandisingIncome(merchandisingHubLevel, user.prestige);

  return {
    merchandising,
    total: merchandising,
  };
}

// ==================== FINANCIAL REPORT ====================

export interface FinancialReport {
  revenue: {
    battleWinnings: number;
    prestigeBonus: number;
    merchandising: number;
    streaming: number;
    streamingBattleCount: number;
    total: number;
  };
  expenses: {
    operatingCosts: number;
    operatingCostsBreakdown: Array<{ facilityType: string; facilityName: string; cost: number; level?: number }>;
    repairs: number;
    total: number;
  };
  netIncome: number;
  currentBalance: number;
  financialHealth: 'excellent' | 'good' | 'stable' | 'warning' | 'critical';
  profitMargin: number;
  daysToBankruptcy: number;
}

/**
 * Generate a daily financial report for a user
 * Note: This is a snapshot - battle winnings would need to be tracked separately
 */
export async function generateFinancialReport(
  userId: number,
  recentBattleWinnings: number = 0
): Promise<FinancialReport> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Calculate operating costs
  const operatingCosts = await calculateTotalDailyOperatingCosts(userId);

  // Calculate passive income
  const passiveIncome = await calculateDailyPassiveIncome(userId);

  // Calculate prestige bonus on battle winnings
  const prestigeBonus = Math.round(recentBattleWinnings * (getPrestigeMultiplier(user.prestige) - 1));

  // Calculate streaming revenue from battles in the last 7 days
  // (matches the same time window used for battle winnings in getDailyFinancialReport)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const userRobots = await prisma.robot.findMany({
    where: { userId },
    select: { id: true },
  });
  const userRobotIds = userRobots.map(r => r.id);

  const streamingResult = await prisma.battleParticipant.aggregate({
    where: {
      robotId: { in: userRobotIds },
      streamingRevenue: { gt: 0 },
      battle: { createdAt: { gte: sevenDaysAgo } },
    },
    _sum: { streamingRevenue: true },
    _count: { id: true },
  });

  const totalStreamingRevenue = streamingResult._sum.streamingRevenue ?? 0;
  const streamingBattleCount = streamingResult._count.id;

  // Calculate repair costs from robot's current repair costs
  const userRobotsWithRepairCost = await prisma.robot.findMany({
    where: { userId },
    select: {
      id: true,
      repairCost: true,
    },
  });

  // Sum all current repair costs
  const totalRepairCosts = userRobotsWithRepairCost.reduce((sum, robot) => {
    return sum + (robot.repairCost || 0);
  }, 0);

  // For daily average, we'll use current repair costs as an estimate
  const dailyRepairCost = totalRepairCosts;

  // Total revenue (including streaming)
  const totalRevenue = recentBattleWinnings + passiveIncome.total + totalStreamingRevenue;

  // Total expenses (operating costs + repairs)
  const totalExpenses = operatingCosts.total + dailyRepairCost;

  // Net income
  const netIncome = totalRevenue - totalExpenses;

  // Financial health
  const financialHealth = calculateFinancialHealth(user.currency, netIncome);

  // Profit margin
  const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

  // Days to bankruptcy (if income stops)
  const daysToBankruptcy = totalExpenses > 0 ? Math.floor(user.currency / totalExpenses) : 999;

  return {
    revenue: {
      battleWinnings: recentBattleWinnings,
      prestigeBonus,
      merchandising: passiveIncome.merchandising,
      streaming: totalStreamingRevenue,
      streamingBattleCount,
      total: totalRevenue,
    },
    expenses: {
      operatingCosts: operatingCosts.total,
      operatingCostsBreakdown: operatingCosts.breakdown,
      repairs: dailyRepairCost, // Daily average from last 7 days
      total: totalExpenses,
    },
    netIncome,
    currentBalance: user.currency,
    financialHealth,
    profitMargin: Math.round(profitMargin * 100) / 100,
    daysToBankruptcy,
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

/**
 * Process daily financial obligations for a user
 * - Deduct operating costs
 * - Track repair costs (repairs should be done separately)
 * - Check for bankruptcy
 */
export async function processDailyFinances(userId: number): Promise<DailyFinancialSummary> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  const startingBalance = user.currency;

  // Calculate operating costs
  const operatingCosts = await calculateTotalDailyOperatingCosts(userId);

  // Get robots needing repair
  const robots = await prisma.robot.findMany({
    where: {
      userId,
      currentHP: {
        lt: prisma.robot.fields.maxHP,
      },
    },
    select: {
      id: true,
      name: true,
      currentHP: true,
      maxHP: true,
      repairCost: true,
    },
  });

  // Calculate total repair costs (but don't actually repair - that's done separately)
  const totalRepairCost = robots.reduce((sum, robot) => {
    return sum + (robot.repairCost || 0);
  }, 0);

  // Total costs to deduct
  const totalCosts = operatingCosts.total;

  // Deduct operating costs atomically to prevent race conditions with concurrent user actions
  if (totalCosts > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        currency: { decrement: totalCosts },
      },
    });
  }

  // Re-read balance after deduction to get accurate ending balance
  const updatedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { currency: true },
  });
  const newBalance = updatedUser?.currency ?? 0;

  const isBankrupt = newBalance <= 0;
  const canAffordCosts = startingBalance >= totalCosts;

  return {
    userId: user.id,
    username: user.username,
    startingBalance,
    operatingCosts,
    repairCosts: {
      total: totalRepairCost,
      robotsRepaired: 0, // Not repaired in this function
    },
    totalCosts,
    endingBalance: newBalance,
    balanceChange: newBalance - startingBalance,
    isBankrupt,
    canAffordCosts,
  };
}

/**
 * Process daily finances for all users
 */
export async function processAllDailyFinances(): Promise<{
  usersProcessed: number;
  totalCostsDeducted: number;
  bankruptUsers: number;
  summaries: DailyFinancialSummary[];
}> {
  const users = await prisma.user.findMany({
    where: {
      role: {
        not: 'admin', // Don't process admin accounts
      },
    },
  });

  const summaries: DailyFinancialSummary[] = [];
  let totalCostsDeducted = 0;
  let bankruptUsers = 0;

  // Process users in parallel batches of 20 to avoid overwhelming the DB connection pool
  const BATCH_SIZE = 20;
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(user => processDailyFinances(user.id))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled') {
        summaries.push(result.value);
        totalCostsDeducted += result.value.totalCosts;
        if (result.value.isBankrupt) {
          bankruptUsers++;
        }
      } else {
        logger.error(`[Daily Finances] Error processing user ${batch[j].id}:`, result.reason);
      }
    }
  }

  return {
    usersProcessed: users.length,
    totalCostsDeducted,
    bankruptUsers,
    summaries,
  };
}

// ==================== PER-ROBOT FINANCIAL BREAKDOWN ====================

/**
 * Calculate per-robot financial performance
 * Includes revenue breakdown, cost allocation, and performance metrics
 */
export async function generatePerRobotFinancialReport(userId: number): Promise<{
  robots: Array<{
    id: number;
    name: string;
    currentLeague: string;
    elo: number;
    revenue: {
      battleWinnings: number;
      merchandising: number;
      streaming: number;
      total: number;
    };
    costs: {
      repairs: number;
      allocatedFacilities: number;
      total: number;
    };
    netIncome: number;
    roi: number;
    metrics: {
      winRate: number;
      avgEarningsPerBattle: number;
      totalBattles: number;
      fameContribution: number;
      repairCostPercentage: number;
    };
    battles: Array<{
      id: number;
      isWinner: boolean;
      reward: number;
      repairCost: number;
      battleType: string;
      createdAt: Date;
    }>;
  }>;
  summary: {
    totalRevenue: number;
    totalCosts: number;
    totalNetIncome: number;
    averageROI: number;
    mostProfitable: string | null;
    leastProfitable: string | null;
  };
}> {
  // Get user's robots
  const robots = await prisma.robot.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      elo: true,
      fame: true,
      totalBattles: true,
      wins: true,
      repairCost: true,
    },
  });

  if (robots.length === 0) {
    return {
      robots: [],
      summary: {
        totalRevenue: 0,
        totalCosts: 0,
        totalNetIncome: 0,
        averageROI: 0,
        mostProfitable: null,
        leastProfitable: null,
      },
    };
  }

  // Get total operating costs
  const operatingCosts = await calculateTotalDailyOperatingCosts(userId);
  const allocatedFacilityCostPerRobot = operatingCosts.total / robots.length;

  // Get league tiers from standings for the response
  const robotIds = robots.map(r => r.id);
  const leagueStandings = await prisma.standing.findMany({
    where: { entityType: 'robot', entityId: { in: robotIds }, mode: StandingsMode.league_1v1 },
    select: { entityId: true, tier: true },
  });
  const leagueMap = new Map(leagueStandings.map(s => [s.entityId, s.tier]));

  // Get Merchandising Hub level for passive income calculations
  const merchandisingHub = await prisma.facility.findUnique({
    where: {
      userId_facilityType: {
        userId,
        facilityType: 'merchandising_hub',
      },
    },
  });
  const merchandisingHubLevel = merchandisingHub?.level || 0;

  // Calculate totals for distribution calculations
  const totalFame = robots.reduce((sum, r) => sum + r.fame, 0);

  // Get user for prestige
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Calculate total passive income
  const totalMerchandising = calculateMerchandisingIncome(merchandisingHubLevel, user.prestige);
  // Note: Streaming revenue is now awarded per-battle via Streaming Studio facility

  // Process each robot
  const robotReports = await Promise.all(
    robots.map(async (robot) => {
      // Calculate battle winnings from recent battles
      const recentBattles = await prisma.battle.findMany({
        where: {
          participants: { some: { robotId: robot.id } },
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        select: {
          id: true,
          winnerId: true,
          winnerReward: true,
          loserReward: true,
          battleType: true,
          createdAt: true,
          participants: {
            where: { robotId: robot.id },
            select: { streamingRevenue: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Calculate battle winnings, streaming revenue, and build battle details array
      let battleWinnings = 0;
      let streamingRevenue = 0;
      const battleDetails = [];

      for (const battle of recentBattles) {
        const isWinner = battle.winnerId === robot.id;
        const reward = isWinner ? (battle.winnerReward || 0) : (battle.loserReward || 0);

        battleWinnings += reward;

        // Sum streaming revenue from battle participants
        const participantStreaming = battle.participants?.reduce(
          (sum, p) => sum + (p.streamingRevenue || 0), 0
        ) || 0;
        streamingRevenue += participantStreaming;

        battleDetails.push({
          id: battle.id,
          isWinner,
          reward,
          repairCost: 0, // Repair costs tracked on robot, not battle
          battleType: battle.battleType || 'league_1v1', // Default to league if not set
          createdAt: battle.createdAt,
        });
      }

      // Use robot's current repair cost
      const repairCosts = robot.repairCost || 0;

      // Calculate merchandising contribution (proportional to fame)
      const merchandising = totalFame > 0
        ? Math.round((robot.fame / totalFame) * totalMerchandising)
        : 0;

      // Note: Streaming revenue is now awarded per-battle via Streaming Studio facility
      // and is not included in passive income calculations

      // Calculate totals
      const totalRevenue = battleWinnings + merchandising + streamingRevenue;
      const totalCosts = repairCosts + allocatedFacilityCostPerRobot;
      const netIncome = totalRevenue - totalCosts;
      const roi = totalCosts > 0 ? (netIncome / totalCosts) * 100 : 0;

      // Calculate metrics
      const winRate = robot.totalBattles > 0
        ? (robot.wins / robot.totalBattles) * 100
        : 0;
      const avgEarningsPerBattle = robot.totalBattles > 0
        ? battleWinnings / robot.totalBattles
        : 0;
      const repairCostPercentage = totalRevenue > 0
        ? (repairCosts / totalRevenue) * 100
        : 0;

      return {
        id: robot.id,
        name: robot.name,
        currentLeague: leagueMap.get(robot.id) ?? 'bronze',
        elo: robot.elo,
        revenue: {
          battleWinnings,
          merchandising,
          streaming: streamingRevenue,
          total: totalRevenue,
        },
        costs: {
          repairs: repairCosts,
          allocatedFacilities: Math.round(allocatedFacilityCostPerRobot),
          total: Math.round(totalCosts),
        },
        netIncome: Math.round(netIncome),
        roi: Math.round(roi * 10) / 10,
        metrics: {
          winRate: Math.round(winRate * 10) / 10,
          avgEarningsPerBattle: Math.round(avgEarningsPerBattle),
          totalBattles: recentBattles.length,
          fameContribution: robot.fame,
          repairCostPercentage: Math.round(repairCostPercentage * 10) / 10,
        },
        battles: battleDetails,
      };
    })
  );

  // Sort by profitability (net income)
  robotReports.sort((a, b) => b.netIncome - a.netIncome);

  // Calculate summary
  const totalRevenue = robotReports.reduce((sum, r) => sum + r.revenue.total, 0);
  const totalCosts = robotReports.reduce((sum, r) => sum + r.costs.total, 0);
  const totalNetIncome = robotReports.reduce((sum, r) => sum + r.netIncome, 0);
  const averageROI = robotReports.length > 0
    ? robotReports.reduce((sum, r) => sum + r.roi, 0) / robotReports.length
    : 0;

  return {
    robots: robotReports,
    summary: {
      totalRevenue: Math.round(totalRevenue),
      totalCosts: Math.round(totalCosts),
      totalNetIncome: Math.round(totalNetIncome),
      averageROI: Math.round(averageROI * 10) / 10,
      mostProfitable: robotReports.length > 0 ? robotReports[0].name : null,
      leastProfitable: robotReports.length > 0 ? robotReports[robotReports.length - 1].name : null,
    },
  };
}
