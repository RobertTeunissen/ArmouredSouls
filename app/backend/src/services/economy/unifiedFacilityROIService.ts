import prisma from '../../lib/prisma';
import { getFacilityConfig } from '../../config/facilities';
import { calculateRepairBayDiscountPercent } from '../../shared/utils/repairCost';
import {
  calculateTrainingFacilityDiscount,
  calculateWeaponWorkshopDiscount,
} from '../../shared/utils/discounts';
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
  aggregateStableSnapshotTotals,
  findEarliestSnapshotCycleWithActivity,
  type StableSnapshotTotals,
} from './snapshot-stable-metric-queries';
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
   * Calculate ROI for all economic facilities owned by a user.
   * Returns data for every owned economic facility (level > 0).
   * Fetches shared data (cycle metadata, roster capacity) once and reuses it
   * across facilities. Snapshot metrics are aggregated in the database per
   * facility over its own ownership window (#550).
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

    // Snapshot metrics, recorded streaming awards and repairs are not
    // prefetched: each facility runs DB aggregates over its own ownership
    // window (#542, #550), so row volume does not grow with history.

    // Purchased Roster_Capacity, needed for the Training Facility discount
    // (Spec #46 R11, #526); fetched once, only when that facility is owned.
    const rosterCapacity = facilities.some((f) => f.facilityType === 'training_facility')
      ? await this.fetchRosterCapacity(userId)
      : 1;

    const results: UnifiedFacilityROI[] = [];

    for (const facility of facilities) {
      const roi = await this.calculateFacilityROI(
        userId,
        facility.facilityType,
        facility.level,
        currentCycle,
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
   * ROI of one owned facility, using the shared data fetched once per stable.
   */
  private async calculateFacilityROI(
    userId: number,
    facilityType: string,
    level: number,
    currentCycle: number,
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

    // The stable's snapshot totals for the ownership period (#550)
    const snapshotTotals = await aggregateStableSnapshotTotals(userId, purchaseCycle, currentCycle);

    let totalReturns: number;
    let dataSource: 'snapshot' | 'estimate';

    if (snapshotTotals.snapshotCount > 0) {
      totalReturns = await this.calculateReturnsFromSnapshots(
        facilityType as EconomicFacilityType,
        level,
        snapshotTotals,
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
   * Returns from snapshot data for one facility over its ownership window
   * `[purchaseCycle, currentCycle]`, with the pre-fetched Roster_Capacity.
   *
   * Streaming Studio returns are the studio-attributable share of each recorded
   * `streaming_revenue` award in the window
   * (`amount × (1 − 1 / studioMultiplier)` with the row's stored multiplier,
   * #524), not the whole streaming income: a robot earns base streaming
   * without any studio. Streaming awards and Repair Bay charges are summed in
   * the database (#542). Cycles from before the financial ledger existed have
   * no rows and therefore contribute nothing, so returns for a studio bought
   * before the ledger cutover are understated rather than re-derived from the
   * current formula.
   */
  private async calculateReturnsFromSnapshots(
    facilityType: EconomicFacilityType,
    level: number,
    snapshotTotals: StableSnapshotTotals,
    userId: number,
    purchaseCycle: number,
    currentCycle: number,
    rosterCapacity: number
  ): Promise<number> {
    switch (facilityType) {
      case 'merchandising_hub':
        return snapshotTotals.merchandisingIncome;
      case 'streaming_studio':
        return this.calculateStudioStreamingReturns(userId, purchaseCycle, currentCycle);
      case 'repair_bay':
        return this.calculateRepairBaySavings(userId, purchaseCycle, currentCycle);
      case 'training_facility':
        return this.calculateTrainingFacilitySavings(level, snapshotTotals, rosterCapacity);
      case 'weapons_workshop':
        return this.calculateWeaponsWorkshopSavings(level, snapshotTotals);
      default:
        return 0;
    }
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
    // (among the oldest 100 snapshots, filtered in the database, #550)
    const earliestSnapshot = this.isEconomicFacility(facilityType)
      ? await findEarliestSnapshotCycleWithActivity(userId, facilityType)
      : null;

    if (earliestSnapshot) {
      return earliestSnapshot;
    }

    // Final fallback: cycle 1
    return 1;
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
    snapshotTotals: StableSnapshotTotals,
    rosterCapacity: number
  ): number {
    const totalUpgradeCosts = snapshotTotals.attributeUpgrades;

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
    snapshotTotals: StableSnapshotTotals
  ): number {
    const totalWeaponCosts = snapshotTotals.weaponPurchases;

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

}

export const unifiedFacilityROIService = new UnifiedFacilityROIService();
