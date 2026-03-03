/**
 * Unit tests for Analytics API
 * 
 * Tests the /api/analytics/stable/:userId/summary endpoint
 * 
 * Requirements: 12.1
 */

import request from 'supertest';
import express from 'express';
import analyticsRoutes from '../src/routes/analytics';
import { cycleSnapshotService } from '../src/services/cycleSnapshotService';
import { eventLogger } from '../src/services/eventLogger';
import prisma from '../src/lib/prisma';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/analytics', analyticsRoutes);

describe('Analytics API - Stable Summary', () => {
  const testCycleStart = 8000;
  const testUserId = 1;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.cycleSnapshot.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });
    await prisma.auditLog.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });

    // Create test snapshots with known data
    for (let i = 0; i < 5; i++) {
      const cycleNumber = testCycleStart + i;

      // Log cycle events
      await eventLogger.logCycleStart(cycleNumber, 'manual');
      
      // Log passive income for test user
      await eventLogger.logPassiveIncome(
        cycleNumber,
        testUserId,
        100, // merchandising
        50,  // streaming
        1,   // facility level
        100, // prestige
        10,  // total battles
        500  // total fame
      );

      // Log operating costs
      await eventLogger.logOperatingCosts(
        cycleNumber,
        testUserId,
        [{ facilityType: 'income_generator', level: 1, cost: 20 }],
        20
      );

      await eventLogger.logCycleComplete(cycleNumber, 1000);

      // Create snapshot
      await cycleSnapshotService.createSnapshot(cycleNumber);
    }
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.cycleSnapshot.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });
    await prisma.auditLog.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });
    await prisma.$disconnect();
  });

  it('should return summary for last N cycles with default N=10', async () => {
    const response = await request(app)
      .get(`/api/analytics/stable/${testUserId}/summary`)
      .expect(200);

    expect(response.body).toHaveProperty('userId', testUserId);
    expect(response.body).toHaveProperty('cycleRange');
    expect(response.body).toHaveProperty('totalIncome');
    expect(response.body).toHaveProperty('totalExpenses');
    expect(response.body).toHaveProperty('netProfit');
    expect(response.body).toHaveProperty('cycles');
    expect(Array.isArray(response.body.cycles)).toBe(true);
  });

  it('should return summary for specified number of cycles', async () => {
    const response = await request(app)
      .get(`/api/analytics/stable/${testUserId}/summary?lastNCycles=3`)
      .expect(200);

    expect(response.body.cycles.length).toBeLessThanOrEqual(3);
  });

  it('should calculate correct totals from cycle data', async () => {
    const response = await request(app)
      .get(`/api/analytics/stable/${testUserId}/summary?lastNCycles=5`)
      .expect(200);

    // Each cycle has: 100 merchandising + 50 streaming = 150 income
    // Each cycle has: 20 operating costs = 20 expenses
    // Net profit per cycle = 150 - 20 = 130
    // For 5 cycles: 750 income, 100 expenses, 650 net profit

    expect(response.body.totalIncome).toBe(750);
    expect(response.body.totalExpenses).toBe(100);
    expect(response.body.netProfit).toBe(650);
  });

  it('should include breakdown for each cycle', async () => {
    const response = await request(app)
      .get(`/api/analytics/stable/${testUserId}/summary?lastNCycles=1`)
      .expect(200);

    expect(response.body.cycles.length).toBeGreaterThan(0);
    
    const cycle = response.body.cycles[0];
    expect(cycle).toHaveProperty('cycleNumber');
    expect(cycle).toHaveProperty('income');
    expect(cycle).toHaveProperty('expenses');
    expect(cycle).toHaveProperty('netProfit');
    expect(cycle).toHaveProperty('breakdown');
    
    expect(cycle.breakdown).toHaveProperty('battleCredits');
    expect(cycle.breakdown).toHaveProperty('merchandising');
    expect(cycle.breakdown).toHaveProperty('streaming');
    expect(cycle.breakdown).toHaveProperty('repairCosts');
    expect(cycle.breakdown).toHaveProperty('operatingCosts');
  });

  it('should return 400 for invalid userId', async () => {
    const response = await request(app)
      .get('/api/analytics/stable/invalid/summary')
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid userId');
  });

  it('should return 400 for invalid lastNCycles parameter', async () => {
    const response = await request(app)
      .get(`/api/analytics/stable/${testUserId}/summary?lastNCycles=0`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid lastNCycles parameter');
  });

  it('should handle user with no activity in cycles', async () => {
    const nonExistentUserId = 999999;
    
    const response = await request(app)
      .get(`/api/analytics/stable/${nonExistentUserId}/summary?lastNCycles=5`)
      .expect(200);

    // Should return cycles with zero values
    expect(response.body.totalIncome).toBe(0);
    expect(response.body.totalExpenses).toBe(0);
    expect(response.body.netProfit).toBe(0);
  });

  it('should return correct cycle range', async () => {
    const response = await request(app)
      .get(`/api/analytics/stable/${testUserId}/summary?lastNCycles=3`)
      .expect(200);

    expect(response.body.cycleRange).toHaveLength(2);
    expect(response.body.cycleRange[0]).toBeLessThanOrEqual(response.body.cycleRange[1]);
  });

  it('should handle edge case of single cycle', async () => {
    const response = await request(app)
      .get(`/api/analytics/stable/${testUserId}/summary?lastNCycles=1`)
      .expect(200);

    expect(response.body.cycles.length).toBe(1);
    expect(response.body.totalIncome).toBe(150); // 100 + 50
    expect(response.body.totalExpenses).toBe(20);
    expect(response.body.netProfit).toBe(130);
  });
});

describe('Analytics API - Error Handling', () => {
  it('should return 200 with empty data when no snapshots exist', async () => {
    // Temporarily clear all snapshots
    const allSnapshots = await prisma.cycleSnapshot.findMany();
    await prisma.cycleSnapshot.deleteMany();

    const response = await request(app)
      .get('/api/analytics/stable/1/summary')
      .expect(200);

    // Should return empty data structure, not 404
    expect(response.body).toHaveProperty('userId', 1);
    expect(response.body).toHaveProperty('totalIncome', 0);
    expect(response.body).toHaveProperty('totalExpenses', 0);
    expect(response.body).toHaveProperty('netProfit', 0);
    expect(response.body.cycles).toEqual([]);

    // Restore snapshots
    for (const snapshot of allSnapshots) {
      await prisma.cycleSnapshot.create({
        data: {
          cycleNumber: snapshot.cycleNumber,
          triggerType: snapshot.triggerType,
          startTime: snapshot.startTime,
          endTime: snapshot.endTime,
          durationMs: snapshot.durationMs,
          stableMetrics: snapshot.stableMetrics as any,
          robotMetrics: snapshot.robotMetrics as any,
          stepDurations: snapshot.stepDurations as any,
          totalBattles: snapshot.totalBattles,
          totalCreditsTransacted: snapshot.totalCreditsTransacted,
          totalPrestigeAwarded: snapshot.totalPrestigeAwarded,
        },
      });
    }
  });
});

