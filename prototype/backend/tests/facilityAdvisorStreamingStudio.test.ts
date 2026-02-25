import prisma from '../src/lib/prisma';
import { facilityRecommendationService } from '../src/services/facilityRecommendationService';
import { createTestUser, createTestRobot } from './testHelpers';


describe('Facility Advisor - Streaming Studio', () => {
  let testUserIds: number[] = [];

  beforeEach(async () => {
    testUserIds = [];
    
    // Clean up cycle snapshots from previous tests
    await prisma.cycleSnapshot.deleteMany({});
    
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
    // Clean up cycle snapshots
    await prisma.cycleSnapshot.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should recommend Streaming Studio with positive ROI when user has battle history', async () => {
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

    // Create a robot with significant battles and fame to generate good streaming revenue
    const robot = await createTestRobot(user.id, 'TestBot');
    await prisma.robot.update({
      where: { id: robot.id },
      data: {
        totalBattles: 1000, // More battles for higher multiplier
        fame: 5000, // More fame for higher multiplier
      },
    });

    // Create cycle snapshots with high battle activity
    const startCycle = 1;
    for (let cycle = startCycle; cycle <= startCycle + 9; cycle++) {
      await prisma.cycleSnapshot.create({
        data: {
          cycleNumber: cycle,
          triggerType: 'manual',
          startTime: new Date(),
          endTime: new Date(),
          durationMs: 1000,
          stableMetrics: [
            {
              userId: user.id,
              battlesParticipated: 20, // 20 battles per cycle for higher revenue
              totalRepairCosts: 0,
            },
          ],
          robotMetrics: [],
          stepDurations: {},
        },
      });
    }

    // Update cycle metadata to match
    await prisma.cycleMetadata.update({
      where: { id: 1 },
      data: { totalCycles: startCycle + 9 },
    });

    // Create Streaming Studio facility at level 0
    await prisma.facility.create({
      data: {
        userId: user.id,
        facilityType: 'streaming_studio',
        level: 0,
      },
    });

    // Execute
    const result = await facilityRecommendationService.generateRecommendations(
      user.id,
      10
    );

    // Verify: Streaming Studio should be recommended
    const streamingStudioRec = result.recommendations.find(
      (r) => r.facilityType === 'streaming_studio'
    );
    
    expect(streamingStudioRec).toBeDefined();
    if (streamingStudioRec) {
      expect(streamingStudioRec.currentLevel).toBe(0);
      expect(streamingStudioRec.recommendedLevel).toBe(1);
      expect(streamingStudioRec.upgradeCost).toBe(100000);
      expect(streamingStudioRec.projectedROI).toBeGreaterThan(0);
      expect(streamingStudioRec.reason).toContain('streaming revenue');
      expect(streamingStudioRec.reason).toContain('10%');
      // projectedPayoffCycles may be null if no battle history
      if (streamingStudioRec.projectedPayoffCycles !== null) {
        expect(streamingStudioRec.projectedPayoffCycles).toBeGreaterThan(0);
      }
    }
  });

  it('should recommend Streaming Studio with strategic value when user has no battle history', async () => {
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

    // Create a robot with no battles
    const robot = await createTestRobot(user.id, 'NewBot');

    // Create Streaming Studio facility at level 0
    await prisma.facility.create({
      data: {
        userId: user.id,
        facilityType: 'streaming_studio',
        level: 0,
      },
    });

    // Execute
    const result = await facilityRecommendationService.generateRecommendations(
      user.id,
      10
    );

    // Verify: Streaming Studio should be recommended with strategic value
    const streamingStudioRec = result.recommendations.find(
      (r) => r.facilityType === 'streaming_studio'
    );
    
    expect(streamingStudioRec).toBeDefined();
    if (streamingStudioRec) {
      expect(streamingStudioRec.currentLevel).toBe(0);
      expect(streamingStudioRec.recommendedLevel).toBe(1);
      expect(streamingStudioRec.upgradeCost).toBe(100000);
      expect(streamingStudioRec.projectedROI).toBeGreaterThan(0);
      expect(streamingStudioRec.reason).toContain('no battle history');
      expect(streamingStudioRec.priority).toBe('medium');
    }
  });

  it('should calculate correct ROI for Streaming Studio upgrade from level 1 to 2', async () => {
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

    // Create a robot with high battles and fame
    const robot = await createTestRobot(user.id, 'VeteranBot');
    await prisma.robot.update({
      where: { id: robot.id },
      data: {
        totalBattles: 2000, // High battle count
        fame: 10000, // High fame
      },
    });

    // Create cycle snapshots with high battle activity
    const startCycle = 20;
    for (let cycle = startCycle; cycle <= startCycle + 9; cycle++) {
      await prisma.cycleSnapshot.create({
        data: {
          cycleNumber: cycle,
          triggerType: 'manual',
          startTime: new Date(),
          endTime: new Date(),
          durationMs: 1000,
          stableMetrics: [
            {
              userId: user.id,
              battlesParticipated: 25, // High battle frequency
              totalRepairCosts: 0,
            },
          ],
          robotMetrics: [],
          stepDurations: {},
        },
      });
    }

    // Update cycle metadata to match
    await prisma.cycleMetadata.update({
      where: { id: 1 },
      data: { totalCycles: startCycle + 9 },
    });

    // Create Streaming Studio facility at level 1
    await prisma.facility.create({
      data: {
        userId: user.id,
        facilityType: 'streaming_studio',
        level: 1,
      },
    });

    // Execute
    const result = await facilityRecommendationService.generateRecommendations(
      user.id,
      10
    );

    // Verify: Streaming Studio upgrade should be recommended
    const streamingStudioRec = result.recommendations.find(
      (r) => r.facilityType === 'streaming_studio'
    );
    
    expect(streamingStudioRec).toBeDefined();
    if (streamingStudioRec) {
      expect(streamingStudioRec.currentLevel).toBe(1);
      expect(streamingStudioRec.recommendedLevel).toBe(2);
      expect(streamingStudioRec.upgradeCost).toBe(200000);
      expect(streamingStudioRec.projectedROI).toBeGreaterThan(0);
      expect(streamingStudioRec.reason).toContain('streaming revenue');
      if (streamingStudioRec.projectedPayoffCycles !== null) {
        expect(streamingStudioRec.projectedPayoffCycles).toBeGreaterThan(0);
      }
    }
  });

  it('should not recommend Streaming Studio when battle frequency is too low', async () => {
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

    // Create a robot with minimal battles and fame
    const robot = await createTestRobot(user.id, 'WeakBot');
    await prisma.robot.update({
      where: { id: robot.id },
      data: {
        totalBattles: 1,
        fame: 10,
      },
    });

    // Create cycle snapshots with very low battle activity (1 battle per 10 cycles)
    const startCycle = 40;
    for (let cycle = startCycle; cycle <= startCycle + 9; cycle++) {
      await prisma.cycleSnapshot.create({
        data: {
          cycleNumber: cycle,
          triggerType: 'manual',
          startTime: new Date(),
          endTime: new Date(),
          durationMs: 1000,
          stableMetrics: [
            {
              userId: user.id,
              battlesParticipated: cycle === startCycle + 9 ? 1 : 0, // Only 1 battle in 10 cycles
              totalRepairCosts: 0,
            },
          ],
          robotMetrics: [],
          stepDurations: {},
        },
      });
    }

    // Update cycle metadata to match
    await prisma.cycleMetadata.update({
      where: { id: 1 },
      data: { totalCycles: startCycle + 9 },
    });

    // Create Streaming Studio facility at level 0
    await prisma.facility.create({
      data: {
        userId: user.id,
        facilityType: 'streaming_studio',
        level: 0,
      },
    });

    // Execute
    const result = await facilityRecommendationService.generateRecommendations(
      user.id,
      10
    );

    // Verify: Streaming Studio should NOT be recommended because battle frequency is too low
    // (operating costs exceed revenue increase)
    const streamingStudioRec = result.recommendations.find(
      (r) => r.facilityType === 'streaming_studio'
    );
    
    expect(streamingStudioRec).toBeUndefined();
  });
});
