/**
 * Admin Cycle Generation Integration Tests
 * Tests for POST /api/admin/cycles/bulk with generateUsersPerCycle flag
 *
 * The flag tops up the generated stables to GENERATED_STABLE_TARGET (this suite
 * uses 4): the first cycle creates them, later cycles create only what is missing.
 */

import request from 'supertest';
import prisma from '../../src/lib/prisma';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import adminRoutes from '../../src/routes/admin';
import { createTestUser, deleteTestUser } from '../testHelpers';
import {
  prepareFinancialCaptureTestEnvironment,
  useFinancialCaptureTestEnvironment,
} from '../financialCaptureTestHelper';

useFinancialCaptureTestEnvironment();

dotenv.config();

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/admin', adminRoutes);

/**
 * Highest cycle number this suite can reach.
 *
 * Every test here resets `cycleMetadata.totalCycles` to 0 and then runs at most 8 cycles, so
 * nothing above this is ever touched. The cleanup queries are bounded by it rather than
 * deleting `audit_logs` wholesale: an unbounded `deleteMany({})` took the suite from 32s
 * standing alone to 251s inside a full Heavy_Tier run, because by then the table holds every
 * other suite's rows too.
 */
const MAX_CYCLE_TOUCHED = 50;

/** Small target keeps every bulk run fast; restored after the suite. */
const SUITE_TARGET = 4;
const ORIGINAL_TARGET = process.env.GENERATED_STABLE_TARGET;

