/**
 * Economy System Calculations
 * Based on PRD_ECONOMY_SYSTEM.md specifications
 */

import { Prisma } from '../../generated/prisma';
import prisma from '../lib/prisma';
import logger from '../config/logger';

/**
 * Convert Prisma Decimal to JavaScript number for calculations
 */
function _toNumber(value: number | Prisma.Decimal): number {
  if (typeof value === 'number') return value;
  return value.toNumber();
}

// ==================== OPERATING COSTS ====================

/**
 * Calculate daily operating cost for a single facility
 * Formula varies by facility type as specified in PRD
 */
export function calculateFacilityOperatingCost(facilityType: string, level: number): number {
  if (level === 0) return 0; // Not purchased

  switch (facilityType) {
    case 'repair_bay':
      return 1000 + (level - 1) * 500;
    
    case 'training_facility':
      return 250 * level;
    
    case 'weapons_workshop':
      return 100 * level;
    
    case 'roster_expansion':
      // Special case: ₡500/day per robot slot beyond first
      // This is calculated separately based on actual roster size
      return 0;
    
    case 'storage_facility':
      return 500 + (level - 1) * 250;
    
    case 'booking_office':
      // Operating cost: level × 150 credits per day
      // The Booking Office gates event participation (more subscriptions = more battles = more rewards)
      return 150 * level;
    
    case 'combat_training_academy':
      return 250 * level;
    
    case 'defense_training_academy':
      return 250 * level;
    
    case 'mobility_training_academy':
      return 250 * level;
    
    case 'ai_training_academy':
      return 250 * level;
    
    case 'merchandising_hub':
      return 200 * level;
    
    case 'streaming_studio':
      // Operating cost: level × 100 credits per day
      return level * 100;
    
    case 'tuning_bay':
      // Operating cost: level × 300 credits per day
      return level * 300;
    
    default:
      return 0;
  }
}

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
 * Get prestige multiplier for battle winnings
 * Smooth formula: min(1.50, 1 + prestige / 50,000)
 * Cap: +50% at 25,000+ prestige
 */
export function getPrestigeMultiplier(prestige: number): number {
  return Math.min(1.50, 1 + prestige / 50000);
}

/**
 * Calculate battle winnings with prestige bonus
 */
export function calculateBattleWinnings(baseReward: number, prestige: number): number {
  const multiplier = getPrestigeMultiplier(prestige);
  return Math.round(baseReward * multiplier);
}

/**
 * Get prestige progress information for UI display.
 * Returns current bonus percentage and progress toward the cap.
 * Returns null if already at max (50% bonus at 25,000+ prestige).
 */
export function getNextPrestigeTier(currentPrestige: number): { threshold: number; bonus: string } | null {
  if (currentPrestige >= 25000) return null; // Cap reached
  return { threshold: 25000, bonus: '+50% (max)' };
}

/**
 * Get merchandising base rate by Merchandising Hub level
 */
export function getMerchandisingBaseRate(merchandisingHubLevel: number): number {
  const rates: { [key: number]: number } = {
    1: 5000,
    2: 10000,
    3: 15000,
    4: 20000,
    5: 25000,
    6: 30000,
    7: 35000,
    8: 40000,
    9: 45000,
    10: 50000,
  };
  return rates[merchandisingHubLevel] || 0;
}

/**
 * Calculate daily merchandising income
 * Formula: base_rate × (1 + prestige/10000)
 */
export function calculateMerchandisingIncome(merchandisingHubLevel: number, prestige: number): number {
  if (merchandisingHubLevel === 0) return 0;

  const baseRate = getMerchandisingBaseRate(merchandisingHubLevel);
  const prestigeMultiplier = 1 + (prestige / 10000);

  return Math.round(baseRate * prestigeMultiplier);
}

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
 * Calculate financial health status based on balance and net income
 */
export function calculateFinancialHealth(
  balance: number,
  netIncome: number
): 'excellent' | 'good' | 'stable' | 'warning' | 'critical' {
  // Critical: Very low balance regardless of income
  if (balance < 50000) return 'critical';
  
  // Warning: Low balance with any income situation
  if (balance < 100000) return 'warning';
  
  // For higher balances, consider income
  if (netIncome < 0) {
    // Negative income
    if (balance < 500000) return 'warning';
    return 'stable'; // Can sustain losses temporarily
  }
  
  // Positive income
  if (balance >= 1000000) return 'excellent';
  if (balance >= 500000) return 'good';
  return 'stable';
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

// ==================== HELPER FUNCTIONS ====================

/**
 * Get human-readable facility name from type
 */
function getFacilityName(type: string): string {
  const names: { [key: string]: string } = {
    repair_bay: 'Repair Bay',
    training_facility: 'Training Facility',
    weapons_workshop: 'Weapons Workshop',
    roster_expansion: 'Roster Expansion',
    storage_facility: 'Storage Facility',
    booking_office: 'Booking Office',
    combat_training_academy: 'Combat Training Academy',
    defense_training_academy: 'Defense Training Academy',
    mobility_training_academy: 'Mobility Training Academy',
    ai_training_academy: 'AI Training Academy',
    merchandising_hub: 'Merchandising Hub',
    streaming_studio: 'Streaming Studio',
    tuning_bay: 'Tuning Bay',
  };
  return names[type] || type;
}

/**
 * Get the base win reward for a league tier.
 * Participation reward is derived as 20% of this value.
 */
export function getLeagueWinReward(league: string): number {
  const rewards: Record<string, number> = {
    bronze: 7500,
    silver: 15000,
    gold: 30000,
    platinum: 60000,
    diamond: 115000,
    champion: 225000,
  };
  
  return rewards[league.toLowerCase()] || rewards.bronze;
}

/**
 * Calculate participation reward (20% of league win reward)
 */
export function getParticipationReward(league: string): number {
  return Math.round(getLeagueWinReward(league) * 0.2);
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
      NOT: {
        name: 'Bye Robot',
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
      currentLeague: true,
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
  const _totalBattles = robots.reduce((sum, r) => sum + r.totalBattles, 0);

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
          OR: [
            { robot1Id: robot.id },
            { robot2Id: robot.id },
          ],
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        select: {
          id: true,
          winnerId: true,
          winnerReward: true,
          loserReward: true,
          robot1Id: true,
          robot2Id: true,
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
        currentLeague: robot.currentLeague,
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
