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
  it('should return 404 when no snapshots exist', async () => {
    // Temporarily clear all snapshots
    const allSnapshots = await prisma.cycleSnapshot.findMany();
    await prisma.cycleSnapshot.deleteMany();

    const response = await request(app)
      .get('/api/analytics/stable/1/summary')
      .expect(404);

    expect(response.body).toHaveProperty('error', 'No cycle snapshots found');

    // Restore snapshots
    for (const snapshot of allSnapshots) {
      await prisma.cycleSnapshot.create({
        data: {
          cycleNumber: snapshot.cycleNumber,
          triggerType: snapshot.triggerType,
          startTime: snapshot.startTime,
          endTime: snapshot.endTime,
          durationMs: snapshot.durationMs,
          stableMetrics: snapshot.stableMetrics,
          robotMetrics: snapshot.robotMetrics,
          stepDurations: snapshot.stepDurations,
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

describe('Analytics API - Comparison Endpoint', () => {
  const testCycleStart = 10000;
  const testUserId = 201;

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

    // Create test snapshots for comparison
    // Cycle 1: baseline metrics
    await eventLogger.logCycleStart(testCycleStart, 'manual');
    await eventLogger.logPassiveIncome(
      testCycleStart,
      testUserId,
      100, // merchandising
      50,  // streaming
      1,   // facility level
      100, // prestige
      10,  // total battles
      500  // total fame
    );
    await eventLogger.logOperatingCosts(
      testCycleStart,
      testUserId,
      [{ facilityType: 'income_generator', level: 1, cost: 20 }],
      20
    );
    await eventLogger.logCycleComplete(testCycleStart, 1000);
    await cycleSnapshotService.createSnapshot(testCycleStart);

    // Cycle 2: improved metrics (50% increase)
    await eventLogger.logCycleStart(testCycleStart + 1, 'manual');
    await eventLogger.logPassiveIncome(
      testCycleStart + 1,
      testUserId,
      150, // merchandising (+50%)
      75,  // streaming (+50%)
      1,   // facility level
      150, // prestige
      15,  // total battles
      750  // total fame
    );
    await eventLogger.logOperatingCosts(
      testCycleStart + 1,
      testUserId,
      [{ facilityType: 'income_generator', level: 1, cost: 30 }],
      30
    );
    await eventLogger.logCycleComplete(testCycleStart + 1, 1000);
    await cycleSnapshotService.createSnapshot(testCycleStart + 1);
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

  it('should return comparison between two cycles', async () => {
    const response = await request(app)
      .get(`/api/analytics/comparison?current=${testCycleStart + 1}&comparison=${testCycleStart}`)
      .expect(200);

    expect(response.body).toHaveProperty('currentCycle', testCycleStart + 1);
    expect(response.body).toHaveProperty('comparisonCycle', testCycleStart);
    expect(response.body).toHaveProperty('stableComparisons');
    expect(response.body).toHaveProperty('robotComparisons');
    expect(Array.isArray(response.body.stableComparisons)).toBe(true);
    expect(Array.isArray(response.body.robotComparisons)).toBe(true);
  });

  it('should calculate correct deltas and percentage changes', async () => {
    const response = await request(app)
      .get(`/api/analytics/comparison?current=${testCycleStart + 1}&comparison=${testCycleStart}&userId=${testUserId}`)
      .expect(200);

    expect(response.body.stableComparisons.length).toBe(1);
    
    const comparison = response.body.stableComparisons[0];
    expect(comparison.userId).toBe(testUserId);

    // Check merchandising income comparison (100 -> 150, +50, +50%)
    expect(comparison.merchandisingIncome.current).toBe(150);
    expect(comparison.merchandisingIncome.comparison).toBe(100);
    expect(comparison.merchandisingIncome.delta).toBe(50);
    expect(comparison.merchandisingIncome.percentChange).toBe(50);

    // Check streaming income comparison (50 -> 75, +25, +50%)
    expect(comparison.streamingIncome.current).toBe(75);
    expect(comparison.streamingIncome.comparison).toBe(50);
    expect(comparison.streamingIncome.delta).toBe(25);
    expect(comparison.streamingIncome.percentChange).toBe(50);
  });

  it('should filter by userId when provided', async () => {
    const response = await request(app)
      .get(`/api/analytics/comparison?current=${testCycleStart + 1}&comparison=${testCycleStart}&userId=${testUserId}`)
      .expect(200);

    expect(response.body.stableComparisons.length).toBe(1);
    expect(response.body.stableComparisons[0].userId).toBe(testUserId);
  });

  it('should return all users when userId is not provided', async () => {
    const response = await request(app)
      .get(`/api/analytics/comparison?current=${testCycleStart + 1}&comparison=${testCycleStart}`)
      .expect(200);

    // Should include all users with activity in either cycle
    expect(response.body.stableComparisons.length).toBeGreaterThanOrEqual(1);
  });

  it('should return 400 when current parameter is missing', async () => {
    const response = await request(app)
      .get(`/api/analytics/comparison?comparison=${testCycleStart}`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Missing required parameters');
  });

  it('should return 400 when comparison parameter is missing', async () => {
    const response = await request(app)
      .get(`/api/analytics/comparison?current=${testCycleStart}`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Missing required parameters');
  });

  it('should return 400 for invalid current parameter', async () => {
    const response = await request(app)
      .get(`/api/analytics/comparison?current=invalid&comparison=${testCycleStart}`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid parameters');
  });

  it('should return 400 for invalid comparison parameter', async () => {
    const response = await request(app)
      .get(`/api/analytics/comparison?current=${testCycleStart}&comparison=invalid`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid parameters');
  });

  it('should return 400 for invalid userId parameter', async () => {
    const response = await request(app)
      .get(`/api/analytics/comparison?current=${testCycleStart}&comparison=${testCycleStart}&userId=invalid`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid userId');
  });

  it('should return 400 for negative cycle numbers', async () => {
    const response = await request(app)
      .get(`/api/analytics/comparison?current=-1&comparison=${testCycleStart}`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid cycle numbers');
  });

  it('should return 404 when current cycle snapshot does not exist', async () => {
    const nonExistentCycle = 999999;
    
    const response = await request(app)
      .get(`/api/analytics/comparison?current=${nonExistentCycle}&comparison=${testCycleStart}`)
      .expect(404);

    expect(response.body).toHaveProperty('error', 'Snapshot not found');
  });

  it('should handle missing comparison snapshot gracefully', async () => {
    const nonExistentCycle = 999998;
    
    const response = await request(app)
      .get(`/api/analytics/comparison?current=${testCycleStart}&comparison=${nonExistentCycle}`)
      .expect(200);

    // Should return unavailableMetrics field
    expect(response.body).toHaveProperty('unavailableMetrics');
    expect(response.body.unavailableMetrics).toContain('all');
    expect(response.body.stableComparisons).toEqual([]);
    expect(response.body.robotComparisons).toEqual([]);
  });

  it('should include all metric comparisons in response', async () => {
    const response = await request(app)
      .get(`/api/analytics/comparison?current=${testCycleStart + 1}&comparison=${testCycleStart}&userId=${testUserId}`)
      .expect(200);

    const comparison = response.body.stableComparisons[0];
    
    // Verify all stable metrics are present
    expect(comparison).toHaveProperty('battlesParticipated');
    expect(comparison).toHaveProperty('totalCreditsEarned');
    expect(comparison).toHaveProperty('totalPrestigeEarned');
    expect(comparison).toHaveProperty('totalRepairCosts');
    expect(comparison).toHaveProperty('merchandisingIncome');
    expect(comparison).toHaveProperty('streamingIncome');
    expect(comparison).toHaveProperty('operatingCosts');
    expect(comparison).toHaveProperty('netProfit');

    // Each metric should have the comparison structure
    Object.keys(comparison).forEach(key => {
      if (key !== 'userId') {
        expect(comparison[key]).toHaveProperty('current');
        expect(comparison[key]).toHaveProperty('comparison');
        expect(comparison[key]).toHaveProperty('delta');
        expect(comparison[key]).toHaveProperty('percentChange');
      }
    });
  });

  it('should handle comparison with zero baseline (infinite growth)', async () => {
    // Create a cycle where user has no activity (baseline = 0)
    const zeroCycle = testCycleStart + 5;
    await eventLogger.logCycleStart(zeroCycle, 'manual');
    await eventLogger.logCycleComplete(zeroCycle, 1000);
    await cycleSnapshotService.createSnapshot(zeroCycle);

    const response = await request(app)
      .get(`/api/analytics/comparison?current=${testCycleStart}&comparison=${zeroCycle}&userId=${testUserId}`)
      .expect(200);

    const comparison = response.body.stableComparisons[0];
    
    // When comparison is 0 and current is not, percentChange should be null
    expect(comparison.merchandisingIncome.comparison).toBe(0);
    expect(comparison.merchandisingIncome.current).toBe(100);
    expect(comparison.merchandisingIncome.delta).toBe(100);
    expect(comparison.merchandisingIncome.percentChange).toBeNull();

    // Clean up
    await prisma.cycleSnapshot.deleteMany({
      where: { cycleNumber: zeroCycle },
    });
    await prisma.auditLog.deleteMany({
      where: { cycleNumber: zeroCycle },
    });
  });

  it('should handle comparison where both values are zero', async () => {
    const zeroCycle1 = testCycleStart + 6;
    const zeroCycle2 = testCycleStart + 7;
    
    // Create two cycles with no activity for the test user
    await eventLogger.logCycleStart(zeroCycle1, 'manual');
    await eventLogger.logCycleComplete(zeroCycle1, 1000);
    await cycleSnapshotService.createSnapshot(zeroCycle1);

    await eventLogger.logCycleStart(zeroCycle2, 'manual');
    await eventLogger.logCycleComplete(zeroCycle2, 1000);
    await cycleSnapshotService.createSnapshot(zeroCycle2);

    const response = await request(app)
      .get(`/api/analytics/comparison?current=${zeroCycle2}&comparison=${zeroCycle1}&userId=${testUserId}`)
      .expect(200);

    // When user has no activity in either cycle, no comparison is returned
    // This is expected behavior - the comparison service only returns comparisons for users with activity
    expect(response.body.stableComparisons.length).toBe(0);

    // Clean up
    await prisma.cycleSnapshot.deleteMany({
      where: { cycleNumber: { in: [zeroCycle1, zeroCycle2] } },
    });
    await prisma.auditLog.deleteMany({
      where: { cycleNumber: { in: [zeroCycle1, zeroCycle2] } },
    });
  });

  it('should handle negative deltas correctly', async () => {
    // Create a cycle with decreased metrics
    const decreasedCycle = testCycleStart + 8;
    await eventLogger.logCycleStart(decreasedCycle, 'manual');
    await eventLogger.logPassiveIncome(
      decreasedCycle,
      testUserId,
      50,  // merchandising (decreased from 100)
      25,  // streaming (decreased from 50)
      1,   // facility level
      50,  // prestige
      5,   // total battles
      250  // total fame
    );
    await eventLogger.logOperatingCosts(
      decreasedCycle,
      testUserId,
      [{ facilityType: 'income_generator', level: 1, cost: 10 }],
      10
    );
    await eventLogger.logCycleComplete(decreasedCycle, 1000);
    await cycleSnapshotService.createSnapshot(decreasedCycle);

    const response = await request(app)
      .get(`/api/analytics/comparison?current=${decreasedCycle}&comparison=${testCycleStart}&userId=${testUserId}`)
      .expect(200);

    const comparison = response.body.stableComparisons[0];
    
    // Check negative deltas (50 vs 100 = -50, -50%)
    expect(comparison.merchandisingIncome.current).toBe(50);
    expect(comparison.merchandisingIncome.comparison).toBe(100);
    expect(comparison.merchandisingIncome.delta).toBe(-50);
    expect(comparison.merchandisingIncome.percentChange).toBe(-50);

    // Clean up
    await prisma.cycleSnapshot.deleteMany({
      where: { cycleNumber: decreasedCycle },
    });
    await prisma.auditLog.deleteMany({
      where: { cycleNumber: decreasedCycle },
    });
  });
});

describe('Analytics API - Trends Endpoint', () => {
  const testCycleStart = 11000;
  const testUserId = 301;
  const testRobotId = 401;

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

    // Create test snapshots with trend data
    for (let i = 0; i < 5; i++) {
      const cycleNumber = testCycleStart + i;

      await eventLogger.logCycleStart(cycleNumber, 'manual');
      
      // Stable metrics with increasing trend
      await eventLogger.logPassiveIncome(
        cycleNumber,
        testUserId,
        100 + (i * 20), // merchandising increases by 20 each cycle
        50 + (i * 10),  // streaming increases by 10 each cycle
        1,
        100,
        10,
        500
      );
      await eventLogger.logOperatingCosts(
        cycleNumber,
        testUserId,
        [{ facilityType: 'income_generator', level: 1, cost: 20 }],
        20
      );

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

  it('should return trend data for stable income metric', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${testUserId}&metric=income&startCycle=${testCycleStart}&endCycle=${testCycleStart + 4}`)
      .expect(200);

    expect(response.body).toHaveProperty('metric', 'income');
    expect(response.body).toHaveProperty('cycleRange');
    expect(response.body.cycleRange).toEqual([testCycleStart, testCycleStart + 4]);
    expect(response.body).toHaveProperty('data');
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBe(5);

    // Verify data points have correct structure
    response.body.data.forEach((point: any) => {
      expect(point).toHaveProperty('cycleNumber');
      expect(point).toHaveProperty('value');
      expect(point).toHaveProperty('timestamp');
    });
  });

  it('should calculate correct income values', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${testUserId}&metric=income&startCycle=${testCycleStart}&endCycle=${testCycleStart + 4}`)
      .expect(200);

    // Cycle 0: 100 + 50 = 150
    // Cycle 1: 120 + 60 = 180
    // Cycle 2: 140 + 70 = 210
    // Cycle 3: 160 + 80 = 240
    // Cycle 4: 180 + 90 = 270
    expect(response.body.data[0].value).toBe(150);
    expect(response.body.data[1].value).toBe(180);
    expect(response.body.data[2].value).toBe(210);
    expect(response.body.data[3].value).toBe(240);
    expect(response.body.data[4].value).toBe(270);
  });

  it('should include moving averages when requested', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${testUserId}&metric=income&startCycle=${testCycleStart}&endCycle=${testCycleStart + 4}&includeMovingAverage=true`)
      .expect(200);

    expect(response.body).toHaveProperty('movingAverage3');
    expect(response.body).toHaveProperty('movingAverage7');
    expect(Array.isArray(response.body.movingAverage3)).toBe(true);
    
    // 3-cycle moving average should have 3 data points (cycles 2, 3, 4)
    expect(response.body.movingAverage3.length).toBe(3);
    
    // Verify moving average structure
    response.body.movingAverage3.forEach((point: any) => {
      expect(point).toHaveProperty('cycleNumber');
      expect(point).toHaveProperty('value');
      expect(point).toHaveProperty('average');
    });
  });

  it('should include trend line when requested', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${testUserId}&metric=income&startCycle=${testCycleStart}&endCycle=${testCycleStart + 4}&includeTrendLine=true`)
      .expect(200);

    expect(response.body).toHaveProperty('trendLine');
    expect(response.body.trendLine).toHaveProperty('slope');
    expect(response.body.trendLine).toHaveProperty('intercept');
    expect(response.body.trendLine).toHaveProperty('points');
    expect(Array.isArray(response.body.trendLine.points)).toBe(true);
    expect(response.body.trendLine.points.length).toBe(5);

    // Verify trend line has positive slope (increasing trend)
    expect(response.body.trendLine.slope).toBeGreaterThan(0);
  });

  it('should support expenses metric', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${testUserId}&metric=expenses&startCycle=${testCycleStart}&endCycle=${testCycleStart + 4}`)
      .expect(200);

    expect(response.body.metric).toBe('expenses');
    expect(response.body.data.length).toBe(5);
    
    // All cycles have 20 in expenses
    response.body.data.forEach((point: any) => {
      expect(point.value).toBe(20);
    });
  });

  it('should support netProfit metric', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${testUserId}&metric=netProfit&startCycle=${testCycleStart}&endCycle=${testCycleStart + 4}`)
      .expect(200);

    expect(response.body.metric).toBe('netProfit');
    expect(response.body.data.length).toBe(5);
    
    // Net profit = income - expenses
    // Cycle 0: 150 - 20 = 130
    // Cycle 4: 270 - 20 = 250
    expect(response.body.data[0].value).toBe(130);
    expect(response.body.data[4].value).toBe(250);
  });

  it('should return 400 when userId and robotId are both missing', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?metric=income&startCycle=${testCycleStart}&endCycle=${testCycleStart + 4}`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Missing required parameter');
    expect(response.body.message).toContain('Either "userId" or "robotId"');
  });

  it('should return 400 when both userId and robotId are provided', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${testUserId}&robotId=${testRobotId}&metric=income&startCycle=${testCycleStart}&endCycle=${testCycleStart + 4}`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid parameters');
    expect(response.body.message).toContain('mutually exclusive');
  });

  it('should return 400 when metric is missing', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${testUserId}&startCycle=${testCycleStart}&endCycle=${testCycleStart + 4}`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Missing required parameter');
    expect(response.body.message).toContain('metric');
  });

  it('should return 400 when startCycle is missing', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${testUserId}&metric=income&endCycle=${testCycleStart + 4}`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Missing required parameters');
  });

  it('should return 400 when endCycle is missing', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${testUserId}&metric=income&startCycle=${testCycleStart}`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Missing required parameters');
  });

  it('should return 400 for invalid metric', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${testUserId}&metric=invalidMetric&startCycle=${testCycleStart}&endCycle=${testCycleStart + 4}`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid metric');
  });

  it('should return 400 when startCycle > endCycle', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${testUserId}&metric=income&startCycle=${testCycleStart + 4}&endCycle=${testCycleStart}`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid cycle range');
  });

  it('should return 400 for invalid userId', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=invalid&metric=income&startCycle=${testCycleStart}&endCycle=${testCycleStart + 4}`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid userId');
  });

  it('should return 400 for negative cycle numbers', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${testUserId}&metric=income&startCycle=-1&endCycle=${testCycleStart + 4}`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid cycle numbers');
  });

  it('should return 400 when using robot metric with userId', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${testUserId}&metric=elo&startCycle=${testCycleStart}&endCycle=${testCycleStart + 4}`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid metric for userId');
  });

  it('should return 400 when using stable metric with robotId', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?robotId=${testRobotId}&metric=income&startCycle=${testCycleStart}&endCycle=${testCycleStart + 4}`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid metric for robotId');
  });

  it('should handle user with no data in cycle range', async () => {
    const nonExistentUserId = 999997;
    
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${nonExistentUserId}&metric=income&startCycle=${testCycleStart}&endCycle=${testCycleStart + 4}`)
      .expect(200);

    expect(response.body.data).toEqual([]);
  });

  it('should handle single cycle range', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${testUserId}&metric=income&startCycle=${testCycleStart}&endCycle=${testCycleStart}`)
      .expect(200);

    expect(response.body.data.length).toBe(1);
    expect(response.body.data[0].cycleNumber).toBe(testCycleStart);
  });

  it('should not include moving averages by default', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${testUserId}&metric=income&startCycle=${testCycleStart}&endCycle=${testCycleStart + 4}`)
      .expect(200);

    expect(response.body).not.toHaveProperty('movingAverage3');
    expect(response.body).not.toHaveProperty('movingAverage7');
  });

  it('should not include trend line by default', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${testUserId}&metric=income&startCycle=${testCycleStart}&endCycle=${testCycleStart + 4}`)
      .expect(200);

    expect(response.body).not.toHaveProperty('trendLine');
  });

  it('should handle includeMovingAverage=false explicitly', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${testUserId}&metric=income&startCycle=${testCycleStart}&endCycle=${testCycleStart + 4}&includeMovingAverage=false`)
      .expect(200);

    expect(response.body).not.toHaveProperty('movingAverage3');
    expect(response.body).not.toHaveProperty('movingAverage7');
  });

  it('should handle includeTrendLine=false explicitly', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends?userId=${testUserId}&metric=income&startCycle=${testCycleStart}&endCycle=${testCycleStart + 4}&includeTrendLine=false`)
      .expect(200);

    expect(response.body).not.toHaveProperty('trendLine');
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
          userId: testUserId,
          robot1Id: testRobotId,
          robot2Id: testRobotId + 1,
          winnerId: i % 2 === 0 ? testRobotId : testRobotId + 1, // Win every other battle
          battleType: 'league',
          leagueType: 'bronze',
          battleLog: {},
          robot1ELOBefore: 1000 + (i * 10),
          robot1ELOAfter: 1000 + (i * 10) + (i % 2 === 0 ? 10 : -5),
          robot2ELOBefore: 1000,
          robot2ELOAfter: 1000,
          eloChange: i % 2 === 0 ? 10 : -5,
          robot1DamageDealt: 50 + (i * 10),
          robot2DamageDealt: 30,
          robot1FinalHP: i % 2 === 0 ? 70 : 20,
          robot2FinalHP: i % 2 === 0 ? 20 : 70,
          robot1FinalShield: 0,
          robot2FinalShield: 0,
          winnerReward: 100,
          loserReward: 50,
          robot1PrestigeAwarded: i % 2 === 0 ? 10 : 5,
          robot2PrestigeAwarded: i % 2 === 0 ? 5 : 10,
          robot1FameAwarded: i % 2 === 0 ? 20 : 10,
          robot2FameAwarded: i % 2 === 0 ? 10 : 20,
          robot1RepairCost: 30,
          robot2RepairCost: 30,
          durationSeconds: 60,
          robot1Yielded: false,
          robot2Yielded: false,
          robot1Destroyed: false,
          robot2Destroyed: false,
        },
      });

      await eventLogger.logCycleComplete(cycleNumber, 1000);
      await cycleSnapshotService.createSnapshot(cycleNumber);
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

  it('should calculate correct earnings', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/performance?cycleRange=[${testCycleStart},${testCycleStart + 2}]`)
      .expect(200);

    // Credits: 2 wins (100 each) + 1 loss (50) = 250
    expect(response.body.totalCreditsEarned).toBe(250);
    
    // Fame: 2 wins (20 each) + 1 loss (10) = 50
    expect(response.body.totalFameEarned).toBe(50);
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
    expect(response.body.battlesParticipated).toBe(1);
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
            userId: testUserId,
            robot1Id: testRobotId,
            robot2Id: testRobotId + 1,
            winnerId: testRobotId,
            robot1ELOBefore: currentElo,
            robot1ELOAfter: newElo,
            robot2ELOBefore: 1000,
            robot2ELOAfter: 990,
            eloChange: eloChange,
            robot1DamageDealt: 50,
            robot2DamageDealt: 30,
            robot1FinalHP: 70,
            robot2FinalHP: 0,
            robot1FinalShield: 20,
            robot2FinalShield: 0,
            winnerReward: 100,
            loserReward: 50,
            robot1PrestigeAwarded: 10,
            robot2PrestigeAwarded: 5,
            robot1FameAwarded: 20,
            robot2FameAwarded: 10,
            robot1RepairCost: 30,
            robot2RepairCost: 100,
            durationSeconds: 60,
            battleType: 'league',
            leagueType: 'bronze',
            battleLog: {},
            createdAt: new Date(Date.now() + cycleNumber * 1000),
          },
        });

        currentElo = newElo;
      }

      await eventLogger.logCycleComplete(cycleNumber, 1000);
      await cycleSnapshotService.createSnapshot(cycleNumber);
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

    expect(response.body.dataPoints.length).toBeGreaterThan(0);
    
    const dataPoint = response.body.dataPoints[0];
    expect(dataPoint).toHaveProperty('cycleNumber');
    expect(dataPoint).toHaveProperty('elo');
    expect(dataPoint).toHaveProperty('change');
    expect(typeof dataPoint.cycleNumber).toBe('number');
    expect(typeof dataPoint.elo).toBe('number');
    expect(typeof dataPoint.change).toBe('number');
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

    expect(response.body).toHaveProperty('movingAverage');
    expect(Array.isArray(response.body.movingAverage)).toBe(true);
    expect(response.body.movingAverage.length).toBe(response.body.dataPoints.length);
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

    expect(response.body).toHaveProperty('trendLine');
    expect(response.body.trendLine).toHaveProperty('slope');
    expect(response.body.trendLine).toHaveProperty('intercept');
    expect(response.body.trendLine).toHaveProperty('points');
    expect(Array.isArray(response.body.trendLine.points)).toBe(true);
    expect(response.body.trendLine.points.length).toBe(response.body.dataPoints.length);
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

    expect(response.body).toHaveProperty('movingAverage');
    expect(response.body).toHaveProperty('trendLine');
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
      .get(`/api/analytics/robot/${testRobotId}/elo?cycleRange=[1,999999]`)
      .expect(200);

    // Should not crash and should return available data
    expect(response.body).toHaveProperty('dataPoints');
    expect(Array.isArray(response.body.dataPoints)).toBe(true);
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
        userId: testUserId,
        robot1Id: singleBattleRobotId,
        robot2Id: testRobotId,
        winnerId: singleBattleRobotId,
        robot1ELOBefore: 1000,
        robot1ELOAfter: 1020,
        robot2ELOBefore: 1000,
        robot2ELOAfter: 980,
        eloChange: 20,
        robot1DamageDealt: 50,
        robot2DamageDealt: 30,
        robot1FinalHP: 70,
        robot2FinalHP: 0,
        robot1FinalShield: 20,
        robot2FinalShield: 0,
        winnerReward: 100,
        loserReward: 50,
        robot1PrestigeAwarded: 10,
        robot2PrestigeAwarded: 5,
        robot1FameAwarded: 20,
        robot2FameAwarded: 10,
        robot1RepairCost: 30,
        robot2RepairCost: 100,
        durationSeconds: 60,
        battleType: 'league',
        leagueType: 'bronze',
        battleLog: {},
        createdAt: new Date(Date.now() + testCycleStart * 1000),
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
            userId: testUserId,
            robot1Id: testRobotId,
            robot2Id: testRobotId + 1, // Opponent robot
            winnerId: testRobotId,
            robot1ELOBefore: eloBefore,
            robot1ELOAfter: eloAfter,
            robot2ELOBefore: 1000,
            robot2ELOAfter: 990,
            eloChange: 10,
            robot1DamageDealt: 50 + i * 10,
            robot2DamageDealt: 30 + i * 5,
            robot1FinalHP: 70,
            robot2FinalHP: 0,
            robot1FinalShield: 20,
            robot2FinalShield: 0,
            winnerReward: 100,
            loserReward: 50,
            robot1PrestigeAwarded: 10,
            robot2PrestigeAwarded: 5,
            robot1FameAwarded: 20 + i * 5,
            robot2FameAwarded: 10,
            robot1RepairCost: 30,
            robot2RepairCost: 100,
            durationSeconds: 60,
            battleType: 'league',
            leagueType: 'bronze',
            battleLog: {},
            createdAt: new Date(Date.now() + cycleNumber * 1000),
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

    // Purchase income generator level 1
    await prisma.facility.create({
      data: {
        userId: testUserId,
        facilityType: 'income_generator',
        level: 1,
      },
    });

    // Log purchase event
    await eventLogger.logFacilityTransaction(
      1,
      testUserId,
      'income_generator',
      0,
      1,
      400000,
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
        { facilityType: 'income_generator', level: 1, cost: 7000 },
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
      .get(`/api/analytics/facility/${testUserId}/roi?facilityType=income_generator`)
      .expect(200);

    expect(response.body).toHaveProperty('facilityType', 'income_generator');
    expect(response.body).toHaveProperty('currentLevel', 1);
    expect(response.body).toHaveProperty('totalInvestment', 400000);
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
      .get(`/api/analytics/facility/999999/roi?facilityType=income_generator`)
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
      .get(`/api/analytics/facility/invalid/roi?facilityType=income_generator`)
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