describe('Admin Cycle Generation Integration Tests', () => {
  let adminUser: { id: number; username: string };
  let adminToken: string;

  beforeAll(async () => {
    process.env.GENERATED_STABLE_TARGET = String(SUITE_TARGET);
    await prisma.$connect();
    // Bulk-cycle execution consumes every unified queued match, so this suite
    // owns a clean schedule rather than inheriting another heavy test's work.
    await prisma.scheduledMatch.deleteMany({});
    await clearGeneratedFixtures();

    // Create admin user
    adminUser = await prisma.user.create({
      data: {
        username: `admin_test_${Date.now()}`,
        passwordHash: '$2b$10$dummyhashfortesting',
        role: 'admin',
        currency: 1000000,
      },
    });

    // Generate admin JWT token
    adminToken = jwt.sign(
      { userId: adminUser.id, username: adminUser.username, role: 'admin' },
      process.env.JWT_SECRET || 'test-secret',
    );

    // This suite drives cycles from number 1 upward, and `cycle_snapshots.cycle_number` is
    // globally unique. `afterEach` clears the cycles this suite creates, but an earlier suite
    // in the same Heavy_Tier run leaves its own snapshots AND an advanced
    // `cycleMetadata.totalCycles` behind — so the first test here started at cycle 51 and
    // generated 51 users where it expected 1, and collided with leftover snapshots. Clearing
    // and resetting on entry as well as on exit makes the suite's result independent of what
    // ran before it.
    await prisma.cycleSnapshot.deleteMany({ where: { cycleNumber: { lte: MAX_CYCLE_TOUCHED } } });
    await prisma.financialLedger.deleteMany({ where: { cycleNumber: { lte: MAX_CYCLE_TOUCHED } } });
    await prisma.auditLog.deleteMany({ where: { cycleNumber: { lte: MAX_CYCLE_TOUCHED } } });
    // Ensure CycleMetadata exists
    const existing = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    if (!existing) {
      await prisma.cycleMetadata.create({
        data: { id: 1, totalCycles: 0 },
      });
    } else {
      // Reset, not just ensure-exists. `cycleMetadata` is a singleton row shared by every
      // suite, and the cycle number it holds decides how many users a cycle generates.
      await prisma.cycleMetadata.update({
        where: { id: 1 },
        data: { totalCycles: 0, lastCycleAt: null },
      });
    }
  });

  afterEach(async () => {
    await clearGeneratedFixtures();
    await prisma.scheduledMatch.deleteMany({});

    // Resetting the counter means the next test re-runs cycles 1..N, so every
    // low-cycle record that owns an idempotency or uniqueness boundary must go
    // with it. Production never replays a cycle number.
    await prisma.cycleSnapshot.deleteMany({ where: { cycleNumber: { lte: MAX_CYCLE_TOUCHED } } });
    await prisma.financialLedger.deleteMany({ where: { cycleNumber: { lte: MAX_CYCLE_TOUCHED } } });
    await prisma.auditLog.deleteMany({ where: { cycleNumber: { lte: MAX_CYCLE_TOUCHED } } });
    await prisma.cycleMetadata.update({
      where: { id: 1 },
      data: { totalCycles: 0 },
    });
  });

  afterAll(async () => {
    if (ORIGINAL_TARGET === undefined) delete process.env.GENERATED_STABLE_TARGET;
    else process.env.GENERATED_STABLE_TARGET = ORIGINAL_TARGET;
    // Cleanup admin user
    if (adminUser) {
      await deleteTestUser(adminUser.id);
    }

    await prisma.$disconnect();
  });

  describe('POST /api/admin/cycles/bulk with generateUsersPerCycle', () => {
    it('tops up to the target on the first cycle, then creates nothing', async () => {
      const response = await request(app)
        .post('/api/admin/cycles/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycles: 3,
          autoRepair: false,
          includeDailyFinances: false,
          includeTournaments: false,
          includeKoth: false,
          generateUsersPerCycle: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.cyclesCompleted).toBe(3);
      expect(response.body.results).toHaveLength(3);
      response.body.results.forEach((result: Record<string, unknown>) => {
        expect(result.error).toBeUndefined();
        expect(result.settlement).toBeDefined();
      });
      expect(response.body.results.map((r: { settlement: { userGeneration: { usersCreated: number } } }) =>
        r.settlement.userGeneration.usersCreated)).toEqual([SUITE_TARGET, 0, 0]);
      expect(response.body.results[1].settlement.userGeneration).toMatchObject({ target: SUITE_TARGET, existingBefore: SUITE_TARGET });

      const totalUsers = await prisma.user.count({
        where: { username: { startsWith: 'auto_' } },
      });
      expect(totalUsers).toBe(SUITE_TARGET);
    }, 120000);

    it('should persist cycle count across multiple runs', async () => {
      // First run: 5 cycles; the first creates the whole target
      const response1 = await request(app)
        .post('/api/admin/cycles/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycles: 5,
          autoRepair: false,
          includeDailyFinances: false,
          includeTournaments: false,
          includeKoth: false,
          generateUsersPerCycle: true,
        });

      expect(response1.status).toBe(200);
      expect(response1.body.totalCyclesInSystem).toBe(5);

      const metadata1 = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
      expect(metadata1!.totalCycles).toBe(5);

      // Second run: 3 cycles (cycles 6, 7, 8); the target is already met
      const response2 = await request(app)
        .post('/api/admin/cycles/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycles: 3,
          autoRepair: false,
          includeDailyFinances: false,
          includeTournaments: false,
          includeKoth: false,
          generateUsersPerCycle: true,
        });

      expect(response2.status).toBe(200);
      expect(response2.body.totalCyclesInSystem).toBe(8);

      expect(response2.body.results).toHaveLength(3);
      response2.body.results.forEach((result: Record<string, unknown>) => {
        expect(result.error).toBeUndefined();
        expect(result.settlement).toBeDefined();
      });
      response2.body.results.forEach((result: { settlement: { userGeneration: { usersCreated: number } } }) => {
        expect(result.settlement.userGeneration.usersCreated).toBe(0);
      });

      const totalUsers = await prisma.user.count({
        where: { username: { startsWith: 'auto_' } },
      });
      expect(totalUsers).toBe(SUITE_TARGET);

      const metadata2 = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
      expect(metadata2!.totalCycles).toBe(8);
    }, 180000);

    it('should not generate users when flag is false', async () => {
      const response = await request(app)
        .post('/api/admin/cycles/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycles: 3,
          autoRepair: false,
          includeDailyFinances: false,
          includeTournaments: false,
          includeKoth: false,
          generateUsersPerCycle: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.generateUsersPerCycleEnabled).toBe(false);

      // No user generation in results. `generateUsersPerCycle: false` leaves
      // `userGenerationSummary` at its `null` initialiser, so the key is present and null.
      response.body.results.forEach((result: Record<string, unknown>) => {
        const settlement = result.settlement as Record<string, unknown>;
        expect(settlement).toBeDefined();
        expect(settlement.userGeneration).toBeNull();
      });

      const totalUsers = await prisma.user.count({
        where: { username: { startsWith: 'auto_' } },
      });
      expect(totalUsers).toBe(0);
    }, 60000);

    it('should not generate users when flag is omitted (default false)', async () => {
      const response = await request(app)
        .post('/api/admin/cycles/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycles: 2,
          autoRepair: false,
          includeDailyFinances: false,
          includeTournaments: false,
          includeKoth: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.generateUsersPerCycleEnabled).toBe(false);

      const totalUsers = await prisma.user.count({
        where: { username: { startsWith: 'auto_' } },
      });
      expect(totalUsers).toBe(0);
    }, 60000);

    it('should update lastCycleAt timestamp', async () => {
      const beforeTime = new Date();

      await request(app)
        .post('/api/admin/cycles/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycles: 2,
          autoRepair: false,
          includeDailyFinances: false,
          includeTournaments: false,
          includeKoth: false,
          generateUsersPerCycle: true,
        });

      const metadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
      expect(metadata!.lastCycleAt).not.toBeNull();
      expect(metadata!.lastCycleAt!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    }, 60000);

    it('should return correct response structure with tierBreakdown', async () => {
      const response = await request(app)
        .post('/api/admin/cycles/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycles: 2,
          autoRepair: false,
          includeDailyFinances: false,
          includeTournaments: false,
          includeKoth: false,
          generateUsersPerCycle: true,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('cyclesCompleted');
      expect(response.body).toHaveProperty('totalCyclesInSystem');
      expect(response.body).toHaveProperty('generateUsersPerCycleEnabled');
      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('totalDuration');
      expect(response.body).toHaveProperty('averageCycleDuration');

      // Verify result structure includes tiered generation fields
      response.body.results.forEach((result: Record<string, unknown>) => {
        expect(result).toHaveProperty('cycle');
        expect(result).toHaveProperty('settlement.userGeneration');

        const settlement = result.settlement as Record<string, unknown>;
        const ug = settlement.userGeneration as Record<string, unknown>;
        expect(ug).toHaveProperty('usersCreated');
        expect(ug).toHaveProperty('robotsCreated');
        expect(ug).toHaveProperty('tagTeamsCreated');
        expect(ug).toHaveProperty('usernames');
        expect(ug).toHaveProperty('tierBreakdown');

        expect(ug).toHaveProperty('target', SUITE_TARGET);
        expect(ug).toHaveProperty('existingBefore');
        const tb = ug.tierBreakdown as Record<string, number>;
        expect(tb).toHaveProperty('wimpBot');
        expect(tb).toHaveProperty('averageBot');
        expect(tb).toHaveProperty('expertBot');
      });
    }, 60000);

    it('should require admin authentication', async () => {
      const regularUser = await createTestUser();
      const regularToken = jwt.sign(
        { userId: regularUser.id, username: regularUser.username, role: 'user' },
        process.env.JWT_SECRET || 'test-secret',
      );

      const response = await request(app)
        .post('/api/admin/cycles/bulk')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          cycles: 1,
          generateUsersPerCycle: true,
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');

      await deleteTestUser(regularUser.id);
    }, 30000);

    it('should auto-create CycleMetadata if missing', async () => {
      // The singleton can be recreated without any additional fixture because
      // paired financial capture is always enabled by the shared writer.
      await prisma.cycleMetadata.deleteMany({});
      await prepareFinancialCaptureTestEnvironment();

      const response = await request(app)
        .post('/api/admin/cycles/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycles: 1,
          autoRepair: false,
          includeDailyFinances: false,
          includeTournaments: false,
          includeKoth: false,
          generateUsersPerCycle: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.results[0].settlement.userGeneration.usersCreated).toBe(SUITE_TARGET);

      const metadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
      expect(metadata).not.toBeNull();
      expect(metadata!.totalCycles).toBe(1);
    }, 60000);

    it('creates the difference when the target is raised between runs', async () => {
      const body = { autoRepair: false, includeDailyFinances: false, includeTournaments: false, includeKoth: false, generateUsersPerCycle: true };
      const first = await request(app).post('/api/admin/cycles/bulk').set('Authorization', `Bearer ${adminToken}`).send({ cycles: 1, ...body });
      expect(first.body.results[0].settlement.userGeneration.usersCreated).toBe(SUITE_TARGET);

      process.env.GENERATED_STABLE_TARGET = String(SUITE_TARGET + 2);
      try {
        const second = await request(app).post('/api/admin/cycles/bulk').set('Authorization', `Bearer ${adminToken}`).send({ cycles: 1, ...body });
        expect(second.body.results[0].settlement.userGeneration).toMatchObject({
          target: SUITE_TARGET + 2, existingBefore: SUITE_TARGET, usersCreated: 2,
        });
      } finally {
        process.env.GENERATED_STABLE_TARGET = String(SUITE_TARGET);
      }
      expect(await prisma.user.count({ where: { username: { startsWith: 'auto_' } } })).toBe(SUITE_TARGET + 2);
    }, 180000);

    it('should create robots eligible for matchmaking', async () => {
      // Run one cycle so these robots are inspected immediately after generation.
      // In later cycles they may legitimately have fought scheduled matches and taken damage.
      const response = await request(app)
        .post('/api/admin/cycles/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycles: 1,
          autoRepair: false,
          includeDailyFinances: false,
          includeTournaments: false,
          includeKoth: false,
          generateUsersPerCycle: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].error).toBeUndefined();
      expect(response.body.results[0].settlement.userGeneration.usersCreated).toBe(SUITE_TARGET);

      const robots = await prisma.robot.findMany({
        where: { user: { username: { startsWith: 'auto_' } } },
      });

      expect(robots.length).toBeGreaterThan(0);

      // Verify all robots meet battle readiness criteria
      robots.forEach((robot) => {
        const hpPercentage = (robot.currentHP / robot.maxHP) * 100;
        expect(hpPercentage).toBeGreaterThanOrEqual(75);
        expect(hpPercentage).toBeGreaterThanOrEqual(robot.yieldThreshold);
        expect(robot.mainWeaponId).not.toBeNull();
      });
    }, 120000);
  });
});

