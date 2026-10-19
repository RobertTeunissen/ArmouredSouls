/**
 * Unit tests for UnifiedFacilityROIService
 *
 * Tests correct ROI calculation, fallback behavior, purchase cycle inference,
 * paid-off calculations, economic facility filtering, and response shapes.
 *
 * Uses Jest mocking for prisma.
 */
import { UnifiedFacilityROIService } from '../unifiedFacilityROIService';
import { getFacilityConfig } from '../../../config/facilities';

// Mock prisma
jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    facility: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    cycleMetadata: {
      findUnique: jest.fn(),
    },
    cycleSnapshot: {
      findMany: jest.fn(),
    },
    auditLog: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    robot: {
      findMany: jest.fn(),
    },
  },
}));

// Recorded streaming/repair returns are DB aggregates (#542); their SQL is
// covered against PostgreSQL in facilityRoiRecordedAggregates.integration.test.ts.
jest.mock('../recorded-facility-returns-queries');

import prisma from '../../../lib/prisma';
import {
  aggregateRepairChargedByDiscount,
  aggregateStudioStreamingByMultiplier,
} from '../recorded-facility-returns-queries';

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedStreamingAggregate = aggregateStudioStreamingByMultiplier as jest.MockedFunction<
  typeof aggregateStudioStreamingByMultiplier
>;
const mockedRepairAggregate = aggregateRepairChargedByDiscount as jest.MockedFunction<
  typeof aggregateRepairChargedByDiscount
>;

