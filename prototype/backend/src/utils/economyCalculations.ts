/**
 * Economy System Calculations
 * Based on PRD_ECONOMY_SYSTEM.md specifications
 */

import { User, Facility, Robot } from '@prisma/client';
import { PrismaClient, Prisma } from '@prisma/client';
import { getFacilityConfig } from '../config/facilities';

const prisma = new PrismaClient();

/**
 * Convert Prisma Decimal to JavaScript number for calculations
 */
function toNumber(value: number | Prisma.Decimal): number {
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
      return 1500 + (level - 1) * 750;
    
    case 'weapons_workshop':
      return 1000 + (level - 1) * 500;
    
    case 'research_lab':
      return 2000 + (level - 1) * 1000;
    
    case 'medical_bay':
      return 2000 + (level - 1) * 1000;
    
    case 'roster_expansion':
      // Special case: ₡500/day per robot slot beyond first
      // This is calculated separately based on actual roster size
      return 0;
    
    case 'storage_facility':
      return 500 + (level - 1) * 250;
    
    case 'coaching_staff':
      // ₡3,000/day when coach is active
      // This requires checking if activeCoach is set
      return 0; // Handled separately
    
    case 'booking_office':
      return 0; // No operating cost (generates prestige)
    
    case 'combat_training_academy':
      return 800 + (level - 1) * 400;
    
    case 'defense_training_academy':
      return 800 + (level - 1) * 400;
    
    case 'mobility_training_academy':
      return 800 + (level - 1) * 400;
    
    case 'ai_training_academy':
      return 1000 + (level - 1) * 500;
    
    case 'income_generator':
      return 1000 + (level - 1) * 500;
    
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

  // Coaching Staff: ₡3,000/day if active coach is set
  const coachingStaff = facilities.find((f) => f.facilityType === 'coaching_staff');
  if (coachingStaff && coachingStaff.activeCoach) {
    breakdown.push({
      facilityType: 'coaching_staff',
      facilityName: 'Coaching Staff (Active)',
      cost: 3000,
    });
    total += 3000;
  }

  return { total, breakdown };
}

// ==================== REVENUE STREAMS ====================

/**
 * Get prestige multiplier for battle winnings
 * Tiers: 5K (5%), 10K (10%), 25K (15%), 50K (20%)
 */
export function getPrestigeMultiplier(prestige: number): number {
  if (prestige >= 50000) return 1.20;
  if (prestige >= 25000) return 1.15;
  if (prestige >= 10000) return 1.10;
  if (prestige >= 5000) return 1.05;
  return 1.0;
}

/**
 * Calculate battle winnings with prestige bonus
 */
export function calculateBattleWinnings(baseReward: number, prestige: number): number {
  const multiplier = getPrestigeMultiplier(prestige);
  return Math.round(baseReward * multiplier);
}

/**
 * Get next prestige tier information
 * Returns null if already at max tier (50,000+)
 */
export function getNextPrestigeTier(currentPrestige: number): { threshold: number; bonus: string } | null {
  if (currentPrestige < 5000) return { threshold: 5000, bonus: '+5%' };
  if (currentPrestige < 10000) return { threshold: 10000, bonus: '+10%' };
  if (currentPrestige < 25000) return { threshold: 25000, bonus: '+15%' };
  if (currentPrestige < 50000) return { threshold: 50000, bonus: '+20%' };
  return null; // Max tier reached
}

/**
 * Get merchandising base rate by Income Generator level
 */
export function getMerchandisingBaseRate(incomeGeneratorLevel: number): number {
  const rates: { [key: number]: number } = {
    1: 5000,
    2: 8000,
    3: 8000,
    4: 12000,
    5: 12000,
    6: 18000,
    7: 18000,
    8: 25000,
    9: 25000,
    10: 35000,
  };
  return rates[incomeGeneratorLevel] || 0;
}

/**
 * Calculate daily merchandising income
 * Formula: base_rate × (1 + prestige/10000)
 */
export function calculateMerchandisingIncome(incomeGeneratorLevel: number, prestige: number): number {
  if (incomeGeneratorLevel === 0) return 0;
  
  const baseRate = getMerchandisingBaseRate(incomeGeneratorLevel);
  const prestigeMultiplier = 1 + (prestige / 10000);
  
  return Math.round(baseRate * prestigeMultiplier);
}