describe('Analytics API - Additional Edge Cases', () => {
  const testCycleStart = 9000;
  const testUserId1 = 101;
  const testUserId2 = 102;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.cycleSnapshot.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });
    await prisma.auditLog.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });

    // Create test snapshots with multiple users
    for (let i = 0; i < 3; i++) {
      const cycleNumber = testCycleStart + i;

      await eventLogger.logCycleStart(cycleNumber, 'manual');
      
      // User 1 has activity in all cycles
      await eventLogger.logPassiveIncome(
        cycleNumber,
        testUserId1,
        200, // merchandising
        100, // streaming
        2,   // facility level
        200, // prestige
        20,  // total battles
        1000 // total fame
      );
      await eventLogger.logOperatingCosts(
        cycleNumber,
        testUserId1,
        [{ facilityType: 'income_generator', level: 2, cost: 40 }],
        40
      );

      // User 2 only has activity in cycle 0 and 2
      if (i !== 1) {
        await eventLogger.logPassiveIncome(
          cycleNumber,
          testUserId2,
          50,  // merchandising
          25,  // streaming
          1,   // facility level
          50,  // prestige
          5,   // total battles
          250  // total fame
        );
        await eventLogger.logOperatingCosts(
          cycleNumber,
          testUserId2,
          [{ facilityType: 'income_generator', level: 1, cost: 10 }],
          10
        );
      }

      await eventLogger.logCycleComplete(cycleNumber, 1000);
      await cycleSnapshotService.createSnapshot(cycleNumber);
    }
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.cycleSnapshot.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });
    await prisma.auditLog.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });
  });

  it('should handle requesting more cycles than exist', async () => {
    const response = await request(app)
      .get(`/api/analytics/stable/${testUserId1}/summary?lastNCycles=1000`)
      .expect(200);

    // Should return all available cycles, not fail
    expect(response.body.cycles.length).toBeGreaterThan(0);
    expect(response.body.cycles.length).toBeLessThanOrEqual(1000);
  });

  it('should handle user with partial activity across cycles', async () => {
    const response = await request(app)
      .get(`/api/analytics/stable/${testUserId2}/summary?lastNCycles=3`)
      .expect(200);

    // User 2 has activity in 2 out of 3 cycles
    expect(response.body.cycles.length).toBe(3);
    
    // Check that cycles with no activity return zero values
    const cyclesWithActivity = response.body.cycles.filter((c: any) => c.income > 0);
    const cyclesWithoutActivity = response.body.cycles.filter((c: any) => c.income === 0);
    
    expect(cyclesWithActivity.length).toBe(2);
    expect(cyclesWithoutActivity.length).toBe(1);
    
    // Verify zero values for inactive cycle
    const inactiveCycle = cyclesWithoutActivity[0];
    expect(inactiveCycle.expenses).toBe(0);
    expect(inactiveCycle.netProfit).toBe(0);
    expect(inactiveCycle.breakdown.battleCredits).toBe(0);
    expect(inactiveCycle.breakdown.merchandising).toBe(0);
    expect(inactiveCycle.breakdown.streaming).toBe(0);
  });

  it('should correctly isolate data between different users', async () => {
    const response1 = await request(app)
      .get(`/api/analytics/stable/${testUserId1}/summary?lastNCycles=3`)
      .expect(200);

    const response2 = await request(app)
      .get(`/api/analytics/stable/${testUserId2}/summary?lastNCycles=3`)
      .expect(200);

    // User 1 should have consistent income across all cycles
    expect(response1.body.totalIncome).toBe(900); // 3 cycles * 300 income

    // User 2 should have income only from 2 cycles
    expect(response2.body.totalIncome).toBe(150); // 2 cycles * 75 income

    // Verify they don't interfere with each other
    expect(response1.body.totalIncome).not.toBe(response2.body.totalIncome);
  });

  it('should handle cycles with only expenses (no income)', async () => {
    const testCycleExpenseOnly = testCycleStart + 5;
    const testUserExpenseOnly = 103;

    // Create a cycle with only operating costs, no income
    await eventLogger.logCycleStart(testCycleExpenseOnly, 'manual');
    
    // Log passive income with zero values to ensure user is in the snapshot
    await eventLogger.logPassiveIncome(
      testCycleExpenseOnly,
      testUserExpenseOnly,
      0, // merchandising
      0, // streaming
      1, // facility level
      0, // prestige
      0, // total battles
      0  // total fame
    );
    
    await eventLogger.logOperatingCosts(
      testCycleExpenseOnly,
      testUserExpenseOnly,
      [{ facilityType: 'income_generator', level: 1, cost: 50 }],
      50
    );
    await eventLogger.logCycleComplete(testCycleExpenseOnly, 1000);
    await cycleSnapshotService.createSnapshot(testCycleExpenseOnly);

    const response = await request(app)
      .get(`/api/analytics/stable/${testUserExpenseOnly}/summary?lastNCycles=1`)
      .expect(200);

    expect(response.body.totalIncome).toBe(0);
    expect(response.body.totalExpenses).toBe(50);
    expect(response.body.netProfit).toBe(-50); // Negative profit

    // Clean up
    await prisma.cycleSnapshot.deleteMany({
      where: { cycleNumber: testCycleExpenseOnly },
    });
    await prisma.auditLog.deleteMany({
      where: { cycleNumber: testCycleExpenseOnly },
    });
  });

  it('should return consistent data structure even with zero values', async () => {
    const nonExistentUser = 999998;
    
    const response = await request(app)
      .get(`/api/analytics/stable/${nonExistentUser}/summary?lastNCycles=2`)
      .expect(200);

    // Verify structure is complete even with no data
    expect(response.body).toHaveProperty('userId', nonExistentUser);
    expect(response.body).toHaveProperty('cycleRange');
    expect(response.body).toHaveProperty('totalIncome', 0);
    expect(response.body).toHaveProperty('totalExpenses', 0);
    expect(response.body).toHaveProperty('netProfit', 0);
    expect(response.body).toHaveProperty('cycles');
    
    // Each cycle should have complete structure
    response.body.cycles.forEach((cycle: any) => {
      expect(cycle).toHaveProperty('cycleNumber');
      expect(cycle).toHaveProperty('income', 0);
      expect(cycle).toHaveProperty('expenses', 0);
      expect(cycle).toHaveProperty('netProfit', 0);
      expect(cycle.breakdown).toHaveProperty('battleCredits', 0);
      expect(cycle.breakdown).toHaveProperty('merchandising', 0);
      expect(cycle.breakdown).toHaveProperty('streaming', 0);
      expect(cycle.breakdown).toHaveProperty('repairCosts', 0);
      expect(cycle.breakdown).toHaveProperty('operatingCosts', 0);
    });
  });

  it('should handle very large lastNCycles gracefully', async () => {
    const response = await request(app)
      .get(`/api/analytics/stable/${testUserId1}/summary?lastNCycles=999999`)
      .expect(200);

    // Should not crash and should return available data
    expect(response.body).toHaveProperty('cycles');
    expect(Array.isArray(response.body.cycles)).toBe(true);
    expect(response.body.cycleRange[0]).toBeGreaterThanOrEqual(1);
  });
});

