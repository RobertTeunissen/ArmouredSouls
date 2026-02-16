import { PrismaClient } from '@prisma/client';
import { getFacilityConfig } from '../config/facilities';

const prisma = new PrismaClient();

export interface FacilityROI {
  facilityType: string;
  currentLevel: number;
  totalInvestment: number; // Total cost of all upgrades
  totalReturns: number; // Total income + discounts
  totalOperatingCosts: number; // Total operating costs since purchase
  netROI: number; // (returns - operating costs - investment) / investment
  breakevenCycle: number | null; // Cycle where returns >= investment + operating costs
  cyclesSincePurchase: number; // Number of cycles since first purchase
  isProfitable: boolean; // Whether net ROI is positive
}

export interface FacilityIncome {
  merchandising: number;
  streaming: number;
  total: number;
}

export interface FacilityDiscount {
  totalSavings: number;
  transactionCount: number;
}

export class ROICalculatorService {
  /**
   * Calculate ROI for a specific facility type owned by a user
   */
  async calculateFacilityROI(
    userId: number,
    facilityType: string
  ): Promise<FacilityROI | null> {
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
      return null; // Facility not purchased
    }

    // Get facility config to calculate total investment
    const config = getFacilityConfig(facilityType);
    if (!config) {
      throw new Error(`Unknown facility type: ${facilityType}`);
    }

    // Calculate total investment (sum of all upgrade costs up to current level)
    const totalInvestment = config.costs
      .slice(0, facility.level)
      .reduce((sum, cost) => sum + cost, 0);

    // Find the first purchase event to determine when facility was acquired
    const firstPurchase = await prisma.auditLog.findFirst({
      where: {
        userId,
        eventType: 'facility_purchase',
        payload: {
          path: ['facilityType'],
          equals: facilityType,
        },
      },
      orderBy: {
        cycleNumber: 'asc',
      },
    });

    if (!firstPurchase) {
      // No purchase event found, can't calculate ROI
      return null;
    }

    const purchaseCycle = firstPurchase.cycleNumber;

    // Get current cycle number
    const currentCycleMetadata = await prisma.cycleMetadata.findUnique({
      where: { id: 1 },
    });
    const currentCycle = currentCycleMetadata?.totalCycles || purchaseCycle;
    const cyclesSincePurchase = currentCycle - purchaseCycle + 1;

    // Calculate returns based on facility type
    let totalReturns = 0;

    if (facilityType === 'income_generator') {
      // Income generator provides passive income
      const income = await this.calculateIncomeGeneratorReturns(
        userId,
        purchaseCycle,
        currentCycle
      );
      totalReturns = income.total;
    } else if (
      facilityType === 'repair_bay' ||
      facilityType === 'training_facility' ||
      facilityType === 'weapons_workshop'
    ) {
      // Discount facilities - calculate savings from discounts
      const discounts = await this.calculateDiscountFacilityReturns(
        userId,
        facilityType,
        purchaseCycle,
        currentCycle
      );
      totalReturns = discounts.totalSavings;
    }
    // Other facility types (roster_expansion, storage_facility, etc.) don't have direct financial returns

    // Calculate total operating costs
    const totalOperatingCosts = await this.calculateOperatingCosts(
      userId,
      facilityType,
      purchaseCycle,
      currentCycle
    );

    // Calculate net ROI
    const netProfit = totalReturns - totalOperatingCosts - totalInvestment;
    const netROI = totalInvestment > 0 ? netProfit / totalInvestment : 0;

    // Calculate breakeven cycle
    const breakevenCycle = await this.calculateBreakevenCycle(
      userId,
      facilityType,
      purchaseCycle,
      currentCycle,
      totalInvestment
    );