/** Remove generated stables and every fixture-owned dependency before replaying cycles 1..N. */
async function clearGeneratedFixtures(): Promise<void> {
  const autoUsers = await prisma.user.findMany({
    where: { username: { startsWith: 'auto_' } },
    select: { id: true },
  });
  const userIds = autoUsers.map((user) => user.id);

  if (userIds.length === 0) {
    return;
  }

  const [robots, teams] = await Promise.all([
    prisma.robot.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    }),
    prisma.teamBattle.findMany({
      where: { stableId: { in: userIds } },
      select: { id: true },
    }),
  ]);
  const robotIds = robots.map((robot) => robot.id);
  const teamIds = teams.map((team) => team.id);
  const participantClauses = [
    ...(robotIds.length > 0 ? [{ participantId: { in: robotIds } }] : []),
    ...(teamIds.length > 0 ? [{ participantId: { in: teamIds } }] : []),
  ];

  const [battles, scheduledMatches] = await Promise.all([
    robotIds.length > 0
      ? prisma.battle.findMany({
        where: { participants: { some: { robotId: { in: robotIds } } } },
        select: { id: true },
      })
      : [],
    participantClauses.length > 0
      ? prisma.scheduledMatch.findMany({
        where: { participants: { some: { OR: participantClauses } } },
        select: { id: true },
      })
      : [],
  ]);

  await prisma.financialLedger.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        ...(robotIds.length > 0 ? [{ robotId: { in: robotIds } }] : []),
      ],
    },
  });
  await prisma.leagueHistory.deleteMany({ where: { userId: { in: userIds } } });

  if (scheduledMatches.length > 0) {
    await prisma.scheduledMatch.deleteMany({ where: { id: { in: scheduledMatches.map((match) => match.id) } } });
  }
  if (battles.length > 0) {
    await prisma.battle.deleteMany({ where: { id: { in: battles.map((battle) => battle.id) } } });
  }

  await prisma.standing.deleteMany({
    where: {
      OR: [
        ...(robotIds.length > 0 ? [{ entityType: 'robot', entityId: { in: robotIds } }] : []),
        ...(teamIds.length > 0 ? [{ entityType: 'team', entityId: { in: teamIds } }] : []),
      ],
    },
  });
  if (teamIds.length > 0) {
    await prisma.teamBattle.deleteMany({ where: { id: { in: teamIds } } });
  }
  if (robotIds.length > 0) {
    await prisma.subscription.deleteMany({ where: { robotId: { in: robotIds } } });
  }
  await prisma.weaponInventory.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.robot.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