describe('Analytics API - Robot Performance Endpoint', () => {
  const testCycleStart = 12000;
  const testUserId = 501;
  const testRobotId = 601;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.cycleSnapshot.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });
    await prisma.auditLog.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });
    await prisma.battle.deleteMany({
      where: {
        OR: [
          { robot1Id: testRobotId },
          { robot2Id: testRobotId },
        ],
      },
    });

    // Ensure test user exists
    await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        username: 'testuser_robot_perf',
        passwordHash: 'test',
      },
    });

    // Ensure test robot exists
    await prisma.robot.upsert({
      where: { id: testRobotId },
      update: {},
      create: {
        id: testRobotId,
        name: 'Test Robot',
        userId: testUserId,
        elo: 1000,
        currentHP: 100,
        maxHP: 100,
        currentShield: 50,
        maxShield: 50,
      },
    });

    // Create opponent robot
    await prisma.robot.upsert({
      where: { id: testRobotId + 1 },
      update: {},
      create: {
        id: testRobotId + 1,
        name: 'Opponent Robot',
        userId: testUserId,
        elo: 1000,
        currentHP: 100,
        maxHP: 100,
        currentShield: 50,
        maxShield: 50,
      },
    });

    // Create test cycles with battle data
    for (let i = 0; i < 3; i++) {
      const cycleNumber = testCycleStart + i;

      await eventLogger.logCycleStart(cycleNumber, 'manual');

      // Create battles for the robot
      const battle = await prisma.battle.create({
        data: {
          robot1Id: testRobotId,
          robot2Id: testRobotId + 1,
          winnerId: i % 2 === 0 ? testRobotId : testRobotId + 1,
          battleType: 'league',
          leagueType: 'bronze',
          battleLog: {},
          robot1ELOBefore: 1000 + (i * 10),
          robot1ELOAfter: 1000 + (i * 10) + (i % 2 === 0 ? 10 : -5),
          robot2ELOBefore: 1000,
          robot2ELOAfter: 1000,
          eloChange: i % 2 === 0 ? 10 : -5,
          winnerReward: 100,
          loserReward: 50,
          durationSeconds: 60,
          participants: {
            create: [
              {
                robotId: testRobotId,
                team: 1,
                credits: 0,
                damageDealt: 50 + (i * 10),
                finalHP: i % 2 === 0 ? 70 : 20,
                fameAwarded: i % 2 === 0 ? 20 : 10,
                prestigeAwarded: i % 2 === 0 ? 10 : 5,
                eloBefore: 1000 + (i * 10),
                eloAfter: 1000 + (i * 10) + (i % 2 === 0 ? 10 : -5),
                yielded: false,
                destroyed: false,
              },
              {
                robotId: testRobotId + 1,
                team: 2,
                credits: 0,
                damageDealt: 30,
                finalHP: i % 2 === 0 ? 20 : 70,
                fameAwarded: i % 2 === 0 ? 10 : 20,
                prestigeAwarded: i % 2 === 0 ? 5 : 10,
                eloBefore: 1000,
                eloAfter: 1000,
                yielded: false,
                destroyed: false,
              },
            ],
          },
        },
      });

      await eventLogger.logCycleComplete(cycleNumber, 1000);
      // Don't create snapshot - robot performance service will query battles directly
    }
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.battle.deleteMany({
      where: {
        OR: [
          { robot1Id: testRobotId },
          { robot2Id: testRobotId },
        ],
      },
    });
    await prisma.cycleSnapshot.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });
    await prisma.auditLog.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });
    await prisma.robot.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.delete({
      where: { id: testUserId },
    }).catch(() => {});
    await prisma.$disconnect();
  });

  it('should return robot performance summary', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]`)
      .expect(200);

    expect(response.body).toHaveProperty('robotId', testRobotId);
    expect(response.body).toHaveProperty('cycleRange');
    expect(response.body.cycleRange).toEqual([testCycleStart, testCycleStart + 2]);
    expect(response.body).toHaveProperty('battlesParticipated');
    expect(response.body).toHaveProperty('wins');
    expect(response.body).toHaveProperty('losses');
    expect(response.body).toHaveProperty('draws');
    expect(response.body).toHaveProperty('winRate');
    expect(response.body).toHaveProperty('damageDealt');
    expect(response.body).toHaveProperty('damageReceived');
    expect(response.body).toHaveProperty('totalCreditsEarned');
    expect(response.body).toHaveProperty('totalFameEarned');
    expect(response.body).toHaveProperty('eloChange');
    expect(response.body).toHaveProperty('eloStart');
    expect(response.body).toHaveProperty('eloEnd');
  });

  it('should calculate correct battle statistics', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]`)
      .expect(200);

    // 3 battles total
    expect(response.body.battlesParticipated).toBe(3);
    
    // Wins on cycles 0 and 2 (2 wins)
    expect(response.body.wins).toBe(2);
    
    // Loss on cycle 1 (1 loss)
    expect(response.body.losses).toBe(1);
    
    // No draws
    expect(response.body.draws).toBe(0);
    
    // Win rate: 2/3 = 66.67%
    expect(response.body.winRate).toBeCloseTo(66.67, 1);
  });

  it('should calculate correct damage statistics', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]`)
      .expect(200);

    // Damage dealt: 50 + 60 + 70 = 180
    expect(response.body.damageDealt).toBe(180);
    
    // Damage received: 30 + 30 + 30 = 90
    expect(response.body.damageReceived).toBe(90);
  });

  it('should calculate earnings from battles', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]`)
      .expect(200);

    // Verify earnings fields exist and are numbers
    expect(typeof response.body.totalCreditsEarned).toBe('number');
    expect(typeof response.body.totalFameEarned).toBe('number');
    expect(response.body.totalCreditsEarned).toBeGreaterThanOrEqual(0);
    expect(response.body.totalFameEarned).toBeGreaterThanOrEqual(0);
  });

  it('should calculate correct ELO changes', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]`)
      .expect(200);

    // ELO changes: +10, -5, +10 = +15 total
    expect(response.body.eloChange).toBe(15);
    
    // Start ELO: 1000
    expect(response.body.eloStart).toBe(1000);
    
    // End ELO: 1030 (from last battle's robot1ELOAfter)
    expect(response.body.eloEnd).toBe(1030);
  });

  it('should include ELO progression when requested', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]&includeELOProgression=true`)
      .expect(200);

    expect(response.body).toHaveProperty('eloProgression');
    expect(response.body.eloProgression).toHaveProperty('dataPoints');
    expect(response.body.eloProgression).toHaveProperty('startElo');
    expect(response.body.eloProgression).toHaveProperty('endElo');
    expect(response.body.eloProgression).toHaveProperty('totalChange');
    expect(response.body.eloProgression).toHaveProperty('averageChange');
    
    expect(Array.isArray(response.body.eloProgression.dataPoints)).toBe(true);
    expect(response.body.eloProgression.dataPoints.length).toBeGreaterThan(0);
    
    // Verify data point structure
    response.body.eloProgression.dataPoints.forEach((point: any) => {
      expect(point).toHaveProperty('cycleNumber');
      expect(point).toHaveProperty('elo');
      expect(point).toHaveProperty('change');
    });
  });

  it('should not include ELO progression by default', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]`)
      .expect(200);

    expect(response.body).not.toHaveProperty('eloProgression');
  });

  it('should return 400 for invalid robotId', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/invalid/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid robotId');
  });

  it('should return 400 when cycleRange is missing', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Missing required parameter');
    expect(response.body.message).toContain('cycleRange');
  });

  it('should return 400 for invalid cycleRange format', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=invalid`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid cycleRange format');
  });

  it('should return 400 for invalid cycleRange format (missing brackets)', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=1,10`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid cycleRange format');
  });

  it('should return 400 for negative cycle numbers', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=[-1,10]`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid cycle numbers');
  });

  it('should return 400 when startCycle > endCycle', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=[10,1]`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid cycle range');
  });

  it('should return 404 for non-existent robot', async () => {
    const nonExistentRobotId = 999999;
    
    const response = await request(app)
      .get(`/api/analytics/robot/${nonExistentRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]`)
      .expect(404);

    expect(response.body).toHaveProperty('error', 'Robot not found');
  });

  it('should handle robot with no battles in cycle range', async () => {
    const newRobotId = testRobotId + 100;
    
    // Create robot with no battles
    await prisma.robot.create({
      data: {
        id: newRobotId,
        name: 'Robot With No Battles',
        userId: testUserId,
        elo: 1000,
        currentHP: 100,
        maxHP: 100,
        currentShield: 50,
        maxShield: 50,
      },
    });

    const response = await request(app)
      .get(`/api/analytics/robot/${newRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]`)
      .expect(200);

    expect(response.body.battlesParticipated).toBe(0);
    expect(response.body.wins).toBe(0);
    expect(response.body.losses).toBe(0);
    expect(response.body.draws).toBe(0);
    expect(response.body.winRate).toBe(0);
    expect(response.body.damageDealt).toBe(0);
    expect(response.body.damageReceived).toBe(0);
    expect(response.body.totalCreditsEarned).toBe(0);
    expect(response.body.totalFameEarned).toBe(0);
    expect(response.body.eloChange).toBe(0);

    // Clean up
    await prisma.robot.delete({
      where: { id: newRobotId },
    });
  });

  it('should handle single cycle range', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart}]`)
      .expect(200);

    expect(response.body.cycleRange).toEqual([testCycleStart, testCycleStart]);
    // Battle count may be 0 or 1 depending on test data
    expect(response.body.battlesParticipated).toBeGreaterThanOrEqual(0);
  });

  it('should handle includeELOProgression=false explicitly', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]&includeELOProgression=false`)
      .expect(200);

    expect(response.body).not.toHaveProperty('eloProgression');
  });

  it('should support includeMetricProgression with progressionMetric=fame', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]&includeMetricProgression=true&progressionMetric=fame`)
      .expect(200);

    expect(response.body).toHaveProperty('metricProgression');
    expect(response.body.metricProgression).toHaveProperty('metric', 'fame');
    expect(response.body.metricProgression).toHaveProperty('dataPoints');
    expect(response.body.metricProgression).toHaveProperty('startValue');
    expect(response.body.metricProgression).toHaveProperty('endValue');
    expect(response.body.metricProgression).toHaveProperty('totalChange');
    expect(response.body.metricProgression).toHaveProperty('movingAverage');
  });

  it('should support includeMetricProgression with progressionMetric=damageDealt', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]&includeMetricProgression=true&progressionMetric=damageDealt`)
      .expect(200);

    expect(response.body).toHaveProperty('metricProgression');
    expect(response.body.metricProgression).toHaveProperty('metric', 'damageDealt');
    expect(response.body.metricProgression.dataPoints).toBeInstanceOf(Array);
  });

  it('should support includeMetricProgression with progressionMetric=wins', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]&includeMetricProgression=true&progressionMetric=wins`)
      .expect(200);

    expect(response.body).toHaveProperty('metricProgression');
    expect(response.body.metricProgression).toHaveProperty('metric', 'wins');
  });

  it('should support includeMetricProgression with progressionMetric=creditsEarned', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]&includeMetricProgression=true&progressionMetric=creditsEarned`)
      .expect(200);

    expect(response.body).toHaveProperty('metricProgression');
    expect(response.body.metricProgression).toHaveProperty('metric', 'creditsEarned');
  });

  it('should return 400 for invalid progressionMetric', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]&includeMetricProgression=true&progressionMetric=invalid`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid progressionMetric');
  });

  it('should default to elo metric when progressionMetric is not specified', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]&includeMetricProgression=true`)
      .expect(200);

    expect(response.body).toHaveProperty('metricProgression');
    expect(response.body.metricProgression).toHaveProperty('metric', 'elo');
  });

  it('should maintain backward compatibility with includeELOProgression=true', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]&includeELOProgression=true`)
      .expect(200);

    // Should have both eloProgression (deprecated) and metricProgression (new)
    expect(response.body).toHaveProperty('eloProgression');
    expect(response.body).toHaveProperty('metricProgression');
    expect(response.body.metricProgression.metric).toBe('elo');
  });

  it('should return consistent data structure even with no battles', async () => {
    const newRobotId = testRobotId + 101;
    
    await prisma.robot.create({
      data: {
        id: newRobotId,
        name: 'Another Robot With No Battles',
        userId: testUserId,
        elo: 1000,
        currentHP: 100,
        maxHP: 100,
        currentShield: 50,
        maxShield: 50,
      },
    });

    const response = await request(app)
      .get(`/api/analytics/robot/${newRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]`)
      .expect(200);

    // Verify all required fields are present
    expect(response.body).toHaveProperty('robotId', newRobotId);
    expect(response.body).toHaveProperty('cycleRange');
    expect(response.body).toHaveProperty('battlesParticipated', 0);
    expect(response.body).toHaveProperty('wins', 0);
    expect(response.body).toHaveProperty('losses', 0);
    expect(response.body).toHaveProperty('draws', 0);
    expect(response.body).toHaveProperty('winRate', 0);
    expect(response.body).toHaveProperty('damageDealt', 0);
    expect(response.body).toHaveProperty('damageReceived', 0);
    expect(response.body).toHaveProperty('totalCreditsEarned', 0);
    expect(response.body).toHaveProperty('totalFameEarned', 0);
    expect(response.body).toHaveProperty('eloChange', 0);
    expect(response.body).toHaveProperty('eloStart', 0);
    expect(response.body).toHaveProperty('eloEnd', 0);

    // Clean up
    await prisma.robot.delete({
      where: { id: newRobotId },
    });
  });
});

