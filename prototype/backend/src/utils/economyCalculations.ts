/**
 * Economy System Calculations
 * Based on PRD_ECONOMY_SYSTEM.md specifications
 */

import { User, Facility, Robot } from '@prisma/client';
import { PrismaClient, Prisma } from '@prisma/client';

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
  breakdown: Array<{ facilityType: string; facilityName: string; cost: number }>;
}> {
  const facilities = await prisma.facility.findMany({
    where: { userId },
  });

  const robots = await prisma.robot.findMany({
    where: { userId },
  });

  const breakdown: Array<{ facilityType: string; facilityName: string; cost: number }> = [];
  let total = 0;

  // Calculate facility operating costs
  for (const facility of facilities) {
    const cost = calculateFacilityOperatingCost(facility.facilityType, facility.level);
    
    if (cost > 0) {
      breakdown.push({
        facilityType: facility.facilityType,
        facilityName: getFacilityName(facility.facilityType),
        cost,
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
    operatingCostsBreakdown: Array<{ facilityType: string; facilityName: string; cost: number }>;
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

  // Total revenue
  const totalRevenue = recentBattleWinnings + passiveIncome.total;

  // Total expenses (repairs would be calculated per battle)
  const totalExpenses = operatingCosts.total;

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
      repairs: 0, // Would be calculated from recent battles
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
