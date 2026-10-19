import prisma from '../../lib/prisma';
import { getFacilityConfig } from '../../config/facilities';
import { StableMetric } from '../../types/snapshotTypes';
import { readCycleRepairSpend } from './repairPayloadKeys';
import { calculateRepairBayDiscountPercent } from '../../shared/utils/repairCost';
import {
  calculateTrainingFacilityDiscount,
  calculateWeaponWorkshopDiscount,
} from '../../shared/utils/discounts';
import { EconomyError, EconomyErrorCode } from '../../errors/economyErrors';
// Spec #46 R10: streaming estimates derive from the award-path formula.
import { computeStreamingRevenue } from './streamingRevenueService';
import {
  sumRepairBaySavingsFromGroups,
  sumStudioAttributableStreamingFromGroups,
} from './recorded-facility-returns';
import {
  aggregateRepairChargedByDiscount,
  aggregateStudioStreamingByMultiplier,
} from './recorded-facility-returns-queries';
import {
  calculateFacilityOperatingCost,
  calculateMerchandisingIncome,
  getRosterCapacity,
} from '../../utils/economyCalculations';

/**
 * The 5 economic facility types that have direct financial returns (income or savings).
 * Non-economic facilities (academies, roster expansion, storage, etc.) are excluded.
 */
const ECONOMIC_FACILITY_TYPES = [
  'merchandising_hub',
  'streaming_studio',
  'repair_bay',
  'training_facility',
  'weapons_workshop',
] as const;

type EconomicFacilityType = (typeof ECONOMIC_FACILITY_TYPES)[number];

export interface UnifiedFacilityROI {
  facilityType: string;
  currentLevel: number;
  totalInvestment: number;
  totalReturns: number;
  totalOperatingCosts: number;
  netROI: number;
  paidOff: boolean;
  projectedPayoffCycles: number | null; // null if already paid off
  cyclesSincePurchase: number;
  dataSource: 'snapshot' | 'estimate';
}

export interface AllEconomicROIsResult {
  facilities: UnifiedFacilityROI[];
  totals: {
    totalInvestment: number;
    totalReturns: number;
    totalOperatingCosts: number;
    overallNetROI: number;
  };
}