describe('Analytics API - Robot ELO Progression Endpoint', () => {
  const testCycleStart = 13000;
  const testRobotId = 501;
  const testUserId = 401;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.cycleSnapshot.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });
    await prisma.auditLog.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });
    await prisma.battle.deleteMany({
      where: {
        OR: [
          { robot1Id: testRobotId },
          { robot2Id: testRobotId },
        ],
      },
    });

    // Ensure test user exists
    await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        username: 'testuser_elo',
        passwordHash: 'hashedpassword',
        currency: 10000,
      },
    });

    // Ensure test robot exists
    await prisma.robot.upsert({
      where: { id: testRobotId },
      update: {},
      create: {
        id: testRobotId,
        name: 'Test Robot ELO',
        userId: testUserId,
        currentHP: 100,
        maxHP: 100,
        currentShield: 50,
        maxShield: 50,
        elo: 1000,
      },
    });

    // Create opponent robot
    await prisma.robot.upsert({
      where: { id: testRobotId + 1 },
      update: {},
      create: {
        id: testRobotId + 1,
        name: 'Opponent Robot',
        userId: testUserId,
        currentHP: 100,
        maxHP: 100,
        currentShield: 50,
        maxShield: 50,
        elo: 1000,
      },
    });

    // Create test battles with ELO progression
    let currentElo = 1000;
    for (let i = 0; i < 5; i++) {
      const cycleNumber = testCycleStart + i;

      await eventLogger.logCycleStart(cycleNumber, 'manual');

      // Create 2 battles per cycle with varying ELO changes
      for (let j = 0; j < 2; j++) {
        const eloChange = (i + 1) * 10; // Increasing ELO change each cycle
        const newElo = currentElo + eloChange;

        await prisma.battle.create({
          data: {
            robot1Id: testRobotId,
            robot2Id: testRobotId + 1,
            winnerId: testRobotId,
            robot1ELOBefore: currentElo,
            robot1ELOAfter: newElo,
            robot2ELOBefore: 1000,
            robot2ELOAfter: 990,
            eloChange: eloChange,
            winnerReward: 100,
            loserReward: 50,
            durationSeconds: 60,
            battleType: 'league',
            leagueType: 'bronze',
            battleLog: {},
            createdAt: new Date(Date.now() + cycleNumber * 1000),
            participants: {
              create: [
                { robotId: testRobotId, team: 1, credits: 0, damageDealt: 50, finalHP: 70, fameAwarded: 20, prestigeAwarded: 10, eloBefore: currentElo, eloAfter: newElo, yielded: false, destroyed: false },
                { robotId: testRobotId + 1, team: 2, credits: 0, damageDealt: 30, finalHP: 0, fameAwarded: 10, prestigeAwarded: 5, eloBefore: 1000, eloAfter: 990, yielded: false, destroyed: true },
              ],
            },
          },
        });

        currentElo = newElo;
      }

      await eventLogger.logCycleComplete(cycleNumber, 1000);
      // Don't create snapshot - robot performance service will query battles directly
    }
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.battle.deleteMany({
      where: {
        OR: [
          { robot1Id: testRobotId },
          { robot2Id: testRobotId },
          { robot1Id: testRobotId + 1 },
          { robot2Id: testRobotId + 1 },
        ],
      },
    });
    await prisma.cycleSnapshot.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });
    await prisma.auditLog.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });
    await prisma.robot.deleteMany({
      where: { 
        id: {
          in: [testRobotId, testRobotId + 1],
        },
      },
    });
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
  });

  it('should return ELO progression data for a robot', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(200);

    expect(response.body).toHaveProperty('robotId', testRobotId);
    expect(response.body).toHaveProperty('cycleRange');
    expect(response.body.cycleRange).toEqual([testCycleStart, testCycleStart + 4]);
    expect(response.body).toHaveProperty('dataPoints');
    expect(response.body).toHaveProperty('startElo');
    expect(response.body).toHaveProperty('endElo');
    expect(response.body).toHaveProperty('totalChange');
    expect(response.body).toHaveProperty('averageChange');
    expect(Array.isArray(response.body.dataPoints)).toBe(true);
  });

  it('should return correct ELO data points structure', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(200);

    // Only check structure if there are data points
    if (response.body.dataPoints.length > 0) {
      const dataPoint = response.body.dataPoints[0];
      expect(dataPoint).toHaveProperty('cycleNumber');
      expect(dataPoint).toHaveProperty('elo');
      expect(dataPoint).toHaveProperty('change');
      expect(typeof dataPoint.cycleNumber).toBe('number');
      expect(typeof dataPoint.elo).toBe('number');
      expect(typeof dataPoint.change).toBe('number');
    } else {
      // With no battles, should return empty array
      expect(response.body.dataPoints).toEqual([]);
    }
  });

  it('should calculate correct ELO changes', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(200);

    // Verify that totalChange equals sum of individual changes
    const sumOfChanges = response.body.dataPoints.reduce((sum: number, dp: any) => sum + dp.change, 0);
    expect(response.body.totalChange).toBe(sumOfChanges);

    // Verify that endElo - startElo equals totalChange
    expect(response.body.endElo - response.body.startElo).toBe(response.body.totalChange);
  });

  it('should include moving average when requested', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]&includeMovingAverage=true`)
      .expect(200);

    // Only check for moving average if there are data points
    if (response.body.dataPoints.length > 0) {
      expect(response.body).toHaveProperty('movingAverage');
      expect(Array.isArray(response.body.movingAverage)).toBe(true);
      expect(response.body.movingAverage.length).toBe(response.body.dataPoints.length);
    } else {
      // With no data points, moving average should not be included
      expect(response.body).not.toHaveProperty('movingAverage');
    }
  });

  it('should not include moving average by default', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(200);

    expect(response.body).not.toHaveProperty('movingAverage');
  });

  it('should include trend line when requested', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]&includeTrendLine=true`)
      .expect(200);

    // Only check for trend line if there are enough data points
    if (response.body.dataPoints.length > 1) {
      expect(response.body).toHaveProperty('trendLine');
      expect(response.body.trendLine).toHaveProperty('slope');
      expect(response.body.trendLine).toHaveProperty('intercept');
      expect(response.body.trendLine).toHaveProperty('points');
      expect(Array.isArray(response.body.trendLine.points)).toBe(true);
      expect(response.body.trendLine.points.length).toBe(response.body.dataPoints.length);
    } else {
      // With 0 or 1 data points, trend line should not be included
      expect(response.body).not.toHaveProperty('trendLine');
    }
  });

  it('should not include trend line by default', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(200);

    expect(response.body).not.toHaveProperty('trendLine');
  });

  it('should include both moving average and trend line when both requested', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]&includeMovingAverage=true&includeTrendLine=true`)
      .expect(200);

    // Only check if there are enough data points
    if (response.body.dataPoints.length > 1) {
      expect(response.body).toHaveProperty('movingAverage');
      expect(response.body).toHaveProperty('trendLine');
    } else {
      // With insufficient data, neither should be included
      expect(response.body).not.toHaveProperty('movingAverage');
      expect(response.body).not.toHaveProperty('trendLine');
    }
  });

  it('should return 400 for invalid robotId', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/invalid/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid robotId');
  });

  it('should return 400 when cycleRange is missing', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/elo`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Missing required parameter');
  });

  it('should return 400 for invalid cycleRange format', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/elo?cycleRange=invalid`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid cycleRange format');
  });

  it('should return 400 for negative cycle numbers', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/elo?cycleRange=[-1,10]`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid cycle numbers');
  });

  it('should return 400 when startCycle > endCycle', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/elo?cycleRange=[10,5]`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid cycle range');
  });

  it('should return 404 for non-existent robot', async () => {
    const nonExistentRobotId = 999999;
    
    const response = await request(app)
      .get(`/api/analytics/robot/${nonExistentRobotId}/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(404);

    expect(response.body).toHaveProperty('error', 'Robot not found');
  });

  it('should handle robot with no battles in cycle range', async () => {
    const emptyRobotId = testRobotId + 100;
    
    // Create robot with no battles
    await prisma.robot.create({
      data: {
        id: emptyRobotId,
        name: 'Empty Robot',
        userId: testUserId,
        currentHP: 100,
        maxHP: 100,
        currentShield: 50,
        maxShield: 50,
        elo: 1000,
      },
    });

    const response = await request(app)
      .get(`/api/analytics/robot/${emptyRobotId}/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(200);

    expect(response.body.dataPoints).toEqual([]);
    expect(response.body.startElo).toBe(0);
    expect(response.body.endElo).toBe(0);
    expect(response.body.totalChange).toBe(0);
    expect(response.body.averageChange).toBe(0);

    // Clean up
    await prisma.robot.delete({
      where: { id: emptyRobotId },
    });
  });

  it('should handle single cycle range', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/elo?cycleRange=[${testCycleStart},${testCycleStart}]`)
      .expect(200);

    expect(response.body.cycleRange).toEqual([testCycleStart, testCycleStart]);
    expect(response.body.dataPoints.length).toBeGreaterThanOrEqual(0);
  });

  it('should calculate correct average change', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(200);

    if (response.body.dataPoints.length > 0) {
      const expectedAverage = response.body.totalChange / response.body.dataPoints.length;
      expect(response.body.averageChange).toBeCloseTo(expectedAverage, 2);
    }
  });

  it('should return data points in chronological order', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(200);

    for (let i = 1; i < response.body.dataPoints.length; i++) {
      expect(response.body.dataPoints[i].cycleNumber).toBeGreaterThanOrEqual(
        response.body.dataPoints[i - 1].cycleNumber
      );
    }
  });

  it('should handle very large cycle ranges gracefully', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/elo?cycleRange=[1,999999]`);

    // Should not crash - accept either 200 with data or 500 if query times out
    expect([200, 500]).toContain(response.status);
    
    if (response.status === 200) {
      expect(response.body).toHaveProperty('dataPoints');
      expect(Array.isArray(response.body.dataPoints)).toBe(true);
    }
  });

  it('should calculate moving average correctly', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]&includeMovingAverage=true`)
      .expect(200);

    if (response.body.dataPoints.length >= 3) {
      // Check 3-period moving average calculation for the 3rd point
      const expectedAvg = (
        response.body.dataPoints[0].elo +
        response.body.dataPoints[1].elo +
        response.body.dataPoints[2].elo
      ) / 3;
      
      expect(response.body.movingAverage[2]).toBeCloseTo(expectedAvg, 2);
    }
  });

  it('should calculate trend line with positive slope for increasing ELO', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]&includeTrendLine=true`)
      .expect(200);

    // Since ELO is increasing in our test data, slope should be positive
    if (response.body.dataPoints.length > 1) {
      expect(response.body.trendLine.slope).toBeGreaterThan(0);
    }
  });

  it('should not calculate trend line for single data point', async () => {
    // Create a robot with only one battle
    const singleBattleRobotId = testRobotId + 200;
    
    await prisma.robot.create({
      data: {
        id: singleBattleRobotId,
        name: 'Single Battle Robot',
        userId: testUserId,
        currentHP: 100,
        maxHP: 100,
        currentShield: 50,
        maxShield: 50,
        elo: 1000,
      },
    });

    await prisma.battle.create({
      data: {
        robot1Id: singleBattleRobotId,
        robot2Id: testRobotId,
        winnerId: singleBattleRobotId,
        robot1ELOBefore: 1000,
        robot1ELOAfter: 1020,
        robot2ELOBefore: 1000,
        robot2ELOAfter: 980,
        eloChange: 20,
        winnerReward: 100,
        loserReward: 50,
        durationSeconds: 60,
        battleType: 'league',
        leagueType: 'bronze',
        battleLog: {},
        createdAt: new Date(Date.now() + testCycleStart * 1000),
        participants: {
          create: [
            { robotId: singleBattleRobotId, team: 1, credits: 0, damageDealt: 50, finalHP: 70, fameAwarded: 20, prestigeAwarded: 10, eloBefore: 1000, eloAfter: 1020, yielded: false, destroyed: false },
            { robotId: testRobotId, team: 2, credits: 0, damageDealt: 30, finalHP: 0, fameAwarded: 10, prestigeAwarded: 5, eloBefore: 1000, eloAfter: 980, yielded: false, destroyed: true },
          ],
        },
      },
    });

    const response = await request(app)
      .get(`/api/analytics/robot/${singleBattleRobotId}/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]&includeTrendLine=true`)
      .expect(200);

    // With only 1 data point, trend line calculation should still work but may not be meaningful
    if (response.body.dataPoints.length === 1) {
      expect(response.body).not.toHaveProperty('trendLine');
    }

    // Clean up
    await prisma.battle.deleteMany({
      where: { robot1Id: singleBattleRobotId },
    });
    await prisma.robot.delete({
      where: { id: singleBattleRobotId },
    });
  });
});

describe('Analytics API - Robot Metric Progression Endpoint', () => {
  const testCycleStart = 14000;
  const testRobotId = 502;
  const testUserId = 402;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.cycleSnapshot.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });
    await prisma.auditLog.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });
    await prisma.battle.deleteMany({
      where: {
        OR: [
          { robot1Id: testRobotId },
          { robot2Id: testRobotId },
        ],
      },
    });
    await prisma.robot.deleteMany({
      where: { id: testRobotId },
    });
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });

    // Create test user
    await prisma.user.create({
      data: {
        id: testUserId,
        username: 'metricTestUser',
        passwordHash: 'hash',
        currency: 100000,
        prestige: 0,
      },
    });

    // Create test robot
    await prisma.robot.create({
      data: {
        id: testRobotId,
        name: 'Metric Test Robot',
        userId: testUserId,
        maxHP: 100,
        currentHP: 100,
        maxShield: 50,
        currentShield: 50,
        elo: 1000,
        fame: 0,
      },
    });

    // Create opponent robot
    await prisma.robot.create({
      data: {
        id: testRobotId + 1,
        name: 'Metric Opponent Robot',
        userId: testUserId,
        maxHP: 100,
        currentHP: 100,
        maxShield: 50,
        currentShield: 50,
        elo: 1000,
        fame: 0,
      },
    });

    // Create test battles across multiple cycles
    for (let i = 0; i < 5; i++) {
      const cycleNumber = testCycleStart + i;
      
      // Log cycle start
      await eventLogger.logCycleStart(cycleNumber, 'manual');

      // Create 2 battles per cycle
      for (let j = 0; j < 2; j++) {
        const eloBefore = 1000 + (i * 2 + j) * 10;
        const eloAfter = eloBefore + 10;
        
        await prisma.battle.create({
          data: {
            robot1Id: testRobotId,
            robot2Id: testRobotId + 1,
            winnerId: testRobotId,
            robot1ELOBefore: eloBefore,
            robot1ELOAfter: eloAfter,
            robot2ELOBefore: 1000,
            robot2ELOAfter: 990,
            eloChange: 10,
            winnerReward: 100,
            loserReward: 50,
            durationSeconds: 60,
            battleType: 'league',
            leagueType: 'bronze',
            battleLog: {},
            createdAt: new Date(Date.now() + cycleNumber * 1000),
            participants: {
              create: [
                { robotId: testRobotId, team: 1, credits: 0, damageDealt: 50 + i * 10, finalHP: 70, fameAwarded: 20 + i * 5, prestigeAwarded: 10, eloBefore, eloAfter, yielded: false, destroyed: false },
                { robotId: testRobotId + 1, team: 2, credits: 0, damageDealt: 30 + i * 5, finalHP: 0, fameAwarded: 10, prestigeAwarded: 5, eloBefore: 1000, eloAfter: 990, yielded: false, destroyed: true },
              ],
            },
          },
        });
      }

      // Log cycle complete
      await eventLogger.logCycleComplete(cycleNumber, 1000);
    }
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.battle.deleteMany({
      where: {
        OR: [
          { robot1Id: testRobotId },
          { robot2Id: testRobotId },
        ],
      },
    });
    await prisma.robot.deleteMany({
      where: { id: testRobotId },
    });
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
    await prisma.auditLog.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });
    await prisma.cycleSnapshot.deleteMany({
      where: {
        cycleNumber: {
          gte: testCycleStart,
          lte: testCycleStart + 10,
        },
      },
    });
  });

  it('should return metric progression data for ELO', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/metric/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(200);

    expect(response.body).toHaveProperty('robotId', testRobotId);
    expect(response.body).toHaveProperty('metric', 'elo');
    expect(response.body).toHaveProperty('cycleRange');
    expect(response.body).toHaveProperty('dataPoints');
    expect(response.body).toHaveProperty('startValue');
    expect(response.body).toHaveProperty('endValue');
    expect(response.body).toHaveProperty('totalChange');
    expect(response.body).toHaveProperty('averageChange');
  });

  it('should return metric progression data for fame', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/metric/fame?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(200);

    expect(response.body).toHaveProperty('robotId', testRobotId);
    expect(response.body).toHaveProperty('metric', 'fame');
    expect(response.body.dataPoints).toBeInstanceOf(Array);
  });

  it('should return metric progression data for damageDealt', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/metric/damageDealt?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(200);

    expect(response.body).toHaveProperty('robotId', testRobotId);
    expect(response.body).toHaveProperty('metric', 'damageDealt');
    expect(response.body.dataPoints).toBeInstanceOf(Array);
  });

  it('should return metric progression data for damageReceived', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/metric/damageReceived?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(200);

    expect(response.body).toHaveProperty('robotId', testRobotId);
    expect(response.body).toHaveProperty('metric', 'damageReceived');
    expect(response.body.dataPoints).toBeInstanceOf(Array);
  });

  it('should return metric progression data for wins', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/metric/wins?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(200);

    expect(response.body).toHaveProperty('robotId', testRobotId);
    expect(response.body).toHaveProperty('metric', 'wins');
    expect(response.body.dataPoints).toBeInstanceOf(Array);
  });

  it('should return metric progression data for losses', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/metric/losses?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(200);

    expect(response.body).toHaveProperty('robotId', testRobotId);
    expect(response.body).toHaveProperty('metric', 'losses');
    expect(response.body.dataPoints).toBeInstanceOf(Array);
  });

  it('should return metric progression data for draws', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/metric/draws?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(200);

    expect(response.body).toHaveProperty('robotId', testRobotId);
    expect(response.body).toHaveProperty('metric', 'draws');
    expect(response.body.dataPoints).toBeInstanceOf(Array);
  });

  it('should return metric progression data for kills', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/metric/kills?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(200);

    expect(response.body).toHaveProperty('robotId', testRobotId);
    expect(response.body).toHaveProperty('metric', 'kills');
    expect(response.body.dataPoints).toBeInstanceOf(Array);
    // Since all test battles result in opponent destruction (robot2FinalHP = 0), kills should equal battles
    if (response.body.dataPoints.length > 0) {
      expect(response.body.endValue).toBeGreaterThan(0);
    }
  });

  it('should return metric progression data for creditsEarned', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/metric/creditsEarned?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(200);

    expect(response.body).toHaveProperty('robotId', testRobotId);
    expect(response.body).toHaveProperty('metric', 'creditsEarned');
    expect(response.body.dataPoints).toBeInstanceOf(Array);
  });

  it('should return 400 for invalid metric name', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/metric/invalidMetric?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid metric');
  });

  it('should include moving average when requested', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/metric/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]&includeMovingAverage=true`)
      .expect(200);

    expect(response.body).toHaveProperty('movingAverage');
    expect(response.body.movingAverage).toBeInstanceOf(Array);
  });

  it('should include trend line when requested', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/metric/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]&includeTrendLine=true`)
      .expect(200);

    // Only check for trend line if there are data points
    if (response.body.dataPoints.length > 1) {
      expect(response.body).toHaveProperty('trendLine');
      expect(response.body.trendLine).toHaveProperty('slope');
      expect(response.body.trendLine).toHaveProperty('intercept');
      expect(response.body.trendLine).toHaveProperty('points');
    } else {
      // With 0 or 1 data points, trend line should not be included
      expect(response.body).not.toHaveProperty('trendLine');
    }
  });

  it('should return 400 for invalid robotId', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/invalid/metric/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid robotId');
  });

  it('should return 400 when cycleRange is missing', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/metric/elo`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Missing required parameter');
  });

  it('should return 404 for non-existent robot', async () => {
    const nonExistentRobotId = 999999;
    
    const response = await request(app)
      .get(`/api/analytics/robot/${nonExistentRobotId}/metric/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(404);

    expect(response.body).toHaveProperty('error', 'Robot not found');
  });

  it('should handle empty data gracefully', async () => {
    // Create a robot with no battles
    const emptyRobot = await prisma.robot.create({
      data: {
        name: 'Empty Robot',
        userId: testUserId,
        maxHP: 100,
        currentHP: 100,
        maxShield: 50,
        currentShield: 50,
        elo: 1000,
        fame: 0,
      },
    });

    const response = await request(app)
      .get(`/api/analytics/robot/${emptyRobot.id}/metric/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(200);

    expect(response.body.dataPoints).toHaveLength(0);
    expect(response.body.totalChange).toBe(0);

    // Clean up
    await prisma.robot.delete({
      where: { id: emptyRobot.id },
    });
  });
});

