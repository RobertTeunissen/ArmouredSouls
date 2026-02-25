/**
 * Property-Based Tests for Facility ROI Calculation
 * 
 * Property 7: Facility ROI Calculation Accuracy
 * For any facility, the calculated ROI should equal:
 * (total income + total discounts - total operating costs - purchase cost) / purchase cost
 * where all values are aggregated from audit log events since purchase.
 * 
 * Validates: Requirements 5.5, 8.2
 */

import prisma from '../src/lib/prisma';
import fc from 'fast-check';
import { roiCalculatorService } from '../src/services/roiCalculatorService';
import { eventLogger } from '../src/services/eventLogger';
import { createTestUser, createTestRobot } from './testHelpers';
import { getFacilityConfig } from '../src/config/facilities';


describe('Property 7: Facility ROI Calculation Accuracy', () => {
  let testUserId: number;
  let testRobotId: number;

  beforeEach(async () => {
    const user = await createTestUser();
    testUserId = user.id;
    const robot = await createTestRobot(user.id);
    testRobotId = robot.id;
  });

  afterEach(async () => {
    // Clean up after each test in correct dependency order
    if (testUserId) {
      await prisma.auditLog.deleteMany({ where: { userId: testUserId } });
      await prisma.facility.deleteMany({ where: { userId: testUserId } });
      await prisma.battleParticipant.deleteMany({ where: { robot: { userId: testUserId } } });
      await prisma.battle.deleteMany({ where: { robot1: { userId: testUserId } } });
      await prisma.weaponInventory.deleteMany({ where: { userId: testUserId } });
      await prisma.robot.deleteMany({ where: { userId: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Property 7.1: Income Generator ROI Formula Accuracy
   * 
   * For income_generator facilities, ROI should equal:
   * (total_passive_income - total_operating_costs - total_investment) / total_investment
   */
  it('should calculate correct ROI for income generator based on passive income events', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }), // facility level (1-3 for faster tests)
        fc.integer({ min: 1, max: 10 }), // number of cycles
        fc.integer({ min: 1000, max: 20000 }), // merchandising income per cycle
        fc.integer({ min: 0, max: 10000 }), // streaming income per cycle
        fc.integer({ min: 5000, max: 15000 }), // operating cost per cycle
        async (facilityLevel, numCycles, merchandising, streaming, operatingCost) => {
          // Clean up before this property test run
          await prisma.auditLog.deleteMany({ where: { userId: testUserId } });
          await prisma.facility.deleteMany({ where: { userId: testUserId } });

          // Setup: Purchase income generator
          await prisma.facility.create({
            data: {
              userId: testUserId,
              facilityType: 'income_generator',
              level: facilityLevel,
            },
          });

          // Log purchase events
          const config = getFacilityConfig('income_generator');
          let totalInvestment = 0;
          for (let level = 0; level < facilityLevel; level++) {
            const cost = config!.costs[level];
            totalInvestment += cost;
            await eventLogger.logFacilityTransaction(
              1,
              testUserId,
              'income_generator',
              level,
              level + 1,
              cost,
              level === 0 ? 'purchase' : 'upgrade'
            );
          }

          // Log passive income and operating costs for each cycle
          let totalIncome = 0;
          let totalOperatingCosts = 0;

          for (let cycle = 1; cycle <= numCycles; cycle++) {
            await eventLogger.logPassiveIncome(
              cycle,
              testUserId,
              merchandising,
              streaming,
              facilityLevel,
              1000,
              10,
              100
            );
            totalIncome += merchandising + streaming;

            await eventLogger.logOperatingCosts(cycle, testUserId, [
              { facilityType: 'income_generator', level: facilityLevel, cost: operatingCost },
            ], operatingCost);
            totalOperatingCosts += operatingCost;
          }

          // Update cycle metadata
          await prisma.cycleMetadata.update({
            where: { id: 1 },
            data: { totalCycles: numCycles },
          });

          // Calculate ROI
          const roi = await roiCalculatorService.calculateFacilityROI(
            testUserId,
            'income_generator'
          );

          // Verify ROI calculation
          expect(roi).not.toBeNull();
          expect(roi!.totalInvestment).toBe(totalInvestment);
          expect(roi!.totalReturns).toBe(totalIncome);
          expect(roi!.totalOperatingCosts).toBe(totalOperatingCosts);

          // Expected ROI = (returns - operating costs - investment) / investment
          const expectedNetProfit = totalIncome - totalOperatingCosts - totalInvestment;
          const expectedROI = totalInvestment > 0 ? expectedNetProfit / totalInvestment : 0;

          expect(roi!.netROI).toBeCloseTo(expectedROI, 5);
          expect(roi!.isProfitable).toBe(expectedROI > 0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 7.2: Discount Facility ROI Formula Accuracy
   * 
   * For discount facilities (repair_bay, training_facility, weapons_workshop),
   * ROI should equal: (total_savings - total_operating_costs - total_investment) / total_investment
   */
  it('should calculate correct ROI for repair bay based on discount savings', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }), // facility level
        fc.integer({ min: 1, max: 10 }), // number of repair events
        fc.integer({ min: 5000, max: 20000 }), // base repair cost
        fc.integer({ min: 3000, max: 8000 }), // operating cost per cycle
        async (facilityLevel, numRepairs, baseRepairCost, operatingCost) => {
          // Clean up before this property test run
          await prisma.auditLog.deleteMany({ where: { userId: testUserId } });
          await prisma.facility.deleteMany({ where: { userId: testUserId } });

          // Setup: Purchase repair bay
          await prisma.facility.create({
            data: {
              userId: testUserId,
              facilityType: 'repair_bay',
              level: facilityLevel,
            },
          });

          // Log purchase events
          const config = getFacilityConfig('repair_bay');
          let totalInvestment = 0;
          for (let level = 0; level < facilityLevel; level++) {
            const cost = config!.costs[level];
            totalInvestment += cost;
            await eventLogger.logFacilityTransaction(
              1,
              testUserId,
              'repair_bay',
              level,
              level + 1,
              cost,
              level === 0 ? 'purchase' : 'upgrade'
            );
          }

          // Calculate discount percentage (5% per level for repair bay)
          const discountPercent = facilityLevel * 5;

          // Log repair events with discount
          let totalSavings = 0;
          let totalOperatingCosts = 0;

          for (let i = 1; i <= numRepairs; i++) {
            const actualCost = baseRepairCost * (1 - discountPercent / 100);
            const savings = baseRepairCost - actualCost;
            totalSavings += savings;

            await prisma.auditLog.create({
              data: {
                cycleNumber: i,
                eventType: 'robot_repair',
                eventTimestamp: new Date(),
                sequenceNumber: i * 100,
                userId: testUserId,
                robotId: testRobotId,
                payload: {
                  cost: actualCost,
                  discountPercent,
                  hpRestored: 50,
                },
              },
            });

            // Log operating costs
            await eventLogger.logOperatingCosts(i, testUserId, [
              { facilityType: 'repair_bay', level: facilityLevel, cost: operatingCost },
            ], operatingCost);
            totalOperatingCosts += operatingCost;
          }

          // Update cycle metadata
          await prisma.cycleMetadata.update({
            where: { id: 1 },
            data: { totalCycles: numRepairs },
          });

          // Calculate ROI
          const roi = await roiCalculatorService.calculateFacilityROI(
            testUserId,
            'repair_bay'
          );

          // Verify ROI calculation
          expect(roi).not.toBeNull();
          expect(roi!.totalInvestment).toBe(totalInvestment);
          expect(roi!.totalReturns).toBeCloseTo(totalSavings, 0);
          expect(roi!.totalOperatingCosts).toBe(totalOperatingCosts);

          // Expected ROI = (savings - operating costs - investment) / investment
          const expectedNetProfit = totalSavings - totalOperatingCosts - totalInvestment;
          const expectedROI = totalInvestment > 0 ? expectedNetProfit / totalInvestment : 0;

          expect(roi!.netROI).toBeCloseTo(expectedROI, 5);
          expect(roi!.isProfitable).toBe(expectedROI > 0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 7.3: Training Facility ROI Formula Accuracy
   */
  it('should calculate correct ROI for training facility based on upgrade discounts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }), // facility level
        fc.integer({ min: 1, max: 10 }), // number of upgrade events
        fc.integer({ min: 10000, max: 30000 }), // base upgrade cost
        fc.integer({ min: 2000, max: 6000 }), // operating cost per cycle
        async (facilityLevel, numUpgrades, baseUpgradeCost, operatingCost) => {
          // Clean up before this property test run
          await prisma.auditLog.deleteMany({ where: { userId: testUserId } });
          await prisma.facility.deleteMany({ where: { userId: testUserId } });

          // Setup: Purchase training facility
          await prisma.facility.create({
            data: {
              userId: testUserId,
              facilityType: 'training_facility',
              level: facilityLevel,
            },
          });

          // Log purchase events
          const config = getFacilityConfig('training_facility');
          let totalInvestment = 0;
          for (let level = 0; level < facilityLevel; level++) {
            const cost = config!.costs[level];
            totalInvestment += cost;
            await eventLogger.logFacilityTransaction(
              1,
              testUserId,
              'training_facility',
              level,
              level + 1,
              cost,
              level === 0 ? 'purchase' : 'upgrade'
            );
          }

          // Calculate discount percentage (5% per level for training facility)
          const discountPercent = facilityLevel * 5;

          // Log attribute upgrade events with discount
          let totalSavings = 0;
          let totalOperatingCosts = 0;

          for (let i = 1; i <= numUpgrades; i++) {
            const actualCost = baseUpgradeCost * (1 - discountPercent / 100);
            const savings = baseUpgradeCost - actualCost;
            totalSavings += savings;

            await prisma.auditLog.create({
              data: {
                cycleNumber: i,
                eventType: 'attribute_upgrade',
                eventTimestamp: new Date(),
                sequenceNumber: i * 100,
                userId: testUserId,
                robotId: testRobotId,
                payload: {
                  attributeName: 'combat_power',
                  oldValue: 5,
                  newValue: 6,
                  cost: actualCost,
                  discountPercent,
                },
              },
            });

            // Log operating costs
            await eventLogger.logOperatingCosts(i, testUserId, [
              { facilityType: 'training_facility', level: facilityLevel, cost: operatingCost },
            ], operatingCost);
            totalOperatingCosts += operatingCost;
          }

          // Update cycle metadata
          await prisma.cycleMetadata.update({
            where: { id: 1 },
            data: { totalCycles: numUpgrades },
          });

          // Calculate ROI
          const roi = await roiCalculatorService.calculateFacilityROI(
            testUserId,
            'training_facility'
          );

          // Verify ROI calculation
          expect(roi).not.toBeNull();
          expect(roi!.totalInvestment).toBe(totalInvestment);
          expect(roi!.totalReturns).toBeCloseTo(totalSavings, 0);
          expect(roi!.totalOperatingCosts).toBe(totalOperatingCosts);

          // Expected ROI = (savings - operating costs - investment) / investment
          const expectedNetProfit = totalSavings - totalOperatingCosts - totalInvestment;
          const expectedROI = totalInvestment > 0 ? expectedNetProfit / totalInvestment : 0;

          expect(roi!.netROI).toBeCloseTo(expectedROI, 5);
          expect(roi!.isProfitable).toBe(expectedROI > 0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 7.4: ROI Consistency Across Multiple Facilities
   * 
   * When a user has multiple facilities, each facility's ROI should be
   * calculated independently and correctly.
   */
  it('should calculate independent ROI for multiple facilities', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // number of cycles
        fc.integer({ min: 5000, max: 15000 }), // income per cycle
        fc.integer({ min: 3000, max: 8000 }), // repair cost per cycle
        async (numCycles, incomePerCycle, repairCostPerCycle) => {
          // Clean up before this property test run
          await prisma.auditLog.deleteMany({ where: { userId: testUserId } });
          await prisma.facility.deleteMany({ where: { userId: testUserId } });

          // Setup: Purchase both income_generator and repair_bay
          await prisma.facility.createMany({
            data: [
              { userId: testUserId, facilityType: 'income_generator', level: 1 },
              { userId: testUserId, facilityType: 'repair_bay', level: 1 },
            ],
          });

          // Log purchase events
          await eventLogger.logFacilityTransaction(
            1,
            testUserId,
            'income_generator',
            0,
            1,
            400000,
            'purchase'
          );
          await eventLogger.logFacilityTransaction(
            1,
            testUserId,
            'repair_bay',
            0,
            1,
            100000,
            'purchase'
          );

          // Track expected values
          let totalIncomeGeneratorIncome = 0;
          let totalIncomeGeneratorCosts = 0;
          let totalRepairBaySavings = 0;
          let totalRepairBayCosts = 0;

          for (let cycle = 1; cycle <= numCycles; cycle++) {
            // Log passive income
            await eventLogger.logPassiveIncome(
              cycle,
              testUserId,
              incomePerCycle,
              0,
              1,
              1000,
              10,
              100
            );
            totalIncomeGeneratorIncome += incomePerCycle;

            // Log repair with 5% discount
            const actualRepairCost = repairCostPerCycle * 0.95;
            const savings = repairCostPerCycle - actualRepairCost;
            totalRepairBaySavings += savings;

            await prisma.auditLog.create({
              data: {
                cycleNumber: cycle,
                eventType: 'robot_repair',
                eventTimestamp: new Date(),
                sequenceNumber: cycle * 1000 + 100, // Unique sequence number
                userId: testUserId,
                robotId: testRobotId,
                payload: {
                  cost: actualRepairCost,
                  discountPercent: 5,
                  hpRestored: 50,
                },
              },
            });

            // Log operating costs for both facilities
            await eventLogger.logOperatingCosts(cycle, testUserId, [
              { facilityType: 'income_generator', level: 1, cost: 7000 },
              { facilityType: 'repair_bay', level: 1, cost: 5000 },
            ], 12000);
            totalIncomeGeneratorCosts += 7000;
            totalRepairBayCosts += 5000;
          }

          // Update cycle metadata
          await prisma.cycleMetadata.update({
            where: { id: 1 },
            data: { totalCycles: numCycles },
          });

          // Calculate ROI for both facilities
          const incomeGeneratorROI = await roiCalculatorService.calculateFacilityROI(
            testUserId,
            'income_generator'
          );
          const repairBayROI = await roiCalculatorService.calculateFacilityROI(
            testUserId,
            'repair_bay'
          );

          // Verify income generator ROI
          expect(incomeGeneratorROI).not.toBeNull();
          expect(incomeGeneratorROI!.totalInvestment).toBe(400000);
          expect(incomeGeneratorROI!.totalReturns).toBe(totalIncomeGeneratorIncome);
          expect(incomeGeneratorROI!.totalOperatingCosts).toBe(totalIncomeGeneratorCosts);

          const expectedIncomeGeneratorROI =
            (totalIncomeGeneratorIncome - totalIncomeGeneratorCosts - 400000) / 400000;
          expect(incomeGeneratorROI!.netROI).toBeCloseTo(expectedIncomeGeneratorROI, 5);

          // Verify repair bay ROI
          expect(repairBayROI).not.toBeNull();
          expect(repairBayROI!.totalInvestment).toBe(100000);
          expect(repairBayROI!.totalReturns).toBeCloseTo(totalRepairBaySavings, 0);
          expect(repairBayROI!.totalOperatingCosts).toBe(totalRepairBayCosts);

          const expectedRepairBayROI =
            (totalRepairBaySavings - totalRepairBayCosts - 100000) / 100000;
          expect(repairBayROI!.netROI).toBeCloseTo(expectedRepairBayROI, 5);
        }
      ),
      { numRuns: 30 }
    );
  });
});