export class UnifiedFacilityROIService {
  /**
   * Calculate ROI for a specific economic facility owned by a user.
   * NEVER returns null for owned economic facilities — always returns data.
   * Uses CycleSnapshot.stableMetrics as primary data source with formula-based fallback.
   */
  async calculateFacilityROI(
    userId: number,
    facilityType: string
  ): Promise<UnifiedFacilityROI | null> {
    // Only accept the 5 economic facility types
    if (!this.isEconomicFacility(facilityType)) {
      return null;
    }

    // Get facility info
    const facility = await prisma.facility.findUnique({
      where: {
        userId_facilityType: {
          userId,
          facilityType,
        },
      },
    });

    if (!facility || facility.level === 0) {
      return null; // Facility not owned
    }

    const level = facility.level;

    // Calculate total investment from facility config
    const config = getFacilityConfig(facilityType);
    if (!config) {
      return null;
    }

    const totalInvestment = config.costs
      .slice(0, level)
      .reduce((sum, cost) => sum + cost, 0);

    // Determine purchase cycle
    const purchaseCycle = await this.determinePurchaseCycle(userId, facilityType);

    // Get current cycle number
    const currentCycleMetadata = await prisma.cycleMetadata.findUnique({
      where: { id: 1 },
    });
    const currentCycle = currentCycleMetadata?.totalCycles || 1;
    const cyclesSincePurchase = Math.max(1, currentCycle - purchaseCycle + 1);

    // Get cycle snapshots for the ownership period
    const snapshots = await prisma.cycleSnapshot.findMany({
      where: {
        cycleNumber: { gte: purchaseCycle, lte: currentCycle },
      },
      select: {
        cycleNumber: true,
        stableMetrics: true,
      },
    });

    // Extract user's metrics from snapshots
    const userMetrics: StableMetric[] = [];
    for (const snapshot of snapshots) {
      const metrics = (snapshot.stableMetrics as unknown as StableMetric[]);
      if (Array.isArray(metrics)) {
        const userMetric = metrics.find((m) => m.userId === userId);
        if (userMetric) {
          userMetrics.push(userMetric);
        }
      }
    }

    let totalReturns: number;
    let dataSource: 'snapshot' | 'estimate';

    if (userMetrics.length > 0) {
      // Primary path: calculate from snapshot data
      totalReturns = await this.calculateReturnsFromSnapshots(
        facilityType as EconomicFacilityType,
        level,
        userMetrics,
        userId,
        purchaseCycle,
        currentCycle
      );
      dataSource = 'snapshot';
    } else {
      // Fallback: formula-based estimate
      totalReturns = await this.calculateEstimatedReturns(
        userId,
        facilityType as EconomicFacilityType,
        level,
        cyclesSincePurchase
      );
      dataSource = 'estimate';
    }

    // Calculate operating costs using the per-facility daily cost × cycles owned
    const dailyOperatingCost = calculateFacilityOperatingCost(facilityType, level);
    const totalOperatingCosts = dailyOperatingCost * cyclesSincePurchase;

    // Calculate net ROI
    const netProfit = totalReturns - totalOperatingCosts - totalInvestment;
    const netROI = totalInvestment > 0 ? netProfit / totalInvestment : 0;

    // Determine paid-off status
    const paidOff = (totalReturns - totalOperatingCosts) >= totalInvestment;

    // Calculate projected payoff cycles if not paid off
    let projectedPayoffCycles: number | null = null;
    if (!paidOff && cyclesSincePurchase > 0) {
      const avgNetReturnPerCycle =
        (totalReturns - totalOperatingCosts) / cyclesSincePurchase;
      if (avgNetReturnPerCycle > 0) {
        const remainingCost =
          totalInvestment - (totalReturns - totalOperatingCosts);
        projectedPayoffCycles = Math.ceil(remainingCost / avgNetReturnPerCycle);
      }
    }

    return {
      facilityType,
      currentLevel: level,
      totalInvestment,
      totalReturns,
      totalOperatingCosts,
      netROI,
      paidOff,
      projectedPayoffCycles,
      cyclesSincePurchase,
      dataSource,
    };
  }