/**
 * Get streaming base rate by Income Generator level
 */
export function getStreamingBaseRate(incomeGeneratorLevel: number): number {
  if (incomeGeneratorLevel < 3) return 0; // Unlocked at level 3
  
  const rates: { [key: number]: number } = {
    3: 3000,
    4: 3000,
    5: 6000,
    6: 6000,
    7: 10000,
    8: 10000,
    9: 15000,
    10: 22000,
  };
  return rates[incomeGeneratorLevel] || 0;
}

/**
 * Calculate daily streaming income
 * Formula: base_rate × (1 + total_battles/1000) × (1 + total_fame/5000)
 */
export function calculateStreamingIncome(
  incomeGeneratorLevel: number,
  totalBattles: number,
  totalFame: number
): number {
  if (incomeGeneratorLevel < 3) return 0; // Unlocked at level 3
  
  const baseRate = getStreamingBaseRate(incomeGeneratorLevel);
  const battleMultiplier = 1 + (totalBattles / 1000);
  const fameMultiplier = 1 + (totalFame / 5000);
  
  return Math.round(baseRate * battleMultiplier * fameMultiplier);
}

/**
 * Calculate total daily passive income from Income Generator
 */
export async function calculateDailyPassiveIncome(userId: number): Promise<{
  merchandising: number;
  streaming: number;
  total: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return { merchandising: 0, streaming: 0, total: 0 };
  }

  const incomeGenerator = await prisma.facility.findUnique({
    where: {
      userId_facilityType: {
        userId,
        facilityType: 'income_generator',
      },
    },
  });

  const incomeGeneratorLevel = incomeGenerator?.level || 0;

  // Calculate merchandising (available at level 1+)
  const merchandising = calculateMerchandisingIncome(incomeGeneratorLevel, user.prestige);

  // Calculate streaming (available at level 3+)
  // Need total battles and fame across all robots
  const robots = await prisma.robot.findMany({
    where: { userId },
    select: { totalBattles: true, fame: true },
  });

  const totalBattles = robots.reduce((sum, robot) => sum + robot.totalBattles, 0);
  const totalFame = robots.reduce((sum, robot) => sum + robot.fame, 0);

  const streaming = calculateStreamingIncome(incomeGeneratorLevel, totalBattles, totalFame);

  return {
    merchandising,
    streaming,
    total: merchandising + streaming,
  };
}

// ==================== REPAIR COSTS ====================

/**
 * Calculate repair cost with all discounts applied
 * Based on robotCalculations.ts but includes Medical Bay discount
 */
export function calculateRepairCostWithDiscounts(
  sumOfAllAttributes: number,
  damagePercent: number,
  hpPercent: number,
  repairBayLevel: number = 0,
  medicalBayLevel: number = 0
): number {
  const baseRepairCost = sumOfAllAttributes * 100;
  
  // Determine multiplier based on HP percentage
  let multiplier = 1.0;
  if (hpPercent === 0) {
    // Total destruction - apply Medical Bay reduction to 2.0x multiplier
    if (medicalBayLevel > 0) {
      const medicalReduction = medicalBayLevel * 0.1;
      multiplier = 2.0 * (1 - medicalReduction);
    } else {
      multiplier = 2.0;
    }
  } else if (hpPercent < 10) {
    // Heavily damaged
    multiplier = 1.5;
  }
  
  // Calculate raw cost
  const rawCost = baseRepairCost * (damagePercent / 100) * multiplier;
  
  // Apply Repair Bay discount (5% per level, max 50% at level 10)
  const repairBayDiscount = Math.min(repairBayLevel * 5, 50) / 100;
  const finalCost = rawCost * (1 - repairBayDiscount);
  
  return Math.round(finalCost);
}

// ==================== FINANCIAL REPORT ====================

