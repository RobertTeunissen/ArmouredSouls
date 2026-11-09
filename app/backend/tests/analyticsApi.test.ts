/**
 * Unit tests for Analytics API
 * 
 * Tests the remaining /api/analytics endpoints (metric progression, current cycle, facility recommendations)
 * 
 * Requirements: 12.1
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import analyticsRoutes from '../src/routes/analytics';
import { errorHandler } from '../src/middleware/errorHandler';
import { getConfig } from '../src/config/env';
import { eventLogger } from '../src/services/common/eventLogger';
import prisma from '../src/lib/prisma';
import { battlesForRobots } from './cleanupHelper';
import { battleLogFixture } from './helpers/battleLogFixture';

/**
 * Every analytics route now sits behind `authenticateToken`, and the
 * per-user routes additionally require the caller to be the owner or an
 * admin. Rather than threading a header through ~180 call sites, the test app
 * injects a real signed JWT for an admin user on every request, so the
 * genuine auth middleware still runs and resolves the role from the database.
 *
 * The 401/403 paths are covered by tests/middleware/auth.test.ts and
 * tests/matches.test.ts; this suite asserts authorised behaviour.
 */
const ADMIN_USER_ID = 900001;
const ADMIN_USERNAME = 'analytics_api_admin';
let authToken = '';

// Create test app
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.headers.authorization = `Bearer ${authToken}`;
  next();
});
app.use('/api/analytics', analyticsRoutes);
app.use(errorHandler);

beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: ADMIN_USER_ID },
    update: { role: 'admin', tokenVersion: 0 },
    create: {
      id: ADMIN_USER_ID,
      username: ADMIN_USERNAME,
      passwordHash: 'test',
      role: 'admin',
    },
  });

  authToken = jwt.sign(
    { userId: ADMIN_USER_ID, username: ADMIN_USERNAME, role: 'admin', tokenVersion: 0 },
    getConfig().jwtSecret,
    { algorithm: 'HS256' }
  );
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: ADMIN_USER_ID } });
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
    await prisma.battle.deleteMany({ where: battlesForRobots([testRobotId]) });
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
            winnerId: testRobotId,
            winnerReward: 100,
            loserReward: 50,
            durationSeconds: 60,
            battleType: 'league',
            leagueType: 'bronze',
            ...battleLogFixture({}),
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
    await prisma.battle.deleteMany({ where: battlesForRobots([testRobotId]) });
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

    expect(response.body).toHaveProperty('code', 'INVALID_METRIC');
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

    expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  it('should return 400 when cycleRange is missing', async () => {
    const response = await request(app)
      .get(`/api/analytics/robot/${testRobotId}/metric/elo`)
      .expect(400);

    expect(response.body).toHaveProperty('code', 'MISSING_PARAMETER');
  });

  it('should return 404 for non-existent robot', async () => {
    const nonExistentRobotId = 999999;
    
    const response = await request(app)
      .get(`/api/analytics/robot/${nonExistentRobotId}/metric/elo?cycleRange=[${testCycleStart},${testCycleStart + 4}]`)
      .expect(404);

    expect(response.body).toHaveProperty('code', 'ROBOT_NOT_FOUND');
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
    // No `prisma.$disconnect()` here.
    //
    // This file has nine `describe` blocks sharing the module-level Prisma singleton, and
    // three of them used to disconnect it in their own `afterAll` — so the client was torn
    // down while later describes still had tests to run. Under the Prisma 7 driver adapter a
    // disconnect ends the underlying pg Pool, which makes any later query's behaviour depend
    // on reconnection timing. That is the most likely source of this suite's intermittent
    // 404 from `requireRobotExists` on a robot it had just created.
    //
    // `tests/setup.ts` owns the lifecycle: it disconnects once per worker in a global
    // `afterAll`. A test file should not disconnect a client it did not create.
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
      .get(`/api/analytics/facility/${testUserId}/recommendations`)
      .expect(200);

    expect(response.body).toHaveProperty('recommendations');
    expect(Array.isArray(response.body.recommendations)).toBe(true);
    expect(response.body).toHaveProperty('totalRecommendedInvestment');
    expect(response.body).toHaveProperty('userCurrency', 2000000);
    expect(response.body).toHaveProperty('userPrestige', 10000);
    expect(response.body).toHaveProperty('analysisWindow');
    // Recommendations analyse lifetime data: cycle 1 through the current cycle.
    expect(response.body.analysisWindow).toHaveProperty('startCycle', 1);
    expect(response.body.analysisWindow).toHaveProperty('cycleCount', 20);

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

  it('should ignore a lastNCycles query parameter and analyse lifetime data', async () => {
    const response = await request(app)
      .get(`/api/analytics/facility/${testUserId}/recommendations?lastNCycles=3`)
      .expect(200);

    expect(response.body).toHaveProperty('analysisWindow');
    expect(response.body.analysisWindow).toHaveProperty('startCycle', 1);
    expect(response.body.analysisWindow).toHaveProperty('cycleCount', 20);
  });

  it('should return 400 for invalid userId', async () => {
    const response = await request(app)
      .get(`/api/analytics/facility/invalid/recommendations`)
      .expect(400);

    expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  // Removed: 'should return 400 for invalid lastNCycles parameter'.
  // The recommendations endpoint no longer accepts a lastNCycles window —
  // facilityRecommendationService analyses lifetime data (cycle 1 → current),
  // so there is no parameter left to reject. Ignoring behaviour is asserted above.

  it('should return 404 for non-existent user', async () => {
    const response = await request(app)
      .get(`/api/analytics/facility/999999/recommendations`)
      .expect(404);

    expect(response.body).toHaveProperty('code', 'USER_NOT_FOUND');
  });
});
