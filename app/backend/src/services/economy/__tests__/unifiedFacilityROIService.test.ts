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
    },
    user: {
      findUnique: jest.fn(),
    },
    robot: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from '../../../lib/prisma';

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

describe('UnifiedFacilityROIService', () => {
  let service: UnifiedFacilityROIService;

  beforeEach(() => {
    service = new UnifiedFacilityROIService();
    jest.clearAllMocks();
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

    it('should calculate ROI for streaming_studio from snapshot data', async () => {
      setupMocksForFacility('streaming_studio', 2, [
        { userId: 1, merchandisingIncome: 0, streamingIncome: 5000, totalRepairCosts: 0, attributeUpgrades: 0, weaponPurchases: 0, operatingCosts: 200 },
        { userId: 1, merchandisingIncome: 0, streamingIncome: 8000, totalRepairCosts: 0, attributeUpgrades: 0, weaponPurchases: 0, operatingCosts: 200 },
      ]);

      const result = await service.calculateFacilityROI(1, 'streaming_studio');

      expect(result).not.toBeNull();
      expect(result!.facilityType).toBe('streaming_studio');
      expect(result!.totalReturns).toBe(13000); // 5000 + 8000
      expect(result!.dataSource).toBe('snapshot');
    });

    it('should calculate ROI for repair_bay from snapshot data', async () => {
      setupMocksForFacility('repair_bay', 2, [
        { userId: 1, merchandisingIncome: 0, streamingIncome: 0, totalRepairCosts: 10000, attributeUpgrades: 0, weaponPurchases: 0, operatingCosts: 500 },
      ]);

      const result = await service.calculateFacilityROI(1, 'repair_bay');

      expect(result).not.toBeNull();
      expect(result!.facilityType).toBe('repair_bay');
      // Repair bay calculates savings based on discount formula
      expect(result!.totalReturns).toBeGreaterThanOrEqual(0);
      expect(result!.dataSource).toBe('snapshot');
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
      expect(result!.totalReturns).toBeGreaterThan(0);
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

    it('should return null for research_lab', async () => {
      const result = await service.calculateFacilityROI(1, 'research_lab');
      expect(result).toBeNull();
    });
  });

  describe('calculateAllEconomicROIs', () => {
    it('should return exactly the owned economic facilities', async () => {
      (mockedPrisma.facility.findMany as jest.Mock).mockResolvedValue([
        { userId: 1, facilityType: 'merchandising_hub', level: 2, maxLevel: 10 },
        { userId: 1, facilityType: 'streaming_studio', level: 1, maxLevel: 10 },
      ]);

      // Mock for each calculateFacilityROI call
      (mockedPrisma.facility.findUnique as jest.Mock)
        .mockResolvedValueOnce({ userId: 1, facilityType: 'merchandising_hub', level: 2, maxLevel: 10 })
        .mockResolvedValueOnce({ userId: 1, facilityType: 'streaming_studio', level: 1, maxLevel: 10 });

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

      const result = await service.calculateAllEconomicROIs(1);

      expect(result.facilities).toHaveLength(2);
      expect(result.facilities.map((f) => f.facilityType).sort()).toEqual(
        ['merchandising_hub', 'streaming_studio'].sort()
      );
      expect(result.totals.totalInvestment).toBeGreaterThan(0);
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
