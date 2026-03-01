import { PrismaClient } from '@prisma/client';
import { getFacilityConfig, FACILITY_TYPES } from '../config/facilities';
import { roiCalculatorService, FacilityROI } from './roiCalculatorService';

const prisma = new PrismaClient();

export interface FacilityRecommendation {
  facilityType: string;
  facilityName: string;
  currentLevel: number;
  recommendedLevel: number;
  upgradeCost: number;
  projectedROI: number;
  projectedPayoffCycles: number | null;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

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

export class FacilityRecommendationService {
  /**
   * Generate facility recommendations for a user based on last N cycles
   */
  async generateRecommendations(
    userId: number,
    lastNCycles: number = 10
  ): Promise<RecommendationSummary> {
    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Get current cycle number
    const currentCycleMetadata = await prisma.cycleMetadata.findUnique({
      where: { id: 1 },
    });
    const currentCycle = currentCycleMetadata?.totalCycles || 0;
    const startCycle = Math.max(1, currentCycle - lastNCycles + 1);

    // Get user's current facilities
    const userFacilities = await prisma.facility.findMany({
      where: { userId },
    });

    const facilityMap = new Map(
      userFacilities.map((f) => [f.facilityType, f.level])
    );

    // Calculate ROI for existing facilities
    const existingROIs = await roiCalculatorService.calculateAllFacilityROIs(userId);

    // Analyze user's activity in the last N cycles
    const activityMetrics = await this.analyzeUserActivity(
      userId,
      startCycle,
      currentCycle
    );

    // Generate recommendations
    const recommendations: FacilityRecommendation[] = [];

    for (const facilityConfig of FACILITY_TYPES) {
      const currentLevel = facilityMap.get(facilityConfig.type) || 0;

      // Skip if already at max level
      if (currentLevel >= facilityConfig.maxLevel) {
        continue;
      }

      // Check if user meets prestige requirements for next level
      const nextLevel = currentLevel + 1;
      const prestigeRequired =
        facilityConfig.prestigeRequirements?.[nextLevel - 1] || 0;
      if (user.prestige < prestigeRequired) {
        continue; // User doesn't have enough prestige
      }

      // Calculate projected ROI for this facility
      const recommendation = await this.evaluateFacility(
        facilityConfig.type,
        currentLevel,
        nextLevel,
        activityMetrics,
        existingROIs,
        user
      );

      // Add recommendation if it exists (evaluateFacility already filters appropriately)
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    // Sort by projected ROI (highest first)
    recommendations.sort((a, b) => b.projectedROI - a.projectedROI);

    // Calculate total recommended investment
    const totalRecommendedInvestment = recommendations.reduce(
      (sum, rec) => sum + rec.upgradeCost,
      0
    );

    return {
      recommendations,
      totalRecommendedInvestment,
      userCurrency: user.currency,
      userPrestige: user.prestige,
      analysisWindow: {
        startCycle,
        endCycle: currentCycle,
        cycleCount: lastNCycles,
      },
    };
  }

  /**
   * Analyze user activity metrics over the last N cycles
   */
  private async analyzeUserActivity(
    userId: number,
    startCycle: number,
    endCycle: number
  ): Promise<ActivityMetrics> {
    // Get repair costs from cycle snapshots (stableMetrics JSON)
    const cycleSnapshots = await prisma.cycleSnapshot.findMany({
      where: {
        cycleNumber: { gte: startCycle, lte: endCycle },
      },
      select: {
        cycleNumber: true,
        stableMetrics: true,
      },
    });

    let totalRepairCost = 0;
    let totalUpgradeCost = 0;
    let totalWeaponCost = 0;
    let totalBattles = 0;

    // Extract user-specific data from stableMetrics JSON
    for (const snapshot of cycleSnapshots) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stableMetrics = snapshot.stableMetrics as any;
      if (Array.isArray(stableMetrics)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userMetrics = stableMetrics.find((m: any) => m.userId === userId);
        if (userMetrics) {
          totalRepairCost += userMetrics.totalRepairCosts || 0;
          totalBattles += userMetrics.battlesParticipated || 0;
        }
      }
    }

    const cycleCount = endCycle - startCycle + 1;
    const avgRepairCostPerCycle = totalRepairCost / cycleCount;
    const avgBattlesPerCycle = totalBattles / cycleCount;

    // Get attribute upgrade costs from audit log (if available)
    const upgradeEvents = await prisma.auditLog.findMany({
      where: {
        userId,
        eventType: 'attribute_upgrade',
        cycleNumber: { gte: startCycle, lte: endCycle },
      },
    });

    totalUpgradeCost = upgradeEvents.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sum, e) => sum + ((e.payload as any).cost || 0),
      0
    );
    const avgUpgradeCostPerCycle = totalUpgradeCost / cycleCount;

