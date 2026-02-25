import prisma from '../src/lib/prisma';
import { facilityRecommendationService } from '../src/services/facilityRecommendationService';
import { createTestUser, createTestRobot } from './testHelpers';


describe('FacilityRecommendationService', () => {
  let testUserIds: number[] = [];

  beforeEach(async () => {
    testUserIds = [];
    
    // Ensure cycle metadata exists
    await prisma.cycleMetadata.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        totalCycles: 10,
        lastCycleAt: new Date(),
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    for (const userId of testUserIds) {
      await prisma.auditLog.deleteMany({ where: { userId } });
      await prisma.facility.deleteMany({ where: { userId } });
      await prisma.robot.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('generateRecommendations', () => {
    it('should recommend facilities with positive ROI', async () => {
      // Setup: Create user with sufficient currency and prestige
      const user = await createTestUser();
      testUserIds.push(user.id);
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          currency: 1000000,
          prestige: 5000,
        },
      });

      // Update cycle metadata
      await prisma.cycleMetadata.update({
        where: { id: 1 },
        data: { totalCycles: 10 },
      });

      // Create facilities with level 0 (not purchased)
      // Note: We don't need to create all facilities - the service will check all FACILITY_TYPES
      await prisma.facility.createMany({
        data: [
          { userId: user.id, facilityType: 'income_generator', level: 0 },
          { userId: user.id, facilityType: 'repair_bay', level: 0 },
          { userId: user.id, facilityType: 'training_facility', level: 0 },
          { userId: user.id, facilityType: 'weapons_workshop', level: 0 },
          { userId: user.id, facilityType: 'roster_expansion', level: 0 },
          { userId: user.id, facilityType: 'storage_facility', level: 0 },
          { userId: user.id, facilityType: 'combat_training_academy', level: 0 },
          { userId: user.id, facilityType: 'defense_training_academy', level: 0 },
          { userId: user.id, facilityType: 'mobility_training_academy', level: 0 },
          { userId: user.id, facilityType: 'ai_training_academy', level: 0 },
        ],
      });

      // Execute
      const result = await facilityRecommendationService.generateRecommendations(
        user.id,
        10
      );

      // Verify: Should have some recommendations (training academies, roster expansion, storage)
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.userCurrency).toBe(1000000);
      expect(result.userPrestige).toBe(5000);
      expect(result.analysisWindow.cycleCount).toBe(10);

      // All recommendations should have ROI >= 0 (includes strategic value recommendations)
      for (const rec of result.recommendations) {
        expect(rec.projectedROI).toBeGreaterThanOrEqual(0);
      }
    });

    it('should recommend repair bay for user with high repair costs', async () => {
      // Setup: Create user
      const user = await createTestUser();
      testUserIds.push(user.id);
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          currency: 500000,
          prestige: 2000,
        },
      });

      // Update cycle metadata
      await prisma.cycleMetadata.update({
        where: { id: 1 },
        data: { totalCycles: 20 },
      });

      // Create facilities
      await prisma.facility.createMany({
        data: [
          { userId: user.id, facilityType: 'repair_bay', level: 0 },
          { userId: user.id, facilityType: 'income_generator', level: 0 },
        ],
      });

      // Create repair events with high costs
      for (let cycle = 11; cycle <= 20; cycle++) {
        await prisma.auditLog.create({
          data: {
            cycleNumber: cycle,
            eventType: 'robot_repair',
            eventTimestamp: new Date(),
            sequenceNumber: cycle,
            userId: user.id,
            payload: {
              cost: 50000, // High repair cost
              robotId: 1,
            },
          },
        });
      }

      // Execute
      const result = await facilityRecommendationService.generateRecommendations(
        user.id,
        10
      );

      // Verify: Repair bay should be recommended
      const repairBayRec = result.recommendations.find(
        (r) => r.facilityType === 'repair_bay'
      );
      expect(repairBayRec).toBeDefined();
      if (repairBayRec) {
        expect(repairBayRec.projectedROI).toBeGreaterThanOrEqual(0);
        // Reason might be empty if no repair history or savings calculated
        expect(repairBayRec.reason).toBeDefined();
      }
    });

    it('should rank recommendations by projected ROI', async () => {
      // Setup: Create user
      const user = await createTestUser();
      testUserIds.push(user.id);
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          currency: 2000000,
          prestige: 10000,
        },
      });

      // Update cycle metadata
      await prisma.cycleMetadata.update({
        where: { id: 1 },
        data: { totalCycles: 30 },
      });

      // Create facilities
      await prisma.facility.createMany({
        data: [
          { userId: user.id, facilityType: 'income_generator', level: 0 },
          { userId: user.id, facilityType: 'repair_bay', level: 0 },
          { userId: user.id, facilityType: 'training_facility', level: 0 },
        ],
      });

      // Create various activity events
      for (let cycle = 21; cycle <= 30; cycle++) {
        // Repair events
        await prisma.auditLog.create({
          data: {
            cycleNumber: cycle,
            eventType: 'robot_repair',
            eventTimestamp: new Date(),
            sequenceNumber: cycle * 10,
            userId: user.id,
            payload: { cost: 40000, robotId: 1 },
          },
        });

        // Upgrade events
        await prisma.auditLog.create({
          data: {
            cycleNumber: cycle,
            eventType: 'attribute_upgrade',
            eventTimestamp: new Date(),
            sequenceNumber: cycle * 10 + 1,
            userId: user.id,
            payload: { cost: 25000, robotId: 1, attributeName: 'combatSystems' },
          },
        });
      }

      // Execute
      const result = await facilityRecommendationService.generateRecommendations(
        user.id,
        10
      );

      // Verify: Recommendations should be sorted by ROI (highest first)
      expect(result.recommendations.length).toBeGreaterThan(1);
      
      for (let i = 0; i < result.recommendations.length - 1; i++) {
        expect(result.recommendations[i].projectedROI).toBeGreaterThanOrEqual(
          result.recommendations[i + 1].projectedROI
        );
      }
    });

    it('should not recommend facilities above user prestige level', async () => {
      // Setup: Create user with low prestige
      const user = await createTestUser();
      testUserIds.push(user.id);
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          currency: 5000000,
          prestige: 500, // Low prestige
        },
      });

      // Update cycle metadata
      await prisma.cycleMetadata.update({
        where: { id: 1 },
        data: { totalCycles: 10 },
      });

      // Create facilities at level 3 (next level requires 1000 prestige for some facilities)
      await prisma.facility.createMany({
        data: [
          { userId: user.id, facilityType: 'repair_bay', level: 3 },
          { userId: user.id, facilityType: 'training_facility', level: 3 },
        ],
      });

      // Execute
      const result = await facilityRecommendationService.generateRecommendations(
        user.id,
        10
      );

      // Verify: Should not recommend level 4 upgrades (require 1000 prestige)
      const repairBayRec = result.recommendations.find(
        (r) => r.facilityType === 'repair_bay' && r.recommendedLevel === 4
      );
      expect(repairBayRec).toBeUndefined();

      const trainingRec = result.recommendations.find(
        (r) => r.facilityType === 'training_facility' && r.recommendedLevel === 4
      );
      expect(trainingRec).toBeUndefined();
    });

    it('should not recommend facilities at max level', async () => {
      // Setup: Create user
      const user = await createTestUser();
      testUserIds.push(user.id);
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          currency: 10000000,
          prestige: 50000,
        },
      });

      // Update cycle metadata
      await prisma.cycleMetadata.update({
        where: { id: 1 },
        data: { totalCycles: 10 },
      });

      // Create facility at max level
      await prisma.facility.create({
        data: {
          userId: user.id,
          facilityType: 'storage_facility',
          level: 10, // Max level
        },
      });

      // Execute
      const result = await facilityRecommendationService.generateRecommendations(
        user.id,
        10
      );

      // Verify: Should not recommend storage_facility
      const storageRec = result.recommendations.find(
        (r) => r.facilityType === 'storage_facility'
      );
      expect(storageRec).toBeUndefined();
    });

    it('should recommend roster expansion when user is at capacity', async () => {
      // Setup: Create user
      const user = await createTestUser();
      testUserIds.push(user.id);
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          currency: 500000,
          prestige: 2000,
        },
      });

      // Update cycle metadata
      await prisma.cycleMetadata.update({
        where: { id: 1 },
        data: { totalCycles: 10 },
      });

      // Create roster expansion at level 2 (3 robot slots)
      await prisma.facility.create({
        data: {
          userId: user.id,
          facilityType: 'roster_expansion',
          level: 2,
        },
      });

      // Create 3 robots (at capacity)
      await createTestRobot(user.id, 'Robot 1');
      await createTestRobot(user.id, 'Robot 2');
      await createTestRobot(user.id, 'Robot 3');

      // Execute
      const result = await facilityRecommendationService.generateRecommendations(
        user.id,
        10
      );

      // Verify: Should recommend roster expansion with high priority
      const rosterRec = result.recommendations.find(
        (r) => r.facilityType === 'roster_expansion'
      );
      expect(rosterRec).toBeDefined();
      if (rosterRec) {
        expect(rosterRec.priority).toBe('high');
        expect(rosterRec.reason).toContain('at capacity');
      }
    });

    it('should calculate total recommended investment', async () => {
      // Setup: Create user
      const user = await createTestUser();
      testUserIds.push(user.id);
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          currency: 3000000,
          prestige: 15000,
        },
      });

      // Update cycle metadata
      await prisma.cycleMetadata.update({
        where: { id: 1 },
        data: { totalCycles: 20 },
      });

      // Create facilities
      await prisma.facility.createMany({
        data: [
          { userId: user.id, facilityType: 'income_generator', level: 0 },
          { userId: user.id, facilityType: 'repair_bay', level: 0 },
        ],
      });

      // Execute
      const result = await facilityRecommendationService.generateRecommendations(
        user.id,
        10
      );

      // Verify: Total investment should equal sum of upgrade costs
      const expectedTotal = result.recommendations.reduce(
        (sum, rec) => sum + rec.upgradeCost,
        0
      );
      expect(result.totalRecommendedInvestment).toBe(expectedTotal);
    });
  });
});