  /**
   * Calculate ROI for all economic facilities owned by a user.
   * Returns data for every owned economic facility (level > 0).
   * Fetches shared data (cycle metadata, snapshots) once and reuses across facilities.
   */
  async calculateAllEconomicROIs(userId: number): Promise<AllEconomicROIsResult> {
    const facilities = await prisma.facility.findMany({
      where: {
        userId,
        level: { gt: 0 },
        facilityType: { in: [...ECONOMIC_FACILITY_TYPES] },
      },
    });

    if (facilities.length === 0) {
      return {
        facilities: [],
        totals: { totalInvestment: 0, totalReturns: 0, totalOperatingCosts: 0, overallNetROI: 0 },
      };
    }

    // Fetch shared data once for all facilities
    const currentCycleMetadata = await prisma.cycleMetadata.findUnique({
      where: { id: 1 },
    });
    const currentCycle = currentCycleMetadata?.totalCycles || 1;

    // Fetch all snapshots for the user (from cycle 1 to current — covers all facilities)
    const allSnapshots = await prisma.cycleSnapshot.findMany({
      where: { cycleNumber: { gte: 1, lte: currentCycle } },
      select: { cycleNumber: true, stableMetrics: true },
    });

    // Pre-extract user metrics from all snapshots once
    const userMetricsByCycle = new Map<number, StableMetric>();
    for (const snapshot of allSnapshots) {
      const metrics = snapshot.stableMetrics as unknown as StableMetric[];
      if (Array.isArray(metrics)) {
        const userMetric = metrics.find((m) => m.userId === userId);
        if (userMetric) {
          userMetricsByCycle.set(snapshot.cycleNumber, userMetric);
        }
      }
    }

    // Recorded streaming awards and repairs are not prefetched: the Streaming
    // Studio and Repair Bay each run one DB aggregate over their own ownership
    // window (#542), so row volume does not grow with history.

    // Purchased Roster_Capacity, needed for the Training Facility discount
    // (Spec #46 R11, #526); fetched once, only when that facility is owned.
    const rosterCapacity = facilities.some((f) => f.facilityType === 'training_facility')
      ? await this.fetchRosterCapacity(userId)
      : 1;

    const results: UnifiedFacilityROI[] = [];

    for (const facility of facilities) {
      const roi = await this.calculateFacilityROIWithSharedData(
        userId,
        facility.facilityType,
        facility.level,
        currentCycle,
        userMetricsByCycle,
        rosterCapacity
      );
      if (roi) {
        results.push(roi);
      }
    }

    // Calculate totals
    const totalInvestment = results.reduce((sum, r) => sum + r.totalInvestment, 0);
    const totalReturns = results.reduce((sum, r) => sum + r.totalReturns, 0);
    const totalOperatingCosts = results.reduce((sum, r) => sum + r.totalOperatingCosts, 0);
    const overallNetROI =
      totalInvestment > 0
        ? (totalReturns - totalOperatingCosts - totalInvestment) / totalInvestment
        : 0;

    return {
      facilities: results,
      totals: {
        totalInvestment,
        totalReturns,
        totalOperatingCosts,
        overallNetROI,
      },
    };
  }

  /**
   * Internal: Calculate ROI using pre-fetched shared data (avoids redundant queries).
   */
  private async calculateFacilityROIWithSharedData(
    userId: number,
    facilityType: string,
    level: number,
    currentCycle: number,
    userMetricsByCycle: Map<number, StableMetric>,
    rosterCapacity: number
  ): Promise<UnifiedFacilityROI | null> {
    if (!this.isEconomicFacility(facilityType)) return null;

    const config = getFacilityConfig(facilityType);
    if (!config) return null;

    const totalInvestment = config.costs
      .slice(0, level)
      .reduce((sum, cost) => sum + cost, 0);

    // Determine purchase cycle
    const purchaseCycle = await this.determinePurchaseCycle(userId, facilityType);
    const cyclesSincePurchase = Math.max(1, currentCycle - purchaseCycle + 1);

    // Extract user metrics for the ownership period from pre-fetched data
    const userMetrics: StableMetric[] = [];
    for (let cycle = purchaseCycle; cycle <= currentCycle; cycle++) {
      const metric = userMetricsByCycle.get(cycle);
      if (metric) {
        userMetrics.push(metric);
      }
    }

    let totalReturns: number;
    let dataSource: 'snapshot' | 'estimate';

    if (userMetrics.length > 0) {
      totalReturns = await this.calculateReturnsFromSharedSnapshots(
        facilityType as EconomicFacilityType,
        level,
        userMetrics,
        userId,
        purchaseCycle,
        currentCycle,
        rosterCapacity
      );
      dataSource = 'snapshot';
    } else {
      totalReturns = await this.calculateEstimatedReturns(
        userId,
        facilityType as EconomicFacilityType,
        level,
        cyclesSincePurchase
      );
      dataSource = 'estimate';
    }

    const dailyOperatingCost = calculateFacilityOperatingCost(facilityType, level);
    const totalOperatingCosts = dailyOperatingCost * cyclesSincePurchase;

    const netProfit = totalReturns - totalOperatingCosts - totalInvestment;
    const netROI = totalInvestment > 0 ? netProfit / totalInvestment : 0;
    const paidOff = (totalReturns - totalOperatingCosts) >= totalInvestment;

    let projectedPayoffCycles: number | null = null;
    if (!paidOff && cyclesSincePurchase > 0) {
      const avgNetReturnPerCycle = (totalReturns - totalOperatingCosts) / cyclesSincePurchase;
      if (avgNetReturnPerCycle > 0) {
        const remainingCost = totalInvestment - (totalReturns - totalOperatingCosts);
        projectedPayoffCycles = Math.ceil(remainingCost / avgNetReturnPerCycle);
      }
    }

    return {
      facilityType,
      currentLevel: level,
      totalInvestment,
      totalReturns,
      totalOperatingCosts,
      netROI,
      paidOff,
      projectedPayoffCycles,
      cyclesSincePurchase,
      dataSource,
    };
  }

