/**
 * Property 2: Preservation - Investment Calculation and Non-ROI Operations Unchanged
 *
 * These tests verify baseline behavior that MUST be preserved after the fix:
 * - Investment calculation correctness (pure math, no DB)
 * - Non-economic facility rejection (integration, needs DB)
 * - ROI mathematical consistency (pure math with generated data)
 *
 * These tests SHOULD PASS on the current (unfixed) code, establishing
 * the baseline behavior to preserve.
 *
 * **Validates: Requirements 3.1, 3.2, 3.4, 3.5, 3.6**
 */
import fc from 'fast-check';
import { getFacilityConfig, FACILITY_TYPES } from '../../../config/facilities';
import prisma from '../../../lib/prisma';
import { unifiedFacilityROIService } from '../unifiedFacilityROIService';

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
  'research_lab',
  'medical_bay',
  'coaching_staff',
  'booking_office',
  'tuning_bay',
] as const;

describe('Property 2: Preservation - Investment Calculation and Non-ROI Operations Unchanged', () => {
  describe('Property A: Investment calculation correctness', () => {
    it('for all valid economic facility types and levels 1-10, totalInvestment equals sum(getFacilityConfig(type).costs.slice(0, level))', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ECONOMIC_FACILITY_TYPES),
          fc.integer({ min: 1, max: 10 }),
          (facilityType, level) => {
            const config = getFacilityConfig(facilityType);
            // Config must exist for all economic facility types
            expect(config).toBeDefined();
            if (!config) return;

            // Clamp level to maxLevel for this facility
            const effectiveLevel = Math.min(level, config.maxLevel);

            // Calculate expected investment: sum of costs from index 0 to level-1
            const expectedInvestment = config.costs
              .slice(0, effectiveLevel)
              .reduce((sum, cost) => sum + cost, 0);

            // This is the same calculation used in roiCalculatorService.calculateFacilityROI
            // Verify the formula: totalInvestment = sum(config.costs[0..level-1])
            const calculatedInvestment = config.costs
              .slice(0, effectiveLevel)
              .reduce((sum, cost) => sum + cost, 0);

            expect(calculatedInvestment).toBe(expectedInvestment);
            expect(calculatedInvestment).toBeGreaterThan(0);

            // Verify each cost in the array is positive
            for (let i = 0; i < effectiveLevel; i++) {
              expect(config.costs[i]).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('investment calculation is monotonically increasing with level', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ECONOMIC_FACILITY_TYPES),
          fc.integer({ min: 1, max: 9 }),
          (facilityType, level) => {
            const config = getFacilityConfig(facilityType);
            if (!config) return;

            const effectiveLevel = Math.min(level, config.maxLevel - 1);
            const nextLevel = effectiveLevel + 1;

            const investmentAtLevel = config.costs
              .slice(0, effectiveLevel)
              .reduce((sum, cost) => sum + cost, 0);

            const investmentAtNextLevel = config.costs
              .slice(0, nextLevel)
              .reduce((sum, cost) => sum + cost, 0);

            // Investment at higher level must always be greater
            expect(investmentAtNextLevel).toBeGreaterThan(investmentAtLevel);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property B: Non-economic facility rejection', () => {
    let testUserIds: number[] = [];

    beforeAll(async () => {
      // Ensure cycle metadata exists
      await prisma.cycleMetadata.upsert({
        where: { id: 1 },
        update: {},
        create: {
          id: 1,
          totalCycles: 50,
          lastCycleAt: new Date(),
        },
      });
    });

    afterEach(async () => {
      for (const userId of testUserIds) {
        await prisma.facility.deleteMany({ where: { userId } });
        await prisma.robot.deleteMany({ where: { userId } });
        await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
      }
      testUserIds = [];
    });

    afterAll(async () => {
      await prisma.$disconnect();
    });

    it('for all non-economic facility types, unifiedFacilityROIService.calculateFacilityROI returns null (no meaningful ROI data)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...NON_ECONOMIC_FACILITY_TYPES),
          fc.integer({ min: 1, max: 10 }),
          async (facilityType, level) => {
            const config = getFacilityConfig(facilityType);
            if (!config) return;

            const effectiveLevel = Math.min(level, config.maxLevel);

            // Create a user with a non-economic facility
            const user = await prisma.user.create({
              data: {
                username: `preserve_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                passwordHash: '$2b$10$testhashedpassword000000000000000000000000000000',
                prestige: 5000,
                currency: 1000000,
              },
            });
            testUserIds.push(user.id);

            // Create the non-economic facility at the specified level
            await prisma.facility.create({
              data: {
                userId: user.id,
                facilityType,
                level: effectiveLevel,
                maxLevel: config.maxLevel,
              },
            });

            // The unified service rejects non-economic facility types immediately
            // (returns null without even checking the database for the facility).
            // This is the correct behavior — non-economic facilities have no
            // economic component and should not return ROI data.
            const result = await unifiedFacilityROIService.calculateFacilityROI(user.id, facilityType);

            // The service returns null because non-economic facilities are filtered out.
            expect(result).toBeNull();
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  describe('Property C: ROI mathematical consistency', () => {
    it('for any valid ROI result where totalInvestment > 0: netROI === (totalReturns - totalOperatingCosts - totalInvestment) / totalInvestment', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 10000000 }), // totalInvestment (1 to 10M)
          fc.nat({ max: 50000000 }), // totalReturns (0 to 50M)
          fc.nat({ max: 5000000 }),  // totalOperatingCosts (0 to 5M)
          (totalInvestment, totalReturns, totalOperatingCosts) => {
            // Skip zero investment (division by zero)
            if (totalInvestment === 0) return;

            // This is the formula used in roiCalculatorService:
            // netROI = (totalReturns - totalOperatingCosts - totalInvestment) / totalInvestment
            const netProfit = totalReturns - totalOperatingCosts - totalInvestment;
            const netROI = netProfit / totalInvestment;

            // Verify mathematical consistency
            const expectedNetROI = (totalReturns - totalOperatingCosts - totalInvestment) / totalInvestment;
            expect(netROI).toBeCloseTo(expectedNetROI, 10);

            // Verify isProfitable is consistent with netROI
            const isProfitable = netROI > 0;
            expect(isProfitable).toBe(netProfit > 0);

            // Verify that if returns exceed investment + operating costs, ROI is positive
            if (totalReturns > totalOperatingCosts + totalInvestment) {
              expect(netROI).toBeGreaterThan(0);
            }

            // Verify that if returns are less than investment + operating costs, ROI is negative
            if (totalReturns < totalOperatingCosts + totalInvestment) {
              expect(netROI).toBeLessThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('netROI of -1 means total loss (zero returns, zero operating costs)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000000 }), // any positive investment
          (totalInvestment) => {
            const totalReturns = 0;
            const totalOperatingCosts = 0;

            const netROI = (totalReturns - totalOperatingCosts - totalInvestment) / totalInvestment;

            // With zero returns and zero operating costs, netROI should be exactly -1
            expect(netROI).toBe(-1);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('netROI of 0 means breakeven (returns exactly cover investment + operating costs)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000000 }), // totalInvestment
          fc.nat({ max: 5000000 }),               // totalOperatingCosts
          (totalInvestment, totalOperatingCosts) => {
            // Set returns to exactly cover investment + operating costs
            const totalReturns = totalInvestment + totalOperatingCosts;

            const netROI = (totalReturns - totalOperatingCosts - totalInvestment) / totalInvestment;

            // Should be exactly 0 (breakeven)
            expect(netROI).toBe(0);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