export interface FinancialReport {
  revenue: {
    battleWinnings: number;
    prestigeBonus: number;
    merchandising: number;
    streaming: number;
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

  // Calculate repair costs from recent battles (last 7 days)
  const recentBattles = await prisma.battle.findMany({
    where: {
      userId,
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    },
    select: {
      robot1RepairCost: true,
      robot2RepairCost: true,
    },
  });

  // Sum all repair costs from battles
  const totalRepairCosts = recentBattles.reduce((sum, battle) => {
    return sum + (battle.robot1RepairCost || 0) + (battle.robot2RepairCost || 0);
  }, 0);

  // Calculate daily average repair cost
  const dailyRepairCost = recentBattles.length > 0 ? Math.round(totalRepairCosts / 7) : 0;

  // Total revenue
  const totalRevenue = recentBattleWinnings + passiveIncome.total;

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
      streaming: passiveIncome.streaming,
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
    research_lab: 'Research Lab',
    medical_bay: 'Medical Bay',
    roster_expansion: 'Roster Expansion',
    storage_facility: 'Storage Facility',
    coaching_staff: 'Coaching Staff',
    booking_office: 'Booking Office',
    combat_training_academy: 'Combat Training Academy',
    defense_training_academy: 'Defense Training Academy',
    mobility_training_academy: 'Mobility Training Academy',
    ai_training_academy: 'AI Training Academy',
    income_generator: 'Income Generator',
  };
  return names[type] || type;
}

/**
 * Get league base reward range (midpoint used for estimates)
 */
export function getLeagueBaseReward(league: string): { min: number; max: number; midpoint: number } {
  const rewards: { [key: string]: { min: number; max: number } } = {
    bronze: { min: 5000, max: 10000 },
    silver: { min: 10000, max: 20000 },
    gold: { min: 20000, max: 40000 },
    platinum: { min: 40000, max: 80000 },
    diamond: { min: 80000, max: 150000 },
    champion: { min: 150000, max: 300000 },
  };
  
  const reward = rewards[league.toLowerCase()] || rewards.bronze;
  return {
    ...reward,
    midpoint: Math.round((reward.min + reward.max) / 2),
  };
}

/**
 * Calculate participation reward (30% of league base)
 */