describe('UnifiedFacilityROIService', () => {
  let service: UnifiedFacilityROIService;

  beforeEach(() => {
    service = new UnifiedFacilityROIService();
    jest.clearAllMocks();
    // No recorded streaming awards or repairs unless a test supplies them.
    mockedStreamingAggregate.mockResolvedValue([]);
    mockedRepairAggregate.mockResolvedValue([]);
  });

  describe('calculateFacilityROI - snapshot-based calculation', () => {
    const setupMocksForFacility = (
      facilityType: string,
      level: number,
      snapshotMetrics: Array<Record<string, unknown>>
    ) => {
      (mockedPrisma.facility.findUnique as jest.Mock).mockResolvedValue({
        userId: 1,
        facilityType,
        level,
        maxLevel: 10,
      });

      (mockedPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        totalCycles: 50,
        lastCycleAt: new Date(),
      });

      (mockedPrisma.auditLog.findFirst as jest.Mock).mockResolvedValue({
        cycleNumber: 10,
      });

      (mockedPrisma.cycleSnapshot.findMany as jest.Mock).mockResolvedValue(
        snapshotMetrics.map((m, i) => ({
          cycleNumber: 10 + i,
          stableMetrics: [m],
        }))
      );
    };

    it('should calculate ROI for merchandising_hub from snapshot data', async () => {
      setupMocksForFacility('merchandising_hub', 3, [
        { userId: 1, merchandisingIncome: 15000, streamingIncome: 0, totalRepairCosts: 0, attributeUpgrades: 0, weaponPurchases: 0, operatingCosts: 600 },
        { userId: 1, merchandisingIncome: 15000, streamingIncome: 0, totalRepairCosts: 0, attributeUpgrades: 0, weaponPurchases: 0, operatingCosts: 600 },
      ]);

      const result = await service.calculateFacilityROI(1, 'merchandising_hub');

      expect(result).not.toBeNull();
      expect(result!.facilityType).toBe('merchandising_hub');
      expect(result!.currentLevel).toBe(3);
      expect(result!.totalReturns).toBe(30000); // 15000 * 2
      expect(result!.dataSource).toBe('snapshot');
    });

    it('should calculate streaming_studio returns from the studio share of recorded awards', async () => {
      setupMocksForFacility('streaming_studio', 2, [
        { userId: 1, merchandisingIncome: 0, streamingIncome: 5000, totalRepairCosts: 0, attributeUpgrades: 0, weaponPurchases: 0, operatingCosts: 200 },
        { userId: 1, merchandisingIncome: 0, streamingIncome: 8000, totalRepairCosts: 0, attributeUpgrades: 0, weaponPurchases: 0, operatingCosts: 200 },
      ]);
      mockedStreamingAggregate.mockResolvedValue([
        // v1 row 2,000 + v2 row 4,000, both at ×2: 6,000 × (1 − 1/2) = 3,000
        { studioMultiplier: 2, amountSum: 6000 },
      ]);

      const result = await service.calculateFacilityROI(1, 'streaming_studio');

      expect(result).not.toBeNull();
      expect(result!.facilityType).toBe('streaming_studio');
      // Snapshot streamingIncome (13,000) includes base streaming earned without
      // any studio, so it is not the studio's return.
      expect(result!.totalReturns).toBe(3000);
      expect(result!.dataSource).toBe('snapshot');
      expect(mockedStreamingAggregate).toHaveBeenCalledWith(1, 10, 50);
    });

    it('should calculate repair_bay savings from each recorded repair\'s own discount', async () => {
      // Current level 2 (12% today), but the rows were recorded at 36% and 48%
      // under the old robot-count formula. Savings use the recorded figures.
      setupMocksForFacility('repair_bay', 2, [
        { userId: 1, merchandisingIncome: 0, streamingIncome: 0, totalRepairCosts: 10000, attributeUpgrades: 0, weaponPurchases: 0, operatingCosts: 500 },
      ]);
      mockedRepairAggregate.mockResolvedValue([
        // 6,400 × 36 / 64 = 3,600
        { discountPercent: 36, chargedSum: 6400 },
        // 5,200 × 48 / 52 = 4,800
        { discountPercent: 48, chargedSum: 5200 },
      ]);

      const result = await service.calculateFacilityROI(1, 'repair_bay');

      expect(result).not.toBeNull();
      expect(result!.facilityType).toBe('repair_bay');
      expect(result!.totalReturns).toBe(8400);
      expect(result!.dataSource).toBe('snapshot');
      expect(mockedRepairAggregate).toHaveBeenCalledWith(1, 10, 50);
      // Robot count is no longer an input to historical savings.
      expect(mockedPrisma.robot.findMany).not.toHaveBeenCalled();
    });

    it('should calculate ROI for training_facility from snapshot data', async () => {
      setupMocksForFacility('training_facility', 3, [
        { userId: 1, merchandisingIncome: 0, streamingIncome: 0, totalRepairCosts: 0, attributeUpgrades: 20000, weaponPurchases: 0, operatingCosts: 750 },
      ]);

      const result = await service.calculateFacilityROI(1, 'training_facility');

      expect(result).not.toBeNull();
      expect(result!.facilityType).toBe('training_facility');
      expect(result!.totalReturns).toBeGreaterThan(0);
      expect(result!.dataSource).toBe('snapshot');
    });

    it('uses the purchased roster capacity for training_facility savings (#526)', async () => {
      setupMocksForFacility('training_facility', 6, [
        { userId: 1, merchandisingIncome: 0, streamingIncome: 0, totalRepairCosts: 0, attributeUpgrades: 59500, weaponPurchases: 0, operatingCosts: 1500 },
      ]);
      // Training Facility L6; roster_expansion L0 → capacity 1 → 6 × 9 × 0.75 = 40.5%.
      (mockedPrisma.facility.findUnique as jest.Mock).mockImplementation(
        ({ where }: { where: { userId_facilityType: { facilityType: string } } }) =>
          Promise.resolve(
            where.userId_facilityType.facilityType === 'roster_expansion'
              ? { level: 0 }
              : { userId: 1, facilityType: 'training_facility', level: 6, maxLevel: 10 },
          ),
      );

      const oneSlot = await service.calculateFacilityROI(1, 'training_facility');
      // 59,500 spent at 40.5% off → saved 59,500 × 40.5 / 59.5 = 40,500
      expect(oneSlot!.totalReturns).toBe(40500);

      // Same spend with roster_expansion L5 → capacity 6 → 6 × 4 × 0.75 = 18%.
      (mockedPrisma.facility.findUnique as jest.Mock).mockImplementation(
        ({ where }: { where: { userId_facilityType: { facilityType: string } } }) =>
          Promise.resolve(
            where.userId_facilityType.facilityType === 'roster_expansion'
              ? { level: 5 }
              : { userId: 1, facilityType: 'training_facility', level: 6, maxLevel: 10 },
          ),
      );
      const sixSlots = await service.calculateFacilityROI(1, 'training_facility');
      // 59,500 × 18 / 82 = 13,060.97… → 13,061 (the old formula credited 60%: 89,250)
      expect(sixSlots!.totalReturns).toBe(13061);
    });

    it('should calculate ROI for weapons_workshop from snapshot data', async () => {
      setupMocksForFacility('weapons_workshop', 4, [
        { userId: 1, merchandisingIncome: 0, streamingIncome: 0, totalRepairCosts: 0, attributeUpgrades: 0, weaponPurchases: 50000, operatingCosts: 400 },
      ]);

      const result = await service.calculateFacilityROI(1, 'weapons_workshop');

      expect(result).not.toBeNull();
      expect(result!.facilityType).toBe('weapons_workshop');
      expect(result!.totalReturns).toBeGreaterThan(0);
      expect(result!.dataSource).toBe('snapshot');
    });
  });

  describe('calculateFacilityROI - fallback to formula-based estimates', () => {
    it('should use formula-based estimates when no snapshots exist', async () => {
      (mockedPrisma.facility.findUnique as jest.Mock).mockResolvedValue({
        userId: 1,
        facilityType: 'merchandising_hub',
        level: 2,
        maxLevel: 10,
      });

      (mockedPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        totalCycles: 30,
        lastCycleAt: new Date(),
      });

      (mockedPrisma.auditLog.findFirst as jest.Mock).mockResolvedValue({
        cycleNumber: 5,
      });

      // No snapshots
      (mockedPrisma.cycleSnapshot.findMany as jest.Mock).mockResolvedValue([]);

      // For merchandising fallback, user prestige is needed
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        prestige: 5000,
      });

      const result = await service.calculateFacilityROI(1, 'merchandising_hub');

      expect(result).not.toBeNull();
      expect(result!.dataSource).toBe('estimate');
      expect(result!.totalReturns).toBeGreaterThan(0);
    });

    it('should use formula-based estimates for repair_bay when no snapshots exist', async () => {
      (mockedPrisma.facility.findUnique as jest.Mock).mockResolvedValue({
        userId: 1,
        facilityType: 'repair_bay',
        level: 3,
        maxLevel: 10,
      });

      (mockedPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        totalCycles: 40,
        lastCycleAt: new Date(),
      });

      (mockedPrisma.auditLog.findFirst as jest.Mock).mockResolvedValue(null);

      // No snapshots
      (mockedPrisma.cycleSnapshot.findMany as jest.Mock).mockResolvedValue([]);

      // For repair bay fallback, robot count is needed
      (mockedPrisma.robot.findMany as jest.Mock).mockResolvedValue([
        { id: 1 },
        { id: 2 },
      ]);

      const result = await service.calculateFacilityROI(1, 'repair_bay');

      expect(result).not.toBeNull();
      expect(result!.dataSource).toBe('estimate');
      // Purchase cycle falls back to 1, so 40 cycles owned. Volume estimate
      // 2 robots × 5,000 = 10,000/cycle; Level 3 = 18% (6% per level, #525):
      // 10,000 × 0.18 × 40 = 72,000.
      expect(result!.cyclesSincePurchase).toBe(40);
      expect(result!.totalReturns).toBe(72000);
    });

    it('should estimate streaming_studio returns as the studio increment only', async () => {
      (mockedPrisma.facility.findUnique as jest.Mock).mockResolvedValue({
        userId: 1,
        facilityType: 'streaming_studio',
        level: 4,
        maxLevel: 10,
      });
      (mockedPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        totalCycles: 30,
        lastCycleAt: new Date(),
      });
      (mockedPrisma.auditLog.findFirst as jest.Mock).mockResolvedValue({ cycleNumber: 21 });
      (mockedPrisma.cycleSnapshot.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.calculateFacilityROI(1, 'streaming_studio');

      // 500 more per battle per level × 4 levels × 3 battles × 10 cycles (21..30)
      expect(result!.dataSource).toBe('estimate');
      expect(result!.cyclesSincePurchase).toBe(10);
      expect(result!.totalReturns).toBe(500 * 4 * 3 * 10);
    });

    it('should estimate training_facility returns at the stable\'s roster capacity (#526)', async () => {
      // Training Facility L10, roster_expansion L3 → capacity 4 → 10 × 6 × 0.75 = 45%.
      (mockedPrisma.facility.findUnique as jest.Mock).mockImplementation(
        ({ where }: { where: { userId_facilityType: { facilityType: string } } }) =>
          Promise.resolve(
            where.userId_facilityType.facilityType === 'roster_expansion'
              ? { level: 3 }
              : { userId: 1, facilityType: 'training_facility', level: 10, maxLevel: 10 },
          ),
      );
      (mockedPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        totalCycles: 30,
        lastCycleAt: new Date(),
      });
      (mockedPrisma.auditLog.findFirst as jest.Mock).mockResolvedValue({ cycleNumber: 21 });
      (mockedPrisma.cycleSnapshot.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.calculateFacilityROI(1, 'training_facility');

      // 10,000 upgrade spend per cycle × 45% × 10 cycles (the old capacity-blind
      // estimate used 90%: 90,000)
      expect(result!.dataSource).toBe('estimate');
      expect(result!.totalReturns).toBe(45000);
    });
  });

  describe('calculateAllEconomicROIs - training_facility', () => {
    it('should apply the purchased roster capacity on the shared-data path (#526)', async () => {
      (mockedPrisma.facility.findMany as jest.Mock).mockResolvedValue([
        { userId: 1, facilityType: 'training_facility', level: 10, maxLevel: 10 },
      ]);
      (mockedPrisma.facility.findUnique as jest.Mock).mockImplementation(
        ({ where }: { where: { userId_facilityType: { facilityType: string } } }) =>
          Promise.resolve(
            where.userId_facilityType.facilityType === 'roster_expansion'
              ? { level: 3 }
              : null,
          ),
      );
      (mockedPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        totalCycles: 20,
        lastCycleAt: new Date(),
      });
      (mockedPrisma.auditLog.findFirst as jest.Mock).mockResolvedValue({ cycleNumber: 5 });
      (mockedPrisma.cycleSnapshot.findMany as jest.Mock).mockResolvedValue([
        {
          cycleNumber: 5,
          stableMetrics: [{ userId: 1, merchandisingIncome: 0, streamingIncome: 0, attributeUpgrades: 55000, weaponPurchases: 0 }],
        },
      ]);

      const result = await service.calculateAllEconomicROIs(1);

      // Capacity 4 at L10 → 45%: 55,000 × 45 / 55 = 45,000 (capacity-blind 90%: 495,000)
      expect(result.facilities).toHaveLength(1);
      expect(result.facilities[0].totalReturns).toBe(45000);
    });
  });

  describe('calculateFacilityROI - purchase cycle inference', () => {
    it('should use audit event cycle when available', async () => {
      (mockedPrisma.facility.findUnique as jest.Mock).mockResolvedValue({
        userId: 1,
        facilityType: 'merchandising_hub',
        level: 1,
        maxLevel: 10,
      });

      (mockedPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        totalCycles: 50,
        lastCycleAt: new Date(),
      });

      (mockedPrisma.auditLog.findFirst as jest.Mock).mockResolvedValue({
        cycleNumber: 20,
      });

      (mockedPrisma.cycleSnapshot.findMany as jest.Mock).mockResolvedValue([
        {
          cycleNumber: 20,
          stableMetrics: [{ userId: 1, merchandisingIncome: 5000, streamingIncome: 0, totalRepairCosts: 0, attributeUpgrades: 0, weaponPurchases: 0 }],
        },
      ]);

      const result = await service.calculateFacilityROI(1, 'merchandising_hub');

      expect(result).not.toBeNull();
      // cyclesSincePurchase = 50 - 20 + 1 = 31
      expect(result!.cyclesSincePurchase).toBe(31);
    });

    it('should fallback to earliest snapshot when no audit event exists', async () => {
      (mockedPrisma.facility.findUnique as jest.Mock).mockResolvedValue({
        userId: 1,
        facilityType: 'merchandising_hub',
        level: 1,
        maxLevel: 10,
      });

      (mockedPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        totalCycles: 50,
        lastCycleAt: new Date(),
      });

      // No audit event
      (mockedPrisma.auditLog.findFirst as jest.Mock).mockResolvedValue(null);

      // First call for determinePurchaseCycle (findEarliestSnapshotWithActivity)
      // Second call for getting user metrics
      (mockedPrisma.cycleSnapshot.findMany as jest.Mock)
        .mockResolvedValueOnce([
          {
            cycleNumber: 15,
            stableMetrics: [{ userId: 1, merchandisingIncome: 5000, streamingIncome: 0, totalRepairCosts: 0, attributeUpgrades: 0, weaponPurchases: 0 }],
          },
          {
            cycleNumber: 20,
            stableMetrics: [{ userId: 1, merchandisingIncome: 5000, streamingIncome: 0, totalRepairCosts: 0, attributeUpgrades: 0, weaponPurchases: 0 }],
          },
        ])
        .mockResolvedValueOnce([
          {
            cycleNumber: 15,
            stableMetrics: [{ userId: 1, merchandisingIncome: 5000, streamingIncome: 0, totalRepairCosts: 0, attributeUpgrades: 0, weaponPurchases: 0 }],
          },
          {
            cycleNumber: 20,
            stableMetrics: [{ userId: 1, merchandisingIncome: 5000, streamingIncome: 0, totalRepairCosts: 0, attributeUpgrades: 0, weaponPurchases: 0 }],
          },
        ]);

      const result = await service.calculateFacilityROI(1, 'merchandising_hub');

      expect(result).not.toBeNull();
      // Should use earliest snapshot cycle (15), so cyclesSincePurchase = 50 - 15 + 1 = 36
      expect(result!.cyclesSincePurchase).toBe(36);
    });

    it('should fallback to cycle 1 when no audit event and no snapshots', async () => {
      (mockedPrisma.facility.findUnique as jest.Mock).mockResolvedValue({
        userId: 1,
        facilityType: 'merchandising_hub',
        level: 1,
        maxLevel: 10,
      });

      (mockedPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        totalCycles: 50,
        lastCycleAt: new Date(),
      });

      (mockedPrisma.auditLog.findFirst as jest.Mock).mockResolvedValue(null);

      // No snapshots at all
      (mockedPrisma.cycleSnapshot.findMany as jest.Mock).mockResolvedValue([]);

      // For merchandising fallback
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        prestige: 1000,
      });

      const result = await service.calculateFacilityROI(1, 'merchandising_hub');

      expect(result).not.toBeNull();
      // Fallback to cycle 1, so cyclesSincePurchase = 50 - 1 + 1 = 50
      expect(result!.cyclesSincePurchase).toBe(50);
    });
  });

  describe('calculateFacilityROI - paidOff and projectedPayoffCycles', () => {
    it('should mark facility as paid off when returns exceed investment + operating costs', async () => {
      (mockedPrisma.facility.findUnique as jest.Mock).mockResolvedValue({
        userId: 1,
        facilityType: 'merchandising_hub',
        level: 1,
        maxLevel: 10,
      });

      (mockedPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        totalCycles: 100,
        lastCycleAt: new Date(),
      });

      (mockedPrisma.auditLog.findFirst as jest.Mock).mockResolvedValue({
        cycleNumber: 1,
      });

      // 100 cycles of merchandising income at 15000/cycle = 1,500,000
      // Investment for level 1 = 150,000
      // Operating costs = 200 * 100 = 20,000
      const snapshots = Array.from({ length: 100 }, (_, i) => ({
        cycleNumber: i + 1,
        stableMetrics: [{ userId: 1, merchandisingIncome: 15000, streamingIncome: 0, totalRepairCosts: 0, attributeUpgrades: 0, weaponPurchases: 0 }],
      }));

      (mockedPrisma.cycleSnapshot.findMany as jest.Mock).mockResolvedValue(snapshots);

      const result = await service.calculateFacilityROI(1, 'merchandising_hub');

      expect(result).not.toBeNull();
      expect(result!.paidOff).toBe(true);
      expect(result!.projectedPayoffCycles).toBeNull();
    });

    it('should calculate projectedPayoffCycles when not paid off', async () => {
      (mockedPrisma.facility.findUnique as jest.Mock).mockResolvedValue({
        userId: 1,
        facilityType: 'merchandising_hub',
        level: 3,
        maxLevel: 10,
      });

      (mockedPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        totalCycles: 5,
        lastCycleAt: new Date(),
      });

      (mockedPrisma.auditLog.findFirst as jest.Mock).mockResolvedValue({
        cycleNumber: 1,
      });

      // 5 cycles of income at 15000/cycle = 75,000
      // Investment for level 3 = 150000 + 300000 + 450000 = 900,000
      // Operating costs = 600 * 5 = 3,000
      const snapshots = Array.from({ length: 5 }, (_, i) => ({
        cycleNumber: i + 1,
        stableMetrics: [{ userId: 1, merchandisingIncome: 15000, streamingIncome: 0, totalRepairCosts: 0, attributeUpgrades: 0, weaponPurchases: 0 }],
      }));

      (mockedPrisma.cycleSnapshot.findMany as jest.Mock).mockResolvedValue(snapshots);

      const result = await service.calculateFacilityROI(1, 'merchandising_hub');

      expect(result).not.toBeNull();
      expect(result!.paidOff).toBe(false);
      expect(result!.projectedPayoffCycles).toBeGreaterThan(0);
    });
  });

  describe('calculateFacilityROI - non-economic facility rejection', () => {
    it('should return null for roster_expansion', async () => {
      const result = await service.calculateFacilityROI(1, 'roster_expansion');
      expect(result).toBeNull();
    });

    it('should return null for storage_facility', async () => {
      const result = await service.calculateFacilityROI(1, 'storage_facility');
      expect(result).toBeNull();
    });

    it('should return null for combat_training_academy', async () => {
      const result = await service.calculateFacilityROI(1, 'combat_training_academy');
      expect(result).toBeNull();
    });

    it('should return null for tuning_bay', async () => {
      const result = await service.calculateFacilityROI(1, 'tuning_bay');
      expect(result).toBeNull();
    });
  });

  describe('calculateAllEconomicROIs', () => {
    it('should return exactly the owned economic facilities', async () => {
      (mockedPrisma.facility.findMany as jest.Mock).mockResolvedValue([
        { userId: 1, facilityType: 'merchandising_hub', level: 2, maxLevel: 10 },
        { userId: 1, facilityType: 'streaming_studio', level: 1, maxLevel: 10 },
      ]);

      // Routed on facilityType rather than queued with mockResolvedValueOnce.
      // Merchandising ROI also looks up `roster_expansion` (Spec #46 R2), so the
      // number of findUnique calls is no longer one per facility. A queue that is
      // not fully drained survives `jest.clearAllMocks()` — which clears calls but
      // not queued once-values — and the leftover entry was being returned to the
      // next test in the file, where it reported a facility level of 2 for a
      // fixture that said 1.
      (mockedPrisma.facility.findUnique as jest.Mock).mockImplementation(
        ({ where }: { where: { userId_facilityType: { facilityType: string } } }) => {
          const type = where.userId_facilityType.facilityType;
          const levels: Record<string, number> = {
            merchandising_hub: 2,
            streaming_studio: 1,
            roster_expansion: 0,
          };
          if (!(type in levels)) return Promise.resolve(null);
          return Promise.resolve({ userId: 1, facilityType: type, level: levels[type], maxLevel: 10 });
        },
      );

      (mockedPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        totalCycles: 20,
        lastCycleAt: new Date(),
      });

      (mockedPrisma.auditLog.findFirst as jest.Mock).mockResolvedValue({
        cycleNumber: 5,
      });

      (mockedPrisma.cycleSnapshot.findMany as jest.Mock).mockResolvedValue([
        {
          cycleNumber: 5,
          stableMetrics: [{ userId: 1, merchandisingIncome: 10000, streamingIncome: 3000, totalRepairCosts: 0, attributeUpgrades: 0, weaponPurchases: 0 }],
        },
      ]);

      // The aggregate is scoped to the ownership window [5, 20] in SQL, so the
      // pre-purchase award is never returned. Inside the window at L1 (×1.5):
      // 1,500 × (1 − 1/1.5) = 500
      mockedStreamingAggregate.mockResolvedValue([{ studioMultiplier: 1.5, amountSum: 1500 }]);

      const result = await service.calculateAllEconomicROIs(1);

      expect(result.facilities).toHaveLength(2);
      expect(result.facilities.map((f) => f.facilityType).sort()).toEqual(
        ['merchandising_hub', 'streaming_studio'].sort()
      );
      expect(result.totals.totalInvestment).toBeGreaterThan(0);

      const studio = result.facilities.find((f) => f.facilityType === 'streaming_studio');
      expect(studio!.totalReturns).toBe(500);
      // One aggregate for the studio, over its own ownership window.
      expect(mockedStreamingAggregate).toHaveBeenCalledTimes(1);
      expect(mockedStreamingAggregate).toHaveBeenCalledWith(1, 5, 20);
      expect(mockedRepairAggregate).not.toHaveBeenCalled();
    });
  });

  describe('calculateAllEconomicROIs - repair_bay', () => {
    it('should aggregate recorded repairs once over the ownership window', async () => {
      (mockedPrisma.facility.findMany as jest.Mock).mockResolvedValue([
        { userId: 1, facilityType: 'repair_bay', level: 1, maxLevel: 10 },
      ]);
      (mockedPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        totalCycles: 20,
        lastCycleAt: new Date(),
      });
      (mockedPrisma.auditLog.findFirst as jest.Mock).mockResolvedValue({ cycleNumber: 5 });
      (mockedPrisma.cycleSnapshot.findMany as jest.Mock).mockResolvedValue([
        {
          cycleNumber: 5,
          stableMetrics: [{ userId: 1, merchandisingIncome: 0, streamingIncome: 0, cycleRepairCreditsPaid: 9000, attributeUpgrades: 0, weaponPurchases: 0 }],
        },
      ]);
      // Scoped to the ownership window [5, 20] in SQL; the pre-purchase repair
      // is never returned.
      mockedRepairAggregate.mockResolvedValue([
        // 6,400 × 36 / 64 = 3,600
        { discountPercent: 36, chargedSum: 6400 },
        // 5,200 × 48 / 52 = 4,800
        { discountPercent: 48, chargedSum: 5200 },
      ]);

      const result = await service.calculateAllEconomicROIs(1);

      expect(result.facilities).toHaveLength(1);
      expect(result.facilities[0].facilityType).toBe('repair_bay');
      expect(result.facilities[0].totalReturns).toBe(8400);
      expect(mockedRepairAggregate).toHaveBeenCalledTimes(1);
      expect(mockedRepairAggregate).toHaveBeenCalledWith(1, 5, 20);
      expect(mockedStreamingAggregate).not.toHaveBeenCalled();
      expect(mockedPrisma.robot.findMany).not.toHaveBeenCalled();
    });
  });

  describe('calculateProjectedROI', () => {
    it('should return correct response shape', async () => {
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        currency: 5000000,
        prestige: 5000,
      });

      (mockedPrisma.facility.findUnique as jest.Mock).mockResolvedValue({
        userId: 1,
        facilityType: 'merchandising_hub',
        level: 1,
        maxLevel: 10,
      });

      const result = await service.calculateProjectedROI(1, 'merchandising_hub', 3);

      expect(result).toHaveProperty('currentLevel', 1);
      expect(result).toHaveProperty('targetLevel', 3);
      expect(result).toHaveProperty('upgradeCost');
      expect(result).toHaveProperty('dailyCostIncrease');
      expect(result).toHaveProperty('dailyBenefitIncrease');
      expect(result).toHaveProperty('netDailyChange');
      expect(result).toHaveProperty('breakevenDays');
      expect(result).toHaveProperty('net30Days');
      expect(result).toHaveProperty('net90Days');
      expect(result).toHaveProperty('net180Days');
      expect(result).toHaveProperty('affordable');
      expect(result).toHaveProperty('recommendation');
      expect(result).toHaveProperty('recommendationType');
      expect(result.affordable).toBe(true);
      expect(result.upgradeCost).toBeGreaterThan(0);
    });
  });

  describe('totalInvestment calculation', () => {
    it('should correctly calculate totalInvestment from facility config costs', async () => {
      const facilityType = 'merchandising_hub';
      const level = 5;

      (mockedPrisma.facility.findUnique as jest.Mock).mockResolvedValue({
        userId: 1,
        facilityType,
        level,
        maxLevel: 10,
      });

      (mockedPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        totalCycles: 50,
        lastCycleAt: new Date(),
      });

      (mockedPrisma.auditLog.findFirst as jest.Mock).mockResolvedValue({
        cycleNumber: 1,
      });

      (mockedPrisma.cycleSnapshot.findMany as jest.Mock).mockResolvedValue([
        {
          cycleNumber: 1,
          stableMetrics: [{ userId: 1, merchandisingIncome: 25000, streamingIncome: 0, totalRepairCosts: 0, attributeUpgrades: 0, weaponPurchases: 0 }],
        },
      ]);

      const result = await service.calculateFacilityROI(1, facilityType);

      const config = getFacilityConfig(facilityType)!;
      const expectedInvestment = config.costs.slice(0, level).reduce((sum, cost) => sum + cost, 0);

      expect(result).not.toBeNull();
      expect(result!.totalInvestment).toBe(expectedInvestment);
    });
  });
});