    return {
      facilityType,
      currentLevel: facility.level,
      totalInvestment,
      totalReturns,
      totalOperatingCosts,
      netROI,
      breakevenCycle,
      cyclesSincePurchase,
      isProfitable: netROI > 0,
    };
  }

  /**
   * Calculate returns from income generator facility
   */
  private async calculateIncomeGeneratorReturns(
    userId: number,
    startCycle: number,
    endCycle: number
  ): Promise<FacilityIncome> {
    const incomeEvents = await prisma.auditLog.findMany({
      where: {
        userId,
        eventType: 'passive_income',
        cycleNumber: {
          gte: startCycle,
          lte: endCycle,
        },
      },
    });

    let merchandising = 0;
    let streaming = 0;

    for (const event of incomeEvents) {
      const payload = event.payload as any;
      merchandising += payload.merchandising || 0;
      streaming += payload.streaming || 0;
    }

    return {
      merchandising,
      streaming,
      total: merchandising + streaming,
    };
  }

  /**
   * Calculate savings from discount facilities (repair_bay, training_facility, weapons_workshop)
   * This is an estimate based on the discount percentage and actual spending
   */
  private async calculateDiscountFacilityReturns(
    userId: number,
    facilityType: string,
    startCycle: number,
    endCycle: number
  ): Promise<FacilityDiscount> {
    // For discount facilities, we need to estimate savings
    // We'll look at actual transactions and calculate what the cost would have been without discount

    let totalSavings = 0;
    let transactionCount = 0;

    if (facilityType === 'repair_bay') {
      // Calculate repair cost savings
      // We need to look at repair events and calculate the discount applied
      const repairEvents = await prisma.auditLog.findMany({
        where: {
          userId,
          eventType: 'robot_repair',
          cycleNumber: {
            gte: startCycle,
            lte: endCycle,
          },
        },
      });

      for (const event of repairEvents) {
        const payload = event.payload as any;
        const actualCost = payload.cost || 0;
        const discountPercent = payload.discountPercent || 0;

        // Calculate original cost before discount
        if (discountPercent > 0) {
          const originalCost = actualCost / (1 - discountPercent / 100);
          totalSavings += originalCost - actualCost;
          transactionCount++;
        }
      }
    } else if (facilityType === 'training_facility') {
      // Calculate attribute upgrade savings
      const upgradeEvents = await prisma.auditLog.findMany({
        where: {
          userId,
          eventType: 'attribute_upgrade',
          cycleNumber: {
            gte: startCycle,
            lte: endCycle,
          },
        },
      });

      for (const event of upgradeEvents) {
        const payload = event.payload as any;
        const actualCost = payload.cost || 0;
        const discountPercent = payload.discountPercent || 0;

        if (discountPercent > 0) {
          const originalCost = actualCost / (1 - discountPercent / 100);
          totalSavings += originalCost - actualCost;
          transactionCount++;
        }
      }
    } else if (facilityType === 'weapons_workshop') {
      // Calculate weapon purchase savings
      const weaponEvents = await prisma.auditLog.findMany({
        where: {
          userId,
          eventType: 'weapon_purchase',
          cycleNumber: {
            gte: startCycle,
            lte: endCycle,
          },
        },
      });

      for (const event of weaponEvents) {
        const payload = event.payload as any;
        const actualCost = payload.cost || 0;
        const discountPercent = payload.discountPercent || 0;

        if (discountPercent > 0) {
          const originalCost = actualCost / (1 - discountPercent / 100);
          totalSavings += originalCost - actualCost;
          transactionCount++;
        }
      }
    }

    return {
      totalSavings,
      transactionCount,
    };
  }

  /**
   * Calculate total operating costs for a facility
   */
  private async calculateOperatingCosts(
    userId: number,
    facilityType: string,
    startCycle: number,
    endCycle: number
  ): Promise<number> {
    const operatingCostEvents = await prisma.auditLog.findMany({
      where: {
        userId,
        eventType: 'operating_costs',
        cycleNumber: {
          gte: startCycle,
          lte: endCycle,
        },
      },
    });

    let totalCost = 0;

    for (const event of operatingCostEvents) {
      const payload = event.payload as any;
      const costs = payload.costs || [];

      // Find the cost for this specific facility type
      const facilityCost = costs.find(
        (c: any) => c.facilityType === facilityType
      );
      if (facilityCost) {
        totalCost += facilityCost.cost || 0;
      }
    }

    return totalCost;
  }

  /**
   * Calculate the cycle where the facility breaks even
   * Returns null if not yet broken even
   */
  private async calculateBreakevenCycle(
    userId: number,
    facilityType: string,
    startCycle: number,
    endCycle: number,
    totalInvestment: number
  ): Promise<number | null> {
    // Get all relevant events sorted by cycle
    const events = await prisma.auditLog.findMany({
      where: {
        userId,
        cycleNumber: {
          gte: startCycle,
          lte: endCycle,
        },
        OR: [
          { eventType: 'passive_income' },
          { eventType: 'operating_costs' },
          { eventType: 'robot_repair' },
          { eventType: 'attribute_upgrade' },
          { eventType: 'weapon_purchase' },
        ],
      },
      orderBy: {
        cycleNumber: 'asc',
      },
    });

    let cumulativeReturns = 0;
    let cumulativeOperatingCosts = 0;

    for (const event of events) {
      const payload = event.payload as any;

      // Add returns
      if (event.eventType === 'passive_income' && facilityType === 'income_generator') {
        cumulativeReturns += (payload.merchandising || 0) + (payload.streaming || 0);
      } else if (
        event.eventType === 'robot_repair' &&
        facilityType === 'repair_bay'
      ) {
        const actualCost = payload.cost || 0;
        const discountPercent = payload.discountPercent || 0;
        if (discountPercent > 0) {
          const originalCost = actualCost / (1 - discountPercent / 100);
          cumulativeReturns += originalCost - actualCost;
        }
      } else if (
        event.eventType === 'attribute_upgrade' &&
        facilityType === 'training_facility'
      ) {
        const actualCost = payload.cost || 0;
        const discountPercent = payload.discountPercent || 0;
        if (discountPercent > 0) {
          const originalCost = actualCost / (1 - discountPercent / 100);
          cumulativeReturns += originalCost - actualCost;
        }
      } else if (
        event.eventType === 'weapon_purchase' &&
        facilityType === 'weapons_workshop'
      ) {
        const actualCost = payload.cost || 0;
        const discountPercent = payload.discountPercent || 0;
        if (discountPercent > 0) {
          const originalCost = actualCost / (1 - discountPercent / 100);
          cumulativeReturns += originalCost - actualCost;
        }
      }

      // Subtract operating costs
      if (event.eventType === 'operating_costs') {
        const costs = payload.costs || [];
        const facilityCost = costs.find(
          (c: any) => c.facilityType === facilityType
        );
        if (facilityCost) {
          cumulativeOperatingCosts += facilityCost.cost || 0;
        }
      }

      // Check if we've broken even
      const netProfit = cumulativeReturns - cumulativeOperatingCosts;
      if (netProfit >= totalInvestment) {
        return event.cycleNumber;
      }
    }

    return null; // Not yet broken even
  }

  /**
   * Calculate ROI for all facilities owned by a user
   */
  async calculateAllFacilityROIs(userId: number): Promise<FacilityROI[]> {
    const facilities = await prisma.facility.findMany({
      where: {
        userId,
        level: {
          gt: 0, // Only include purchased facilities
        },
      },
    });

    const rois: FacilityROI[] = [];

    for (const facility of facilities) {
      const roi = await this.calculateFacilityROI(userId, facility.facilityType);
      if (roi) {
        rois.push(roi);
      }
    }

    return rois;
  }
}

export const roiCalculatorService = new ROICalculatorService();
