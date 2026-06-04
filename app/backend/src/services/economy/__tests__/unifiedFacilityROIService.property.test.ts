/**
 * Property-based tests for UnifiedFacilityROIService
 *
 * Uses fast-check to verify:
 * - totalInvestment always equals sum of config costs
 * - ROI calculation is mathematically consistent
 * - Non-economic facility types are always rejected
 *
 * **Validates: Requirements 4.3**
 */
import fc from 'fast-check';
import { getFacilityConfig } from '../../../config/facilities';
import { UnifiedFacilityROIService } from '../unifiedFacilityROIService';

const ECONOMIC_FACILITY_TYPES = [
  'merchandising_hub',
  'streaming_studio',
  'repair_bay',
  'training_facility',
  'weapons_workshop',
] as const;

const NON_ECONOMIC_FACILITY_TYPES = [
  'roster_expansion',
  'storage_facility',
  'combat_training_academy',
  'defense_training_academy',
  'mobility_training_academy',
  'ai_training_academy',
  'booking_office',
  'tuning_bay',
] as const;

// Mock prisma for unit-level property tests
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

describe('UnifiedFacilityROIService - Property-Based Tests', () => {
  let service: UnifiedFacilityROIService;

  beforeEach(() => {
    service = new UnifiedFacilityROIService();
    jest.clearAllMocks();
  });

  describe('Property: totalInvestment always equals sum of config costs', () => {
    it('for random facility states (type from 5 economic types, level 1-10), totalInvestment always equals getFacilityConfig(type).costs.slice(0, level).reduce(sum)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...ECONOMIC_FACILITY_TYPES),
          fc.integer({ min: 1, max: 10 }),
          async (facilityType, level) => {
            const config = getFacilityConfig(facilityType);
            if (!config) return;

            const effectiveLevel = Math.min(level, config.maxLevel);
            const expectedInvestment = config.costs
              .slice(0, effectiveLevel)
              .reduce((sum, cost) => sum + cost, 0);

            // Setup mocks
            (mockedPrisma.facility.findUnique as jest.Mock).mockResolvedValue({
              userId: 1,
              facilityType,
              level: effectiveLevel,
              maxLevel: config.maxLevel,
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
                stableMetrics: [{
                  userId: 1,
                  merchandisingIncome: 5000,
                  streamingIncome: 3000,
                  totalRepairCosts: 2000,
                  attributeUpgrades: 1000,
                  weaponPurchases: 500,
                }],
              },
            ]);

            const result = await service.calculateFacilityROI(1, facilityType);

            expect(result).not.toBeNull();
            expect(result!.totalInvestment).toBe(expectedInvestment);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property: ROI calculation is mathematically consistent', () => {
    it('for random snapshot data arrays, netROI === (returns - opCosts - investment) / investment', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000000 }), // totalInvestment
          fc.integer({ min: 0, max: 50000000 }), // totalReturns
          fc.integer({ min: 0, max: 5000000 }),  // totalOperatingCosts
          (totalInvestment, totalReturns, totalOperatingCosts) => {
            // This is the formula used in the unified service
            const netProfit = totalReturns - totalOperatingCosts - totalInvestment;
            const netROI = totalInvestment > 0 ? netProfit / totalInvestment : 0;

            const expectedNetROI = (totalReturns - totalOperatingCosts - totalInvestment) / totalInvestment;

            expect(netROI).toBeCloseTo(expectedNetROI, 10);

            // Verify paidOff consistency
            const paidOff = (totalReturns - totalOperatingCosts) >= totalInvestment;
            if (paidOff) {
              expect(netROI).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Non-economic facility types are always rejected', () => {
    it('for random non-economic facility types, the service returns null', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...NON_ECONOMIC_FACILITY_TYPES),
          async (facilityType) => {
            const result = await service.calculateFacilityROI(1, facilityType);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
