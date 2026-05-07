/**
 * Integration tests for UnifiedFacilityROIService
 *
 * Uses real database to verify end-to-end behavior:
 * - Correct ROI data from cycle snapshots
 * - Graceful handling when no audit events exist
 * - calculateAllEconomicROIs returns all owned economic facilities
 * - calculateProjectedROI works for prospective upgrades
 *
 * **Validates: Requirements 4.4**
 */
import prisma from '../../../lib/prisma';
import { unifiedFacilityROIService } from '../unifiedFacilityROIService';

describe('UnifiedFacilityROIService - Integration Tests', () => {
  let testUserIds: number[] = [];

  beforeAll(async () => {
    // Ensure cycle metadata exists
    await prisma.cycleMetadata.upsert({
      where: { id: 1 },
      update: { totalCycles: 50 },
      create: {
        id: 1,
        totalCycles: 50,
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
    // Clean up test snapshots
    await prisma.cycleSnapshot.deleteMany({
      where: { cycleNumber: { gte: 9000 } },
    });
    testUserIds = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should return correct ROI data when cycle snapshots with stableMetrics exist', async () => {
    // Create user
    const user = await prisma.user.create({
      data: {
        username: `inttest_snap_${Date.now()}`,
        passwordHash: '$2b$10$testhashedpassword000000000000000000000000000000',
        prestige: 5000,
        currency: 1000000,
      },
    });
    testUserIds.push(user.id);

    // Create facility
    await prisma.facility.create({
      data: {
        userId: user.id,
        facilityType: 'merchandising_hub',
        level: 2,
        maxLevel: 10,
      },
    });

    // Create audit event for purchase
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        eventType: 'facility_purchase',
        cycleNumber: 9001,
        sequenceNumber: 1,
        payload: { facilityType: 'merchandising_hub', oldLevel: 0, newLevel: 1 },
      },
    });

    // Create cycle snapshots with stableMetrics
    await prisma.cycleSnapshot.create({
      data: {
        cycleNumber: 9001,
        triggerType: 'manual',
        startTime: new Date(),
        endTime: new Date(),
        durationMs: 1000,
        stableMetrics: [
          {
            userId: user.id,
            battlesParticipated: 3,
            totalCreditsEarned: 50000,
            totalPrestigeEarned: 100,
            totalRepairCosts: 5000,
            merchandisingIncome: 10000,
            streamingIncome: 3000,
            operatingCosts: 400,
            weaponPurchases: 0,
            facilityPurchases: 150000,
            robotPurchases: 0,
            attributeUpgrades: 0,
            totalPurchases: 150000,
            achievementRewards: 0,
            netProfit: -100400,
            balance: 899600,
          },
        ],
        robotMetrics: [],
        stepDurations: [],
      },
    });

    await prisma.cycleSnapshot.create({
      data: {
        cycleNumber: 9002,
        triggerType: 'manual',
        startTime: new Date(),
        endTime: new Date(),
        durationMs: 1000,
        stableMetrics: [
          {
            userId: user.id,
            battlesParticipated: 5,
            totalCreditsEarned: 80000,
            totalPrestigeEarned: 200,
            totalRepairCosts: 8000,
            merchandisingIncome: 10000,
            streamingIncome: 5000,
            operatingCosts: 400,
            weaponPurchases: 0,
            facilityPurchases: 0,
            robotPurchases: 0,
            attributeUpgrades: 0,
            totalPurchases: 0,
            achievementRewards: 0,
            netProfit: 79600,
            balance: 979200,
          },
        ],
        robotMetrics: [],
        stepDurations: [],
      },
    });

    // Update cycle metadata to match
    await prisma.cycleMetadata.update({
      where: { id: 1 },
      data: { totalCycles: 9002 },
    });

    const result = await unifiedFacilityROIService.calculateFacilityROI(
      user.id,
      'merchandising_hub'
    );

    expect(result).not.toBeNull();
    expect(result!.facilityType).toBe('merchandising_hub');
    expect(result!.currentLevel).toBe(2);
    expect(result!.totalReturns).toBe(20000); // 10000 + 10000
    expect(result!.dataSource).toBe('snapshot');
    expect(result!.totalInvestment).toBe(450000); // 150000 + 300000

    // Restore cycle metadata
    await prisma.cycleMetadata.update({
      where: { id: 1 },
      data: { totalCycles: 50 },
    });
  });

  it('should return data (not null) for facility with level > 0 but no audit events', async () => {
    // Create user
    const user = await prisma.user.create({
      data: {
        username: `inttest_noaudit_${Date.now()}`,
        passwordHash: '$2b$10$testhashedpassword000000000000000000000000000000',
        prestige: 3000,
        currency: 500000,
      },
    });
    testUserIds.push(user.id);

    // Create facility at level 3 but NO audit events
    await prisma.facility.create({
      data: {
        userId: user.id,
        facilityType: 'streaming_studio',
        level: 3,
        maxLevel: 10,
      },
    });

    const result = await unifiedFacilityROIService.calculateFacilityROI(
      user.id,
      'streaming_studio'
    );

    // Should NOT be null — this is the bug fix
    expect(result).not.toBeNull();
    expect(result!.facilityType).toBe('streaming_studio');
    expect(result!.currentLevel).toBe(3);
    expect(result!.totalInvestment).toBeGreaterThan(0);
  });

  it('should return all owned economic facilities via calculateAllEconomicROIs', async () => {
    // Create user
    const user = await prisma.user.create({
      data: {
        username: `inttest_all_${Date.now()}`,
        passwordHash: '$2b$10$testhashedpassword000000000000000000000000000000',
        prestige: 8000,
        currency: 2000000,
      },
    });
    testUserIds.push(user.id);

    // Create multiple economic facilities
    await prisma.facility.createMany({
      data: [
        { userId: user.id, facilityType: 'merchandising_hub', level: 2, maxLevel: 10 },
        { userId: user.id, facilityType: 'repair_bay', level: 1, maxLevel: 10 },
        { userId: user.id, facilityType: 'training_facility', level: 3, maxLevel: 9 },
        // Also create a non-economic facility to verify it's excluded
        { userId: user.id, facilityType: 'roster_expansion', level: 2, maxLevel: 9 },
      ],
    });

    const result = await unifiedFacilityROIService.calculateAllEconomicROIs(user.id);

    expect(result.facilities).toHaveLength(3);
    const types = result.facilities.map((f) => f.facilityType).sort();
    expect(types).toEqual(['merchandising_hub', 'repair_bay', 'training_facility']);
    expect(result.totals.totalInvestment).toBeGreaterThan(0);
  });

  it('should return projected ROI for prospective upgrades', async () => {
    // Create user
    const user = await prisma.user.create({
      data: {
        username: `inttest_proj_${Date.now()}`,
        passwordHash: '$2b$10$testhashedpassword000000000000000000000000000000',
        prestige: 5000,
        currency: 3000000,
      },
    });
    testUserIds.push(user.id);

    // Create facility at level 1
    await prisma.facility.create({
      data: {
        userId: user.id,
        facilityType: 'merchandising_hub',
        level: 1,
        maxLevel: 10,
      },
    });

    const result = await unifiedFacilityROIService.calculateProjectedROI(
      user.id,
      'merchandising_hub',
      3
    );

    expect(result.currentLevel).toBe(1);
    expect(result.targetLevel).toBe(3);
    expect(result.upgradeCost).toBeGreaterThan(0);
    expect(result.affordable).toBe(true);
    expect(result.recommendation).toBeTruthy();
    expect(['excellent', 'good', 'neutral', 'poor', 'not_affordable']).toContain(
      result.recommendationType
    );
  });
});