  /**
   * Variant of calculateReturnsFromSnapshots that uses the pre-fetched
   * Roster_Capacity. Streaming Studio and Repair Bay returns come from DB
   * aggregates over the ownership window `[purchaseCycle, currentCycle]`.
   */
  private async calculateReturnsFromSharedSnapshots(
    facilityType: EconomicFacilityType,
    level: number,
    userMetrics: StableMetric[],
    userId: number,
    purchaseCycle: number,
    currentCycle: number,
    rosterCapacity: number
  ): Promise<number> {
    switch (facilityType) {
      case 'merchandising_hub':
        return userMetrics.reduce((sum, m) => sum + (m.merchandisingIncome || 0), 0);
      case 'streaming_studio':
        return this.calculateStudioStreamingReturns(userId, purchaseCycle, currentCycle);
      case 'repair_bay':
        return this.calculateRepairBaySavings(userId, purchaseCycle, currentCycle);
      case 'training_facility':
        return this.calculateTrainingFacilitySavings(level, userMetrics, rosterCapacity);
      case 'weapons_workshop':
        return this.calculateWeaponsWorkshopSavings(level, userMetrics);
      default:
        return 0;
    }
  }

  /**
   * Calculate projected ROI for a prospective facility upgrade.
   * Replaces the old `economyCalculations.calculateFacilityROI` functionality.
   * Keeps the same response shape for backward compatibility.
   */
  async calculateProjectedROI(
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
      // A bare `Error` here reached the error handler as a 500. Bad input on this
      // endpoint is a client error, and the AppError hierarchy is what carries the
      // status and code (see the Error Handling rules in coding-standards.md).
      throw new EconomyError(EconomyErrorCode.FACILITY_NOT_FOUND, 'User not found', 404);
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
    if (!config) {
      throw new EconomyError(
        EconomyErrorCode.INVALID_FACILITY_TYPE,
        `Unknown facility type '${facilityType}'`,
        400,
      );
    }
    if (targetLevel > config.maxLevel || targetLevel <= currentLevel) {
      throw new EconomyError(
        EconomyErrorCode.INVALID_TRANSACTION,
        `Target level must be above the current level (${currentLevel}) and at most ${config.maxLevel}`,
        400,
      );
    }

    // Calculate upgrade cost
    let upgradeCost = 0;
    for (let lvl = currentLevel; lvl < targetLevel; lvl++) {
      upgradeCost += config.costs[lvl] || 0;
    }

    // Calculate operating cost increase
    const costBefore = calculateFacilityOperatingCost(facilityType, currentLevel);
    const costAfter = calculateFacilityOperatingCost(facilityType, targetLevel);
    const dailyCostIncrease = costAfter - costBefore;

    // Calculate daily benefit increase. Merchandising scales with
    // Prestige_Per_Slot, so Roster_Capacity is required (Spec #46 R2).
    const rosterExpansion = await prisma.facility.findUnique({
      where: { userId_facilityType: { userId, facilityType: 'roster_expansion' } },
      select: { level: true },
    });
    const dailyBenefitIncrease = this.calculateDailyBenefitIncrease(
      facilityType,
      currentLevel,
      targetLevel,
      user.prestige,
      getRosterCapacity(rosterExpansion?.level ?? 0)
    );

    // Calculate net change
    const netDailyChange = dailyBenefitIncrease - dailyCostIncrease;

    // Calculate breakeven
    let breakevenDays: number | null = null;
    if (netDailyChange > 0) {
      breakevenDays = Math.ceil(upgradeCost / netDailyChange);
    }

    // Calculate net over time periods
    const net30Days = netDailyChange * 30 - upgradeCost;
    const net90Days = netDailyChange * 90 - upgradeCost;
    const net180Days = netDailyChange * 180 - upgradeCost;

    // Check affordability
    const affordable = user.currency >= upgradeCost;

    // Generate recommendation
    const { recommendation, recommendationType } = this.generateRecommendation(
      facilityType,
      config.name,
      upgradeCost,
      netDailyChange,
      breakevenDays,
      affordable,
      user.currency,
      targetLevel,
      config.benefits
    );

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

  // ==================== PRIVATE HELPERS ====================

  /**
   * Check if a facility type is one of the 5 economic facility types.
   */
  private isEconomicFacility(facilityType: string): facilityType is EconomicFacilityType {
    return (ECONOMIC_FACILITY_TYPES as readonly string[]).includes(facilityType);
  }

  /**
   * Determine the purchase cycle for a facility.
   * Strategy: audit event → earliest snapshot with activity → cycle 1
   */
  private async determinePurchaseCycle(
    userId: number,
    facilityType: string
  ): Promise<number> {
    // Try 1: Find facility_purchase audit event
    const purchaseEvent = await prisma.auditLog.findFirst({
      where: {
        userId,
        eventType: 'facility_purchase',
        payload: {
          path: ['facilityType'],
          equals: facilityType,
        },
      },
      orderBy: { cycleNumber: 'asc' },
    });

    if (purchaseEvent) {
      return purchaseEvent.cycleNumber;
    }

    // Try 2: Find earliest snapshot with activity for this facility type
    const earliestSnapshot = await this.findEarliestSnapshotWithActivity(
      userId,
      facilityType
    );

    if (earliestSnapshot) {
      return earliestSnapshot;
    }

    // Final fallback: cycle 1
    return 1;
  }

  /**
   * Find the earliest cycle snapshot where the user has non-zero activity
   * relevant to the given facility type.
   */
  private async findEarliestSnapshotWithActivity(
    userId: number,
    facilityType: string
  ): Promise<number | null> {
    const snapshots = await prisma.cycleSnapshot.findMany({
      select: { cycleNumber: true, stableMetrics: true },
      orderBy: { cycleNumber: 'asc' },
      take: 100, // Limit to avoid scanning entire history
    });

    for (const snapshot of snapshots) {
      const metrics = snapshot.stableMetrics as unknown as StableMetric[];
      if (!Array.isArray(metrics)) continue;

      const userMetric = metrics.find((m) => m.userId === userId);
      if (!userMetric) continue;

      const hasActivity = this.hasActivityForFacility(facilityType, userMetric);
      if (hasActivity) {
        return snapshot.cycleNumber;
      }
    }

    return null;
  }

  /**
   * Check if a StableMetric shows activity relevant to a facility type.
   */
  private hasActivityForFacility(
    facilityType: string,
    metric: StableMetric
  ): boolean {
    switch (facilityType) {
      case 'merchandising_hub':
        return metric.merchandisingIncome > 0;
      case 'streaming_studio':
        return metric.streamingIncome > 0;
      case 'repair_bay':
        return readCycleRepairSpend(metric as unknown as Record<string, unknown>) > 0;
      case 'training_facility':
        return metric.attributeUpgrades > 0;
      case 'weapons_workshop':
        return metric.weaponPurchases > 0;
      default:
        return false;
    }
  }

  /**
   * Streaming Studio returns in `[fromCycle, toCycle]`: the studio-attributable
   * share of the user's recorded `streaming_revenue` awards, summed in the
   * database per stored `studioMultiplier` (#542) and rounded once.
   */
  private async calculateStudioStreamingReturns(
    userId: number,
    fromCycle: number,
    toCycle: number
  ): Promise<number> {
    return sumStudioAttributableStreamingFromGroups(
      await aggregateStudioStreamingByMultiplier(userId, fromCycle, toCycle)
    );
  }

  /**
   * Calculate returns from snapshot data for a specific facility type.
   *
   * Streaming Studio returns are the studio-attributable share of each recorded
   * `streaming_revenue` award in the ownership window
   * (`amount × (1 − 1 / studioMultiplier)` with the row's stored multiplier,
   * #524), not the whole streaming income: a robot earns base streaming
   * without any studio. The awards are summed in the database per stored
   * multiplier (#542). Cycles from before the financial ledger existed have
   * no rows and therefore contribute nothing, so returns for a studio bought
   * before the ledger cutover are understated rather than re-derived from the
   * current formula.
   */
  private async calculateReturnsFromSnapshots(
    facilityType: EconomicFacilityType,
    level: number,
    userMetrics: StableMetric[],
    userId: number,
    purchaseCycle: number,
    currentCycle: number
  ): Promise<number> {
    switch (facilityType) {
      case 'merchandising_hub':
        return userMetrics.reduce((sum, m) => sum + (m.merchandisingIncome || 0), 0);

      case 'streaming_studio':
        return this.calculateStudioStreamingReturns(userId, purchaseCycle, currentCycle);

      case 'repair_bay':
        return this.calculateRepairBaySavings(userId, purchaseCycle, currentCycle);

      case 'training_facility':
        return this.calculateTrainingFacilitySavings(
          level,
          userMetrics,
          await this.fetchRosterCapacity(userId)
        );

      case 'weapons_workshop':
        return this.calculateWeaponsWorkshopSavings(level, userMetrics);

      default:
        return 0;
    }
  }

  /**
   * Repair Bay savings from the stable's recorded `robot_repair` rows in the
   * ownership window: per row `charged × d / (100 − d)` with the row's recorded
   * Repair Bay discount d. Never re-derived from the current discount formula
   * or level, so the #525 change (6% per level, independent of robot count)
   * leaves past savings as they were recorded. Charges are summed in the
   * database per recorded discount (#542), so only one row per distinct d is
   * read.
   */
  private async calculateRepairBaySavings(
    userId: number,
    purchaseCycle: number,
    currentCycle: number
  ): Promise<number> {
    return sumRepairBaySavingsFromGroups(
      await aggregateRepairChargedByDiscount(userId, purchaseCycle, currentCycle)
    );
  }

  /**
   * The stable's purchased Roster_Capacity (from its `roster_expansion` level,
   * never the robots it currently owns).
   */
  private async fetchRosterCapacity(userId: number): Promise<number> {
    const rosterExpansion = await prisma.facility.findUnique({
      where: { userId_facilityType: { userId, facilityType: 'roster_expansion' } },
      select: { level: true },
    });
    return getRosterCapacity(rosterExpansion?.level ?? 0);
  }

  /**
   * Estimate savings from Training Facility based on attribute upgrade spending,
   * with the shared roster-dependent discount (#526:
   * `0.75 × level × (10 − Roster_Capacity)` percent).
   *
   * This is an **estimate**: attribute upgrade records do not store the
   * discount they were charged at, so the current level and current purchased
   * capacity are applied to the whole ownership window. It no longer ignores
   * capacity, so a wide stable is not credited with the one-robot rate.
   */
  private calculateTrainingFacilitySavings(
    level: number,
    userMetrics: StableMetric[],
    rosterCapacity: number
  ): number {
    const totalUpgradeCosts = userMetrics.reduce(
      (sum, m) => sum + (m.attributeUpgrades || 0),
      0
    );

    const discountPercent = calculateTrainingFacilityDiscount(level, rosterCapacity);
    if (discountPercent >= 100) return 0;

    // Savings = actualCost * discount / (100 - discount)
    const savings = totalUpgradeCosts * (discountPercent / (100 - discountPercent));
    return Math.round(savings);
  }

  /**
   * Estimate savings from Weapons Workshop based on weapon purchase spending.
   * Discount: shared `calculateWeaponWorkshopDiscount` (5% per level, 50% at L10).
   */
  private calculateWeaponsWorkshopSavings(
    level: number,
    userMetrics: StableMetric[]
  ): number {
    const totalWeaponCosts = userMetrics.reduce(
      (sum, m) => sum + (m.weaponPurchases || 0),
      0
    );

    const discountPercent = calculateWeaponWorkshopDiscount(level);
    if (discountPercent >= 100) return 0;

    // Savings = actualCost * discount / (100 - discount)
    const savings = totalWeaponCosts * (discountPercent / (100 - discountPercent));
    return Math.round(savings);
  }

  /**
   * Formula-based fallback when no snapshots exist.
   */
  private async calculateEstimatedReturns(
    userId: number,
    facilityType: EconomicFacilityType,
    level: number,
    cyclesOwned: number
  ): Promise<number> {
    switch (facilityType) {
      case 'merchandising_hub': {
        const [user, rosterExpansion] = await Promise.all([
          prisma.user.findUnique({ where: { id: userId }, select: { prestige: true } }),
          prisma.facility.findUnique({
            where: { userId_facilityType: { userId, facilityType: 'roster_expansion' } },
            select: { level: true },
          }),
        ]);
        const prestige = user?.prestige || 0;
        // Merchandising scales with Prestige_Per_Slot, not raw prestige (Spec #46 R2)
        const rosterCapacity = getRosterCapacity(rosterExpansion?.level ?? 0);
        const dailyIncome = calculateMerchandisingIncome(level, prestige, rosterCapacity);
        return dailyIncome * cyclesOwned;
      }

      case 'streaming_studio': {
        // Estimate: studio-attributable streaming per battle × average battles
        // per cycle × cycles, derived from `computeStreamingRevenue()`.
        //
        // Only the increment over a stable without a studio counts as a return
        // (#524): base streaming is earned at L0 too. This remains an
        // **estimate**, deliberately: the function is called without a
        // per-robot battle count or fame, so both are passed as zero, which
        // makes it a floor rather than a projection for any specific robot.
        const studioIncrementPerBattle =
          computeStreamingRevenue(0, 0, level).totalRevenue
          - computeStreamingRevenue(0, 0, 0).totalRevenue;
        const avgBattlesPerCycle = 3; // Conservative estimate
        return Math.round(studioIncrementPerBattle * avgBattlesPerCycle * cyclesOwned);
      }

      case 'repair_bay': {
        // Estimate: average repair spending × discount percentage × cycles.
        // Robot count only sizes the repair volume; the discount is the shared
        // 6% per level (#525).
        const robots = await prisma.robot.findMany({
          where: { userId },
          select: { id: true },
        });
        const robotCount = robots.length || 1;
        const discountPercent = calculateRepairBayDiscountPercent(level);
        const avgRepairPerCycle = robotCount * 5000; // Conservative estimate
        return Math.round(avgRepairPerCycle * (discountPercent / 100) * cyclesOwned);
      }

      case 'training_facility': {
        // Estimate: average upgrade spending × the shared roster-dependent
        // discount (#526) × cycles.
        const discountPercent = calculateTrainingFacilityDiscount(
          level,
          await this.fetchRosterCapacity(userId)
        );
        const avgUpgradePerCycle = 10000; // Conservative estimate
        return Math.round(avgUpgradePerCycle * (discountPercent / 100) * cyclesOwned);
      }

      case 'weapons_workshop': {
        // Estimate: average weapon spending × discount percentage × cycles
        const discountPercent = calculateWeaponWorkshopDiscount(level);
        const avgWeaponPerCycle = 5000; // Conservative estimate
        return Math.round(avgWeaponPerCycle * (discountPercent / 100) * cyclesOwned);
      }

      default:
        return 0;
    }
  }

  /**
   * Calculate daily benefit increase for income-generating facilities.
   * Used by calculateProjectedROI for prospective upgrade analysis.
   */
  private calculateDailyBenefitIncrease(
    facilityType: string,
    fromLevel: number,
    toLevel: number,
    userPrestige: number,
    rosterCapacity: number
  ): number {
    if (facilityType === 'merchandising_hub') {
      const incomeBefore = fromLevel > 0
        ? calculateMerchandisingIncome(fromLevel, userPrestige, rosterCapacity)
        : 0;
      const incomeAfter = calculateMerchandisingIncome(toLevel, userPrestige, rosterCapacity);
      return incomeAfter - incomeBefore;
    }

    // Other facilities provide indirect benefits (discounts, caps, etc.)
    // that can't be expressed as a simple daily income increase
    return 0;
  }

  /**
   * Generate upgrade recommendation text and type.
   */
  private generateRecommendation(
    facilityType: string,
    facilityName: string,
    upgradeCost: number,
    netDailyChange: number,
    breakevenDays: number | null,
    affordable: boolean,
    userCurrency: number,
    targetLevel: number,
    benefits: string[]
  ): { recommendation: string; recommendationType: 'excellent' | 'good' | 'neutral' | 'poor' | 'not_affordable' } {
    if (!affordable) {
      return {
        recommendation: `You need ₡${(upgradeCost - userCurrency).toLocaleString()} more credits to afford this upgrade.`,
        recommendationType: 'not_affordable',
      };
    }

    if (facilityType === 'merchandising_hub') {
      if (breakevenDays && breakevenDays <= 30) {
        return {
          recommendation: `Excellent investment! Pays for itself in ${breakevenDays} days with ₡${netDailyChange.toLocaleString()}/day net gain.`,
          recommendationType: 'excellent',
        };
      } else if (breakevenDays && breakevenDays <= 90) {
        return {
          recommendation: `Good investment. Break-even in ${breakevenDays} days (~${Math.round(breakevenDays / 30)} months) with ₡${netDailyChange.toLocaleString()}/day net gain.`,
          recommendationType: 'good',
        };
      } else if (breakevenDays) {
        return {
          recommendation: `Long-term investment. Break-even in ${breakevenDays} days (~${Math.round(breakevenDays / 30)} months). Consider if planning long-term.`,
          recommendationType: 'neutral',
        };
      } else {
        return {
          recommendation: `This upgrade increases costs by ₡${Math.abs(netDailyChange).toLocaleString()}/day without offsetting income. Consider other facilities first.`,
          recommendationType: 'poor',
        };
      }
    }

    // Non-income facilities
    if (upgradeCost < userCurrency * 0.1) {
      return {
        recommendation: `${facilityName} upgrade is affordable (${Math.round((upgradeCost / userCurrency) * 100)}% of balance). ${benefits[targetLevel - 1] || 'Provides valuable benefits'}.`,
        recommendationType: 'good',
      };
    } else if (upgradeCost < userCurrency * 0.3) {
      return {
        recommendation: `${facilityName} upgrade costs ${Math.round((upgradeCost / userCurrency) * 100)}% of your balance. ${benefits[targetLevel - 1] || 'Provides useful benefits'}.`,
        recommendationType: 'neutral',
      };
    } else {
      return {
        recommendation: `${facilityName} upgrade costs ${Math.round((upgradeCost / userCurrency) * 100)}% of your balance. Save more credits before upgrading.`,
        recommendationType: 'poor',
      };
    }
  }
}

export const unifiedFacilityROIService = new UnifiedFacilityROIService();