export function getParticipationReward(league: string): number {
  const baseReward = getLeagueBaseReward(league);
  return Math.round(baseReward.min * 0.3);
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

  // Deduct operating costs from user balance
  const canAffordCosts = user.currency >= totalCosts;
  const newBalance = canAffordCosts ? user.currency - totalCosts : 0;

  // Update user balance
  await prisma.user.update({
    where: { id: userId },
    data: {
      currency: newBalance,
    },
  });

  const isBankrupt = newBalance <= 0;

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

  for (const user of users) {
    try {
      const summary = await processDailyFinances(user.id);
      summaries.push(summary);
      totalCostsDeducted += summary.totalCosts;
      if (summary.isBankrupt) {
        bankruptUsers++;
      }
    } catch (error) {
      console.error(`[Daily Finances] Error processing user ${user.id}:`, error);
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

  // Get Income Generator level for passive income calculations
  const incomeGenerator = await prisma.facility.findUnique({
    where: {
      userId_facilityType: {
        userId,
        facilityType: 'income_generator',
      },
    },
  });
  const incomeGeneratorLevel = incomeGenerator?.level || 0;

  // Calculate totals for distribution calculations
  const totalFame = robots.reduce((sum, r) => sum + r.fame, 0);
  const totalBattles = robots.reduce((sum, r) => sum + r.totalBattles, 0);

  // Get user for prestige
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Calculate total passive income
  const totalMerchandising = calculateMerchandisingIncome(incomeGeneratorLevel, user.prestige);
  const totalStreaming = calculateStreamingIncome(incomeGeneratorLevel, totalBattles, totalFame);

  // Process each robot
  const robotReports = await Promise.all(
    robots.map(async (robot) => {
      // Calculate battle winnings from recent battles
      const recentBattles = await prisma.battle.findMany({
        where: {
          userId,
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
          robot1RepairCost: true,
          robot2RepairCost: true,
          battleType: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Calculate battle winnings and repair costs, and build battle details array
      let battleWinnings = 0;
      let repairCosts = 0;
      const battleDetails = [];

      for (const battle of recentBattles) {
        const isRobot1 = battle.robot1Id === robot.id;
        const isWinner = battle.winnerId === robot.id;
        const reward = isWinner ? (battle.winnerReward || 0) : (battle.loserReward || 0);
        const repairCost = isRobot1 
          ? (battle.robot1RepairCost || 0) 
          : (battle.robot2RepairCost || 0);

        battleWinnings += reward;
        repairCosts += repairCost;

        battleDetails.push({
          id: battle.id,
          isWinner,
          reward,
          repairCost,
          battleType: battle.battleType || 'league', // Default to league if not set
          createdAt: battle.createdAt,
        });
      }

      // Calculate merchandising contribution (proportional to fame)
      const merchandising = totalFame > 0
        ? Math.round((robot.fame / totalFame) * totalMerchandising)
        : 0;

      // Calculate streaming contribution (proportional to battles and fame)
      const streamingContribution = totalBattles > 0 && totalFame > 0
        ? ((robot.totalBattles / totalBattles) + (robot.fame / totalFame)) / 2
        : 0;
      const streaming = Math.round(streamingContribution * totalStreaming);

      // Calculate totals
      const totalRevenue = battleWinnings + merchandising + streaming;
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
          streaming,
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

// ==================== FACILITY ROI CALCULATIONS ====================

/**
 * Calculate total upgrade cost from current level to target level
 */
export function calculateTotalUpgradeCost(
  facilityType: string,
  fromLevel: number,
  toLevel: number
): number {
  const config = getFacilityConfig(facilityType);
  if (!config || toLevel > config.maxLevel || fromLevel >= toLevel) {
    return 0;
  }

  let totalCost = 0;
  for (let level = fromLevel; level < toLevel; level++) {
    totalCost += config.costs[level] || 0;
  }
  return totalCost;
}

/**
 * Calculate daily operating cost increase for facility upgrade
 */
export function calculateOperatingCostIncrease(
  facilityType: string,
  fromLevel: number,
  toLevel: number
): number {
  const costBefore = calculateFacilityOperatingCost(facilityType, fromLevel);
  const costAfter = calculateFacilityOperatingCost(facilityType, toLevel);
  return costAfter - costBefore;
}

/**
 * Calculate daily benefit increase for income-generating facilities
 * Returns 0 for non-income facilities
 */
export function calculateDailyBenefitIncrease(
  facilityType: string,
  fromLevel: number,
  toLevel: number,
  userPrestige: number,
  totalBattles: number,
  totalFame: number
): number {
  // Only Income Generator provides direct daily income benefit
  if (facilityType !== 'income_generator') {
    return 0; // Other facilities provide indirect benefits (discounts, caps, etc.)
  }

  // Calculate income at current level
  const incomeBefore = calculateMerchandisingIncome(fromLevel, userPrestige) +
    calculateStreamingIncome(fromLevel, totalBattles, totalFame);

  // Calculate income at target level
  const incomeAfter = calculateMerchandisingIncome(toLevel, userPrestige) +
    calculateStreamingIncome(toLevel, totalBattles, totalFame);

  return incomeAfter - incomeBefore;
}

/**
 * Calculate comprehensive ROI metrics for a facility upgrade
 */
export async function calculateFacilityROI(
  userId: number,
  facilityType: string,
  targetLevel: number
): Promise<{
  currentLevel: number;
  targetLevel: number;
  upgradeCost: number;
  dailyCostIncrease: number;
  dailyBenefitIncrease: number;
  netDailyChange: number;
  breakevenDays: number | null;
  net30Days: number;
  net90Days: number;
  net180Days: number;
  affordable: boolean;
  recommendation: string;
  recommendationType: 'excellent' | 'good' | 'neutral' | 'poor' | 'not_affordable';
}> {
  // Get user data
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Get current facility level
  const facility = await prisma.facility.findUnique({
    where: {
      userId_facilityType: {
        userId,
        facilityType,
      },
    },
  });

  const currentLevel = facility?.level || 0;

  // Validate target level
  const config = getFacilityConfig(facilityType);
  if (!config || targetLevel > config.maxLevel || targetLevel <= currentLevel) {
    throw new Error('Invalid target level');
  }

  // Calculate costs
  const upgradeCost = calculateTotalUpgradeCost(facilityType, currentLevel, targetLevel);
  const dailyCostIncrease = calculateOperatingCostIncrease(facilityType, currentLevel, targetLevel);

  // Calculate benefits (for income generators)
  const robots = await prisma.robot.findMany({
    where: { userId },
    select: { totalBattles: true, fame: true },
  });

  const totalBattles = robots.reduce((sum, r) => sum + r.totalBattles, 0);
  const totalFame = robots.reduce((sum, r) => sum + r.fame, 0);

  const dailyBenefitIncrease = calculateDailyBenefitIncrease(
    facilityType,
    currentLevel,
    targetLevel,
    user.prestige,
    totalBattles,
    totalFame
  );

  // Calculate net change
  const netDailyChange = dailyBenefitIncrease - dailyCostIncrease;

  // Calculate breakeven
  let breakevenDays: number | null = null;
  if (netDailyChange > 0) {
    breakevenDays = Math.ceil(upgradeCost / netDailyChange);
  }

  // Calculate net over time periods
  const net30Days = (netDailyChange * 30) - upgradeCost;
  const net90Days = (netDailyChange * 90) - upgradeCost;
  const net180Days = (netDailyChange * 180) - upgradeCost;

  // Check affordability
  const affordable = user.currency >= upgradeCost;

  // Generate recommendation
  let recommendation = '';
  let recommendationType: 'excellent' | 'good' | 'neutral' | 'poor' | 'not_affordable' = 'neutral';

  if (!affordable) {
    recommendation = `You need ₡${(upgradeCost - user.currency).toLocaleString()} more credits to afford this upgrade.`;
    recommendationType = 'not_affordable';
  } else if (facilityType === 'income_generator') {
    // Income generator - calculate ROI
    if (breakevenDays && breakevenDays <= 30) {
      recommendation = `Excellent investment! Pays for itself in ${breakevenDays} days with ₡${netDailyChange.toLocaleString()}/day net gain.`;
      recommendationType = 'excellent';
    } else if (breakevenDays && breakevenDays <= 90) {
      recommendation = `Good investment. Break-even in ${breakevenDays} days (~${Math.round(breakevenDays / 30)} months) with ₡${netDailyChange.toLocaleString()}/day net gain.`;
      recommendationType = 'good';
    } else if (breakevenDays) {
      recommendation = `Long-term investment. Break-even in ${breakevenDays} days (~${Math.round(breakevenDays / 30)} months). Consider if planning long-term.`;
      recommendationType = 'neutral';
    } else {
      recommendation = `This upgrade increases costs by ₡${Math.abs(netDailyChange).toLocaleString()}/day without offsetting income. Consider other facilities first.`;
      recommendationType = 'poor';
    }
  } else {
    // Non-income facilities - provide qualitative recommendation
    const facilityName = config.name;
    if (upgradeCost < user.currency * 0.1) {
      recommendation = `${facilityName} upgrade is affordable (${Math.round((upgradeCost / user.currency) * 100)}% of balance). ${config.benefits[targetLevel - 1] || 'Provides valuable benefits'}.`;
      recommendationType = 'good';
    } else if (upgradeCost < user.currency * 0.3) {
      recommendation = `${facilityName} upgrade costs ${Math.round((upgradeCost / user.currency) * 100)}% of your balance. ${config.benefits[targetLevel - 1] || 'Provides useful benefits'}.`;
      recommendationType = 'neutral';
    } else {
      recommendation = `${facilityName} upgrade costs ${Math.round((upgradeCost / user.currency) * 100)}% of your balance. Save more credits before upgrading.`;
      recommendationType = 'poor';
    }
  }

  return {
    currentLevel,
    targetLevel,
    upgradeCost: Math.round(upgradeCost),
    dailyCostIncrease: Math.round(dailyCostIncrease),
    dailyBenefitIncrease: Math.round(dailyBenefitIncrease),
    netDailyChange: Math.round(netDailyChange),
    breakevenDays,
    net30Days: Math.round(net30Days),
    net90Days: Math.round(net90Days),
    net180Days: Math.round(net180Days),
    affordable,
    recommendation,
    recommendationType,
  };
}
