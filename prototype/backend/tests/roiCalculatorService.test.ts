import { PrismaClient } from '@prisma/client';
import { roiCalculatorService } from '../src/services/roiCalculatorService';
import { eventLogger } from '../src/services/eventLogger';
import { createTestUser, createTestRobot } from './testHelpers';

const prisma = new PrismaClient();

describe('ROICalculatorService', () => {
  let testUserId: number;
  let testRobotId: number;
  let baseCycleNumber: number;
  let baseSequenceNumber: number;

  beforeEach(async () => {
    // Use unique numbers to avoid conflicts with other tests
    baseCycleNumber = 100000 + Math.floor(Math.random() * 100000);
    baseSequenceNumber = Math.floor(Math.random() * 10000);

    // Create test user
    const user = await createTestUser();
    testUserId = user.id;

    // Create test robot
    const robot = await createTestRobot(testUserId);
    testRobotId = robot.id;

    // Ensure cycle metadata exists
    await prisma.cycleMetadata.upsert({
      where: { id: 1 },
      update: { totalCycles: baseCycleNumber },
      create: {
        id: 1,
        totalCycles: baseCycleNumber,
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.auditLog.deleteMany({ 
      where: { 
        OR: [
          { userId: testUserId },
          { cycleNumber: { gte: baseCycleNumber } }
        ]
      } 
    });
    await prisma.facility.deleteMany({ where: { userId: testUserId } });
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('calculateFacilityROI', () => {
    it('should return null for facility not purchased', async () => {
      const roi = await roiCalculatorService.calculateFacilityROI(
        testUserId,
        'merchandising_hub'
      );

      expect(roi).toBeNull();
    });

    it('should calculate ROI for income generator facility', async () => {
      // Purchase income generator level 1 (cost: 400,000)
      await prisma.facility.create({
        data: {
          userId: testUserId,
          facilityType: 'merchandising_hub',
          level: 1,
        },
      });

      // Log purchase event
      await eventLogger.logFacilityTransaction(
        baseCycleNumber,
        testUserId,
        'merchandising_hub',
        0,
        baseCycleNumber,
        400000,
        'purchase'
      );

      // Log passive income for 5 cycles
      for (let i = 0; i < 5; i++) {
        const cycle = baseCycleNumber + i;
        await eventLogger.logPassiveIncome(
          cycle,
          testUserId,
          5000, // merchandising
          0, // streaming (not unlocked at level 1)
          1, // facility level
          100, // prestige
          10, // total battles
          100 // total fame
        );

        // Log operating costs
        await eventLogger.logOperatingCosts(cycle, testUserId, [
          { facilityType: 'merchandising_hub', level: 1, cost: 7000 },
        ], 7000);
      }

      // Update cycle metadata
      await prisma.cycleMetadata.update({
        where: { id: 1 },
        data: { totalCycles: baseCycleNumber + 4 },
      });

      const roi = await roiCalculatorService.calculateFacilityROI(
        testUserId,
        'merchandising_hub'
      );

      expect(roi).not.toBeNull();
      expect(roi!.facilityType).toBe('merchandising_hub');
      expect(roi!.currentLevel).toBe(1);
      expect(roi!.totalInvestment).toBe(150000); // Level 1 cost
      expect(roi!.totalReturns).toBe(25000); // 5000 * 5 cycles
      expect(roi!.totalOperatingCosts).toBe(35000); // 7000 * 5 cycles
      expect(roi!.cyclesSincePurchase).toBe(5);
      
      // Net ROI = (returns - operating costs - investment) / investment
      // = (25000 - 35000 - 150000) / 150000 = -160000 / 150000 = -1.067
      expect(roi!.netROI).toBeCloseTo(-1.067, 2);
      expect(roi!.isProfitable).toBe(false);
      expect(roi!.breakevenCycle).toBeNull(); // Not yet broken even
    });

    it('should calculate ROI for repair bay facility with discounts', async () => {
      // Purchase repair bay level 2 (costs: 100,000 + 200,000 = 300,000)
      await prisma.facility.create({
        data: {
          userId: testUserId,
          facilityType: 'repair_bay',
          level: 2,
        },
      });

      // Log purchase events
      await eventLogger.logFacilityTransaction(
        baseCycleNumber,
        testUserId,
        'repair_bay',
        0,
        baseCycleNumber,
        100000,
        'purchase'
      );
      await eventLogger.logFacilityTransaction(
        baseCycleNumber,
        testUserId,
        'repair_bay',
        baseCycleNumber,
        2,
        200000,
        'upgrade'
      );

      // Log repair events with 10% discount (level 2 repair bay)
      for (let i = 0; i < 3; i++) {
        const cycle = baseCycleNumber + i;
        // Repair cost: 10,000 with 10% discount = 9,000 actual cost
        await prisma.auditLog.create({
          data: {
            cycleNumber: cycle,
            eventType: 'robot_repair',
            eventTimestamp: new Date(),
            sequenceNumber: baseSequenceNumber + i + 1,
            userId: testUserId,
            robotId: testRobotId,
            payload: {
              cost: 9000,
              discountPercent: 10,
              hpRestored: 50,
            },
          },
        });

        // Log operating costs
        await eventLogger.logOperatingCosts(cycle, testUserId, [
          { facilityType: 'repair_bay', level: 2, cost: 5000 },
        ], 5000);
      }

      // Update cycle metadata
      await prisma.cycleMetadata.update({
        where: { id: 1 },
        data: { totalCycles: baseCycleNumber + 2 },
      });

      const roi = await roiCalculatorService.calculateFacilityROI(
        testUserId,
        'repair_bay'
      );

      expect(roi).not.toBeNull();
      expect(roi!.facilityType).toBe('repair_bay');
      expect(roi!.currentLevel).toBe(2);
      expect(roi!.totalInvestment).toBe(300000);
      expect(roi!.totalReturns).toBeCloseTo(3000, 0); // 1000 savings * 3 repairs
      expect(roi!.totalOperatingCosts).toBe(15000); // 5000 * 3 cycles
      expect(roi!.cyclesSincePurchase).toBe(3);
      
      // Net ROI = (3000 - 15000 - 300000) / 300000 = -312000 / 300000 = -1.04
      expect(roi!.netROI).toBeCloseTo(-1.04, 2);
      expect(roi!.isProfitable).toBe(false);
    });

    it('should calculate ROI for training facility with discounts', async () => {
      // Purchase training facility level 1 (cost: 150,000)
      await prisma.facility.create({
        data: {
          userId: testUserId,
          facilityType: 'training_facility',
          level: 1,
        },
      });

      // Log purchase event
      await eventLogger.logFacilityTransaction(
        baseCycleNumber,
        testUserId,
        'training_facility',
        0,
        baseCycleNumber,
        150000,
        'purchase'
      );

      // Log attribute upgrade events with 5% discount (level 1 training facility)
      for (let i = 0; i < 2; i++) {
        const cycle = baseCycleNumber + i;
        // Upgrade cost: 20,000 with 5% discount = 19,000 actual cost
        await prisma.auditLog.create({
          data: {
            cycleNumber: cycle,
            eventType: 'attribute_upgrade',
            eventTimestamp: new Date(),
            sequenceNumber: baseSequenceNumber + i + 1,
            userId: testUserId,
            robotId: testRobotId,
            payload: {
              attributeName: 'combat_power',
              oldValue: 5,
              newValue: 6,
              cost: 19000,
              discountPercent: 5,
            },
          },
        });

        // Log operating costs
        await eventLogger.logOperatingCosts(cycle, testUserId, [
          { facilityType: 'training_facility', level: 1, cost: 3000 },
        ], 3000);
      }

      // Update cycle metadata
      await prisma.cycleMetadata.update({
        where: { id: 1 },
        data: { totalCycles: baseCycleNumber + 1 },
      });

      const roi = await roiCalculatorService.calculateFacilityROI(
        testUserId,
        'training_facility'
      );

      expect(roi).not.toBeNull();
      expect(roi!.facilityType).toBe('training_facility');
      expect(roi!.currentLevel).toBe(1);
      expect(roi!.totalInvestment).toBe(150000);
      expect(roi!.totalReturns).toBeCloseTo(2000, 0); // 1000 savings * 2 upgrades
      expect(roi!.totalOperatingCosts).toBe(6000); // 3000 * 2 cycles
      expect(roi!.cyclesSincePurchase).toBe(2);
      
      // Net ROI = (2000 - 6000 - 150000) / 150000 = -154000 / 150000 ≈ -1.027
      expect(roi!.netROI).toBeCloseTo(-1.027, 2);
      expect(roi!.isProfitable).toBe(false);
    });

    it('should calculate breakeven cycle when facility becomes profitable', async () => {
      // Purchase income generator level 3 (costs: 400,000 + 600,000 + 800,000 = 1,800,000)
      await prisma.facility.create({
        data: {
          userId: testUserId,
          facilityType: 'merchandising_hub',
          level: 3,
        },
      });

      // Log purchase events
      await eventLogger.logFacilityTransaction(
        baseCycleNumber,
        testUserId,
        'merchandising_hub',
        0,
        baseCycleNumber,
        400000,
        'purchase'
      );

      // Simulate high income to reach breakeven quickly
      // Level 3 unlocks streaming, so we have both merchandising and streaming
      for (let i = 0; i < 100; i++) {
        const cycle = baseCycleNumber + i;
        await eventLogger.logPassiveIncome(
          cycle,
          testUserId,
          12000, // merchandising (level 3)
          3000, // streaming (level 3)
          3, // facility level
          1000, // prestige
          50, // total battles
          500 // total fame
        );

        // Log operating costs
        await eventLogger.logOperatingCosts(cycle, testUserId, [
          { facilityType: 'merchandising_hub', level: 3, cost: 8000 },
        ], 8000);
      }

      // Update cycle metadata
      await prisma.cycleMetadata.update({
        where: { id: 1 },
        data: { totalCycles: baseCycleNumber + 99 },
      });

      const roi = await roiCalculatorService.calculateFacilityROI(
        testUserId,
        'merchandising_hub'
      );

      expect(roi).not.toBeNull();
      expect(roi!.totalInvestment).toBe(900000); // 150k + 300k + 450k
      expect(roi!.totalReturns).toBe(1500000); // (12000 + 3000) * 100 cycles
      expect(roi!.totalOperatingCosts).toBe(800000); // 8000 * 100 cycles
      
      // Net profit = 1500000 - 800000 - 900000 = -200000 (still not profitable)
      expect(roi!.isProfitable).toBe(false);
      expect(roi!.breakevenCycle).toBeNull();
    });
  });

  describe('calculateAllFacilityROIs', () => {
    it('should calculate ROI for all purchased facilities', async () => {
      // Purchase multiple facilities
      await prisma.facility.createMany({
        data: [
          { userId: testUserId, facilityType: 'merchandising_hub', level: 1 },
          { userId: testUserId, facilityType: 'repair_bay', level: 2 },
          { userId: testUserId, facilityType: 'training_facility', level: 1 },
          { userId: testUserId, facilityType: 'roster_expansion', level: 0 }, // Not purchased
        ],
      });

      // Log purchase events
      await eventLogger.logFacilityTransaction(
        baseCycleNumber,
        testUserId,
        'merchandising_hub',
        0,
        baseCycleNumber,
        400000,
        'purchase'
      );
      await eventLogger.logFacilityTransaction(
        baseCycleNumber,
        testUserId,
        'repair_bay',
        0,
        baseCycleNumber,
        100000,
        'purchase'
      );
      await eventLogger.logFacilityTransaction(
        baseCycleNumber,
        testUserId,
        'training_facility',
        0,
        baseCycleNumber,
        150000,
        'purchase'
      );

      const rois = await roiCalculatorService.calculateAllFacilityROIs(testUserId);

      expect(rois).toHaveLength(3); // Only purchased facilities (level > 0)
      expect(rois.map(r => r.facilityType).sort()).toEqual([
        'merchandising_hub',
        'repair_bay',
        'training_facility',
      ]);
    });

    it('should return empty array when no facilities purchased', async () => {
      const rois = await roiCalculatorService.calculateAllFacilityROIs(testUserId);

      expect(rois).toHaveLength(0);
    });
  });
});