    // Get weapon purchase costs from audit log (if available)
    const weaponEvents = await prisma.auditLog.findMany({
      where: {
        userId,
        eventType: 'weapon_purchase',
        cycleNumber: { gte: startCycle, lte: endCycle },
      },
    });

    totalWeaponCost = weaponEvents.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sum, e) => sum + ((e.payload as any).cost || 0),
      0
    );
    const avgWeaponCostPerCycle = totalWeaponCost / cycleCount;

    // Get robot count
    const robots = await prisma.robot.findMany({
      where: { userId, NOT: { name: 'Bye Robot' } },
    });

    return {
      avgRepairCostPerCycle,
      avgUpgradeCostPerCycle,
      avgWeaponCostPerCycle,
      avgBattlesPerCycle,
      totalRepairCost,
      totalUpgradeCost,
      totalWeaponCost,
      totalBattles,
      robotCount: robots.length,
    };
  }

  /**
   * Evaluate a specific facility and generate recommendation
   */
  private async evaluateFacility(
    facilityType: string,
    currentLevel: number,
    nextLevel: number,
    activityMetrics: ActivityMetrics,
    existingROIs: FacilityROI[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: any
  ): Promise<FacilityRecommendation | null> {
    const config = getFacilityConfig(facilityType);
    if (!config) {
      return null;
    }

    const upgradeCost = config.costs[nextLevel - 1];

    // Calculate projected ROI based on facility type
    let projectedROI = 0;
    let projectedPayoffCycles: number | null = null;
    let reason = '';
    let priority: 'high' | 'medium' | 'low' = 'low';

    if (facilityType === 'merchandising_hub') {
      // Merchandising Hub provides passive income
      const baseIncome = this.getIncomeGeneratorBaseIncome(nextLevel);
      const projectedIncomePerCycle = baseIncome * 1.5; // Estimate with scaling
      projectedPayoffCycles = Math.ceil(upgradeCost / projectedIncomePerCycle);
      projectedROI = (projectedIncomePerCycle * 30 - upgradeCost) / upgradeCost; // 30 cycle projection

      reason = `Generates ₡${projectedIncomePerCycle.toFixed(0)}/cycle passive income`;
      priority = projectedPayoffCycles <= 10 ? 'high' : projectedPayoffCycles <= 20 ? 'medium' : 'low';
    } else if (facilityType === 'repair_bay') {
      // Repair bay reduces repair costs
      // NEW FORMULA: discount = repairBayLevel × (5 + activeRobotCount), capped at 90%
      const currentDiscount = this.getRepairBayDiscount(currentLevel, activityMetrics.robotCount);
      const nextDiscount = this.getRepairBayDiscount(nextLevel, activityMetrics.robotCount);
      const additionalDiscount = nextDiscount - currentDiscount;
      
      // If no repair history, estimate based on robot attributes
      let estimatedRepairCostPerCycle = activityMetrics.avgRepairCostPerCycle;
      
      if (estimatedRepairCostPerCycle === 0 && activityMetrics.robotCount > 0) {
        // Estimate: assume average robot has ~100 total attributes, takes 50% damage per cycle
        // Base repair = 100 * 100 = 10,000 per robot
        // Damage = 50% = 5,000 per robot per cycle
        // Multiply by number of robots and battle frequency
        const avgBattlesPerRobot = activityMetrics.avgBattlesPerCycle / Math.max(activityMetrics.robotCount, 1);
        const estimatedDamageRate = Math.min(avgBattlesPerRobot * 0.3, 0.6); // 30% damage per battle, max 60%
        estimatedRepairCostPerCycle = activityMetrics.robotCount * 10000 * estimatedDamageRate;
      }
      
      // Calculate savings based on the ADDITIONAL discount from upgrading
      let projectedSavingsPerCycle = estimatedRepairCostPerCycle * (additionalDiscount / 100);
      
      if (currentLevel === 0) {
        // First purchase - show total savings, not incremental
        projectedSavingsPerCycle = estimatedRepairCostPerCycle * (nextDiscount / 100);
      }
      
      if (projectedSavingsPerCycle > 0) {
        projectedPayoffCycles = Math.ceil(upgradeCost / projectedSavingsPerCycle);
        projectedROI = (projectedSavingsPerCycle * 30 - upgradeCost) / upgradeCost;
        
        const dataSource = activityMetrics.avgRepairCostPerCycle === 0 ? ' (estimated)' : '';
        reason = `Saves ₡${projectedSavingsPerCycle.toFixed(0)}/cycle on repairs${dataSource} (${currentLevel === 0 ? '' : currentDiscount + '% → '}${nextDiscount}% discount with ${activityMetrics.robotCount} robot${activityMetrics.robotCount !== 1 ? 's' : ''})`;
        priority = projectedPayoffCycles <= 15 ? 'high' : projectedPayoffCycles <= 30 ? 'medium' : 'low';
      }
    } else if (facilityType === 'training_facility') {
      // Training facility reduces attribute upgrade costs
      const discountPercent = nextLevel * 10; // 10% per level, capped at 90%
      const projectedSavingsPerCycle = activityMetrics.avgUpgradeCostPerCycle * (discountPercent / 100);
      
      if (projectedSavingsPerCycle > 0) {
        projectedPayoffCycles = Math.ceil(upgradeCost / projectedSavingsPerCycle);
        projectedROI = (projectedSavingsPerCycle * 30 - upgradeCost) / upgradeCost;
        
        reason = `Saves ₡${projectedSavingsPerCycle.toFixed(0)}/cycle on upgrades (${discountPercent}% discount)`;
        priority = projectedPayoffCycles <= 20 ? 'high' : projectedPayoffCycles <= 40 ? 'medium' : 'low';
      }
    } else if (facilityType === 'weapons_workshop') {
      // Weapons workshop reduces weapon purchase costs
      const discountPercent = nextLevel * 5; // 5% per level
      const projectedSavingsPerCycle = activityMetrics.avgWeaponCostPerCycle * (discountPercent / 100);
      
      if (projectedSavingsPerCycle > 0) {
        projectedPayoffCycles = Math.ceil(upgradeCost / projectedSavingsPerCycle);
        projectedROI = (projectedSavingsPerCycle * 30 - upgradeCost) / upgradeCost;
        
        reason = `Saves ₡${projectedSavingsPerCycle.toFixed(0)}/cycle on weapons (${discountPercent}% discount)`;
        priority = projectedPayoffCycles <= 20 ? 'high' : projectedPayoffCycles <= 40 ? 'medium' : 'low';
      }
    } else if (facilityType === 'roster_expansion') {
      // Roster expansion allows more robots
      const currentRobots = activityMetrics.robotCount;
      const maxRobots = currentLevel + 1;
      
      if (currentRobots >= maxRobots) {
        // User is at capacity, recommend expansion
        projectedROI = 0.5; // Strategic value, not direct financial ROI
        reason = `Unlock slot for robot ${nextLevel + 1} (currently at capacity)`;
        priority = 'high';
      } else {
        projectedROI = 0.2; // Lower priority if not at capacity
        reason = `Unlock slot for robot ${nextLevel + 1}`;
        priority = 'low';
      }
    } else if (facilityType.includes('_training_academy')) {
      // Training academies increase attribute caps
      projectedROI = 0.3; // Strategic value
      reason = `Increase attribute cap to level ${this.getAcademyCapLevel(nextLevel)}`;
      priority = 'medium';
    } else if (facilityType === 'streaming_studio') {
      // Streaming Studio increases streaming revenue per battle
      const currentMultiplier = 1 + (currentLevel * 0.1);
      const nextMultiplier = 1 + (nextLevel * 0.1);
      const multiplierIncrease = nextMultiplier - currentMultiplier;
      
      // Calculate average streaming revenue per battle based on user's robots
      const avgStreamingRevenuePerBattle = await this.calculateAverageStreamingRevenue(
        user.id,
        currentLevel
      );
      
      // Calculate projected revenue increase per battle
      const revenueIncreasePerBattle = avgStreamingRevenuePerBattle * (multiplierIncrease / currentMultiplier);
      
      // Calculate total revenue increase per cycle based on battle frequency
      const projectedRevenueIncreasePerCycle = revenueIncreasePerBattle * activityMetrics.avgBattlesPerCycle;
      
      // Calculate operating cost increase (daily)
      const operatingCostIncrease = nextLevel * 100 - currentLevel * 100;
      
      // Calculate net benefit per cycle (revenue increase - operating cost increase)
      const netBenefitPerCycle = projectedRevenueIncreasePerCycle - operatingCostIncrease;
      
      if (activityMetrics.avgBattlesPerCycle === 0) {
        // No battle history, provide estimate
        projectedROI = 0.2;
        reason = `Increases streaming revenue by ${((multiplierIncrease / currentMultiplier) * 100).toFixed(0)}% per battle (no battle history to estimate ROI)`;
        priority = 'medium';
      } else if (netBenefitPerCycle > 0 && projectedRevenueIncreasePerCycle > 0) {
        projectedPayoffCycles = Math.ceil(upgradeCost / netBenefitPerCycle);
        projectedROI = (netBenefitPerCycle * 30 - upgradeCost) / upgradeCost;
        
        const percentIncrease = ((nextMultiplier / currentMultiplier - 1) * 100).toFixed(0);
        reason = `Increases streaming revenue by ${percentIncrease}% per battle (₡${revenueIncreasePerBattle.toFixed(0)} more per battle, ₡${operatingCostIncrease}/day operating cost)`;
        priority = projectedPayoffCycles <= 15 ? 'high' : projectedPayoffCycles <= 30 ? 'medium' : 'low';
      } else {
        // Net benefit is negative or zero (operating costs exceed revenue increase)
        // Don't recommend this upgrade
        return null;
      }
    } else if (facilityType === 'storage_facility') {
      // Storage facility increases weapon storage
      projectedROI = 0.1; // Low strategic value
      reason = `Increase weapon storage to ${5 + nextLevel * 5} slots`;
      priority = 'low';
    }

    // Only recommend if ROI is positive or has strategic value
    // Exception: Always show repair_bay even with negative ROI (user should decide)
    if (projectedROI <= 0 && priority === 'low' && facilityType !== 'repair_bay') {
      return null;
    }

    return {
      facilityType,
      facilityName: config.name,
      currentLevel,
      recommendedLevel: nextLevel,
      upgradeCost,
      projectedROI,
      projectedPayoffCycles,
      reason,
      priority,
    };
  }

  /**
   * Calculate average streaming revenue per battle for a user's robots
   * Takes into account robot fame, battle count, and current studio level
   */
  private async calculateAverageStreamingRevenue(
    userId: number,
    currentStudioLevel: number
  ): Promise<number> {
    // Get all user's robots (excluding bye robots)
    const robots = await prisma.robot.findMany({
      where: {
        userId,
        NOT: { name: 'Bye Robot' },
      },
      select: {
        id: true,
        totalBattles: true,
        totalTagTeamBattles: true,
        fame: true,
      },
    });

    if (robots.length === 0) {
      // No robots, return base amount with current studio multiplier
      return 1000 * (1 + currentStudioLevel * 0.1);
    }

    // Calculate streaming revenue for each robot and average
    const studioMultiplier = 1 + (currentStudioLevel * 1.0); // 100% per level
    let totalRevenue = 0;

    for (const robot of robots) {
      const totalBattleCount = robot.totalBattles + robot.totalTagTeamBattles;
      const battleMultiplier = 1 + (totalBattleCount / 1000);
      const fameMultiplier = 1 + (robot.fame / 5000);
      const revenue = 1000 * battleMultiplier * fameMultiplier * studioMultiplier;
      totalRevenue += revenue;
    }

    return totalRevenue / robots.length;
  }

  /**
   * Get base income for income generator at a specific level
   */
  private getIncomeGeneratorBaseIncome(level: number): number {
    const incomeByLevel = [5000, 8000, 11000, 12000, 15000, 18000, 20000, 25000, 30000, 35000];
    return incomeByLevel[level - 1] || 0;
  }

  /**
   * Get repair bay discount percentage at a specific level
   * Formula: repairBayLevel × (5 + activeRobotCount), capped at 90%
   */
  private getRepairBayDiscount(level: number, robotCount: number): number {
    return Math.min(level * (5 + robotCount), 90);
  }

  /**
   * Get academy cap level at a specific level
   */
  private getAcademyCapLevel(level: number): number {
    const capsByLevel = [15, 20, 25, 30, 35, 40, 42, 45, 48, 50];
    return capsByLevel[level - 1] || 10;
  }
}

interface ActivityMetrics {
  avgRepairCostPerCycle: number;
  avgUpgradeCostPerCycle: number;
  avgWeaponCostPerCycle: number;
  avgBattlesPerCycle: number;
  totalRepairCost: number;
  totalUpgradeCost: number;
  totalWeaponCost: number;
  totalBattles: number;
  robotCount: number;
}

export const facilityRecommendationService = new FacilityRecommendationService();