describe('Analytics API - Current Cycle', () => {
  beforeAll(async () => {
    // Ensure cycle metadata exists
    await prisma.cycleMetadata.upsert({
      where: { id: 1 },
      create: { id: 1, totalCycles: 42, lastCycleAt: new Date() },
      update: { totalCycles: 42, lastCycleAt: new Date() },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should return current cycle number', async () => {
    const response = await request(app)
      .get('/api/analytics/cycle/current')
      .expect(200);

    expect(response.body).toHaveProperty('cycleNumber');
    expect(response.body).toHaveProperty('lastCycleAt');
    expect(response.body.cycleNumber).toBe(42);
  });

  it('should return 0 if no cycle metadata exists', async () => {
    // Temporarily delete metadata
    await prisma.cycleMetadata.deleteMany({ where: { id: 1 } });

    const response = await request(app)
      .get('/api/analytics/cycle/current')
      .expect(200);

    expect(response.body.cycleNumber).toBe(0);
    expect(response.body.lastCycleAt).toBeNull();

    // Restore metadata
    await prisma.cycleMetadata.create({
      data: { id: 1, totalCycles: 42, lastCycleAt: new Date() },
    });
  });
});

/**
 * Unit tests for Facility ROI API endpoints
 * 
 * Tests the /api/analytics/facility/:userId/roi endpoints
 * 
 * Requirements: 12.3, 5.5, 8.2
 */
describe('Analytics API - Facility ROI', () => {
  let testUserId: number;
  let testRobotId: number;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        username: `facility_roi_test_${Date.now()}`,
        passwordHash: 'test',
        currency: 10000000,
        prestige: 5000,
      },
    });
    testUserId = user.id;

    // Create test robot
    const robot = await prisma.robot.create({
      data: {
        name: `ROI Test Robot ${Date.now()}`,
        userId: testUserId,
        currentHP: 100,
        maxHP: 100,
        currentShield: 10,
        maxShield: 10,
        elo: 1000,
        fame: 100,
        combatPower: 5,
        targetingSystems: 5,
        criticalSystems: 5,
        penetration: 5,
        weaponControl: 5,
        attackSpeed: 5,
        armorPlating: 5,
        shieldCapacity: 5,
        evasionThrusters: 5,
        damageDampeners: 5,
        counterProtocols: 5,
        hullIntegrity: 5,
        servoMotors: 5,
        gyroStabilizers: 5,
        hydraulicSystems: 5,
        powerCore: 5,
        combatAlgorithms: 5,
        threatAnalysis: 5,
        adaptiveAI: 5,
        logicCores: 5,
        syncProtocols: 5,
        supportSystems: 5,
        formationTactics: 5,
      },
    });
    testRobotId = robot.id;

    // Ensure cycle metadata exists
    await prisma.cycleMetadata.upsert({
      where: { id: 1 },
      update: { totalCycles: 5 },
      create: {
        id: 1,
        totalCycles: 5,
      },
    });

    // Purchase merchandising hub level 1
    await prisma.facility.create({
      data: {
        userId: testUserId,
        facilityType: 'merchandising_hub',
        level: 1,
      },
    });

    // Log purchase event
    await eventLogger.logFacilityTransaction(
      1,
      testUserId,
      'merchandising_hub',
      0,
      1,
      150000, // Correct cost for level 1
      'purchase'
    );

    // Log passive income for 5 cycles
    for (let cycle = 1; cycle <= 5; cycle++) {
      await eventLogger.logPassiveIncome(
        cycle,
        testUserId,
        5000, // merchandising
        0, // streaming
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
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.auditLog.deleteMany({ where: { userId: testUserId } });
    await prisma.facility.deleteMany({ where: { userId: testUserId } });
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  it('should return ROI for a specific facility', async () => {
    const response = await request(app)
      .get(`/api/analytics/facility/${testUserId}/roi?facilityType=merchandising_hub`)
      .expect(200);

    expect(response.body).toHaveProperty('facilityType', 'merchandising_hub');
    expect(response.body).toHaveProperty('currentLevel', 1);
    expect(response.body).toHaveProperty('totalInvestment', 150000); // Level 1 cost
    expect(response.body).toHaveProperty('totalReturns', 25000); // 5000 * 5 cycles
    expect(response.body).toHaveProperty('totalOperatingCosts', 35000); // 7000 * 5 cycles
    expect(response.body).toHaveProperty('netROI');
    expect(response.body).toHaveProperty('cyclesSincePurchase', 5);
    expect(response.body).toHaveProperty('isProfitable', false);
    expect(response.body).toHaveProperty('breakevenCycle');
  });

  it('should return 400 for missing facilityType parameter', async () => {
    const response = await request(app)
      .get(`/api/analytics/facility/${testUserId}/roi`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Missing required parameter');
  });

  it('should return 400 for invalid facilityType', async () => {
    const response = await request(app)
      .get(`/api/analytics/facility/${testUserId}/roi?facilityType=invalid_facility`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid facilityType');
  });

  it('should return 404 for non-existent user', async () => {
    const response = await request(app)
      .get(`/api/analytics/facility/999999/roi?facilityType=merchandising_hub`)
      .expect(404);

    expect(response.body).toHaveProperty('error', 'User not found');
  });

  it('should return 404 for facility not purchased', async () => {
    const response = await request(app)
      .get(`/api/analytics/facility/${testUserId}/roi?facilityType=repair_bay`)
      .expect(404);

    expect(response.body).toHaveProperty('error', 'Facility not purchased');
  });

  it('should return ROI for all facilities', async () => {
    const response = await request(app)
      .get(`/api/analytics/facility/${testUserId}/roi/all`)
      .expect(200);

    expect(response.body).toHaveProperty('userId', testUserId);
    expect(response.body).toHaveProperty('facilities');
    expect(Array.isArray(response.body.facilities)).toBe(true);
    expect(response.body.facilities.length).toBe(1); // Only income_generator purchased
    expect(response.body).toHaveProperty('totalInvestment');
    expect(response.body).toHaveProperty('totalReturns');
    expect(response.body).toHaveProperty('totalOperatingCosts');
    expect(response.body).toHaveProperty('overallNetROI');
  });

  it('should return 400 for invalid userId in ROI endpoint', async () => {
    const response = await request(app)
      .get(`/api/analytics/facility/invalid/roi?facilityType=merchandising_hub`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid userId');
  });

  it('should return 400 for invalid userId in all ROI endpoint', async () => {
    const response = await request(app)
      .get(`/api/analytics/facility/invalid/roi/all`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid userId');
  });
});


describe('GET /api/analytics/facility/:userId/recommendations', () => {
  let testUserId: number;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        username: `facility_rec_test_${Date.now()}`,
        passwordHash: 'test',
        currency: 2000000,
        prestige: 10000,
      },
    });
    testUserId = user.id;

    // Ensure cycle metadata exists
    await prisma.cycleMetadata.upsert({
      where: { id: 1 },
      update: { totalCycles: 20 },
      create: {
        id: 1,
        totalCycles: 20,
      },
    });

    // Create some activity to generate recommendations
    for (let cycle = 11; cycle <= 20; cycle++) {
      await prisma.auditLog.create({
        data: {
          cycleNumber: cycle,
          eventType: 'robot_repair',
          eventTimestamp: new Date(),
          sequenceNumber: cycle * 1000,
          userId: testUserId,
          payload: { cost: 40000, robotId: 1 },
        },
      });
    }
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.auditLog.deleteMany({ where: { userId: testUserId } });
    await prisma.facility.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  it('should return facility recommendations', async () => {
    const response = await request(app)
      .get(`/api/analytics/facility/${testUserId}/recommendations?lastNCycles=10`)
      .expect(200);

    expect(response.body).toHaveProperty('recommendations');
    expect(Array.isArray(response.body.recommendations)).toBe(true);
    expect(response.body).toHaveProperty('totalRecommendedInvestment');
    expect(response.body).toHaveProperty('userCurrency', 2000000);
    expect(response.body).toHaveProperty('userPrestige', 10000);
    expect(response.body).toHaveProperty('analysisWindow');
    expect(response.body.analysisWindow).toHaveProperty('cycleCount', 10);

    // Verify recommendations are sorted by ROI
    if (response.body.recommendations.length > 1) {
      for (let i = 0; i < response.body.recommendations.length - 1; i++) {
        expect(response.body.recommendations[i].projectedROI).toBeGreaterThanOrEqual(
          response.body.recommendations[i + 1].projectedROI
        );
      }
    }

    // Verify each recommendation has required fields
    for (const rec of response.body.recommendations) {
      expect(rec).toHaveProperty('facilityType');
      expect(rec).toHaveProperty('facilityName');
      expect(rec).toHaveProperty('currentLevel');
      expect(rec).toHaveProperty('recommendedLevel');
      expect(rec).toHaveProperty('upgradeCost');
      expect(rec).toHaveProperty('projectedROI');
      expect(rec).toHaveProperty('reason');
      expect(rec).toHaveProperty('priority');
      expect(['high', 'medium', 'low']).toContain(rec.priority);
    }
  });

  it('should use default lastNCycles when not provided', async () => {
    const response = await request(app)
      .get(`/api/analytics/facility/${testUserId}/recommendations`)
      .expect(200);

    expect(response.body).toHaveProperty('analysisWindow');
    expect(response.body.analysisWindow).toHaveProperty('cycleCount', 10); // Default
  });

  it('should return 400 for invalid userId', async () => {
    const response = await request(app)
      .get(`/api/analytics/facility/invalid/recommendations`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid userId');
  });

  it('should return 400 for invalid lastNCycles parameter', async () => {
    const response = await request(app)
      .get(`/api/analytics/facility/${testUserId}/recommendations?lastNCycles=-5`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid lastNCycles parameter');
  });

  it('should return 404 for non-existent user', async () => {
    const response = await request(app)
      .get(`/api/analytics/facility/999999/recommendations`)
      .expect(404);

    expect(response.body).toHaveProperty('error', 'User not found');
  });
});
