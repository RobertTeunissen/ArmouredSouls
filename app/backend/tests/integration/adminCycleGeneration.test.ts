/**
 * Admin Cycle Generation Integration Tests
 * Tests for POST /api/admin/cycles/bulk with generateUsersPerCycle flag
 *
 * Updated for the tiered stable system (WimpBot/AverageBot/ExpertBot).
 * Cycle N creates N stables distributed across the three tiers.
 */

import request from 'supertest';
import prisma from '../../src/lib/prisma';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import adminRoutes from '../../src/routes/admin';
import { createTestUser, deleteTestUser } from '../testHelpers';

dotenv.config();

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/admin', adminRoutes);

describe('Admin Cycle Generation Integration Tests', () => {
  let adminUser: { id: number; username: string };
  let adminToken: string;

  beforeAll(async () => {
    await prisma.$connect();

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

    // Ensure CycleMetadata exists
    const existing = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    if (!existing) {
      await prisma.cycleMetadata.create({
        data: { id: 1, totalCycles: 0 },
      });
    }
  });

  afterEach(async () => {
    // Clean up all auto-generated users (auto_wimpbot_*, auto_averagebot_*, auto_expertbot_*)
    const autoUsers = await prisma.user.findMany({
      where: { username: { startsWith: 'auto_' } },
      select: { id: true },
    });

    const userIds = autoUsers.map((u) => u.id);

    if (userIds.length > 0) {
      const robots = await prisma.robot.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      });
      const robotIds = robots.map((r) => r.id);

      if (robotIds.length > 0) {
        // Clean up tag teams associated with these robots
        const tagTeams = await prisma.tagTeam.findMany({
          where: {
            OR: [
              { activeRobotId: { in: robotIds } },
              { reserveRobotId: { in: robotIds } },
            ],
          },
          select: { id: true },
        });
        const tagTeamIds = tagTeams.map((t) => t.id);

        if (tagTeamIds.length > 0) {
          await prisma.scheduledTagTeamMatch.deleteMany({
            where: {
              OR: [
                { team1Id: { in: tagTeamIds } },
                { team2Id: { in: tagTeamIds } },
              ],
            },
          });
          await prisma.tagTeam.deleteMany({
            where: { id: { in: tagTeamIds } },
          });
        }

        // Clean up KotH match participants referencing these robots
        await prisma.scheduledKothMatchParticipant.deleteMany({
          where: { robotId: { in: robotIds } },
        });

        // Clean up tournament matches referencing these robots
        await prisma.scheduledTournamentMatch.updateMany({
          where: {
            OR: [
              { robot1Id: { in: robotIds } },
              { robot2Id: { in: robotIds } },
            ],
          },
          data: { robot1Id: null, robot2Id: null },
        });

        // Clean up audit logs referencing these robots
        await prisma.auditLog.deleteMany({
          where: { robotId: { in: robotIds } },
        });

        await prisma.battleParticipant.deleteMany({
          where: { robotId: { in: robotIds } },
        });
        await prisma.battle.deleteMany({
          where: {
            OR: [
              { robot1Id: { in: robotIds } },
              { robot2Id: { in: robotIds } },
            ],
          },
        });
        await prisma.scheduledLeagueMatch.deleteMany({
          where: {
            OR: [
              { robot1Id: { in: robotIds } },
              { robot2Id: { in: robotIds } },
            ],
          },
        });
      }

      // Clean up audit logs referencing these users
      await prisma.auditLog.deleteMany({
        where: { userId: { in: userIds } },
      });

      await prisma.weaponInventory.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.robot.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }

    // Reset cycle counter after each test
    await prisma.cycleMetadata.update({
      where: { id: 1 },
      data: { totalCycles: 0 },
    });
  });

  afterAll(async () => {
    // Cleanup admin user
    if (adminUser) {
      await deleteTestUser(adminUser.id);
    }

    await prisma.$disconnect();
  });

  describe('POST /api/admin/cycles/bulk with generateUsersPerCycle', () => {
    it('should generate progressive users per cycle', async () => {
      const response = await request(app)
        .post('/api/admin/cycles/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycles: 3,
          autoRepair: false,
          includeDailyFinances: false,
          includeTournaments: false,
          generateUsersPerCycle: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.cyclesCompleted).toBe(3);
      expect(response.body.generateUsersPerCycleEnabled).toBe(true);

      // Cycle 1 creates 1 user, Cycle 2 creates 2, Cycle 3 creates 3
      expect(response.body.results[0].userGeneration.usersCreated).toBe(1);
      expect(response.body.results[1].userGeneration.usersCreated).toBe(2);
      expect(response.body.results[2].userGeneration.usersCreated).toBe(3);

      // Total: 1+2+3 = 6 users with auto_ prefix
      const totalUsers = await prisma.user.count({
        where: { username: { startsWith: 'auto_' } },
      });
      expect(totalUsers).toBe(6);
    }, 120000);

    it('should persist cycle count across multiple runs', async () => {
      // First run: 5 cycles → 1+2+3+4+5 = 15 users
      const response1 = await request(app)
        .post('/api/admin/cycles/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycles: 5,
          autoRepair: false,
          includeDailyFinances: false,
          includeTournaments: false,
          generateUsersPerCycle: true,
        });

      expect(response1.status).toBe(200);
      expect(response1.body.totalCyclesInSystem).toBe(5);

      const metadata1 = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
      expect(metadata1!.totalCycles).toBe(5);

      // Second run: 3 cycles (cycles 6, 7, 8) → 6+7+8 = 21 more users
      const response2 = await request(app)
        .post('/api/admin/cycles/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycles: 3,
          autoRepair: false,
          includeDailyFinances: false,
          includeTournaments: false,
          generateUsersPerCycle: true,
        });

      expect(response2.status).toBe(200);
      expect(response2.body.totalCyclesInSystem).toBe(8);

      // Cycles 6, 7, 8 create 6, 7, 8 users respectively
      expect(response2.body.results[0].userGeneration.usersCreated).toBe(6);
      expect(response2.body.results[1].userGeneration.usersCreated).toBe(7);
      expect(response2.body.results[2].userGeneration.usersCreated).toBe(8);

      // Total: 15 + 21 = 36 users
      const totalUsers = await prisma.user.count({
        where: { username: { startsWith: 'auto_' } },
      });
      expect(totalUsers).toBe(36);

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
          generateUsersPerCycle: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.generateUsersPerCycleEnabled).toBe(false);

      // No user generation in results
      response.body.results.forEach((result: Record<string, unknown>) => {
        expect(result.userGeneration).toBeNull();
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
        expect(result).toHaveProperty('userGeneration');

        const ug = result.userGeneration as Record<string, unknown>;
        expect(ug).toHaveProperty('usersCreated');
        expect(ug).toHaveProperty('robotsCreated');
        expect(ug).toHaveProperty('tagTeamsCreated');
        expect(ug).toHaveProperty('usernames');
        expect(ug).toHaveProperty('tierBreakdown');

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
      // Delete CycleMetadata
      await prisma.cycleMetadata.deleteMany({});

      const response = await request(app)
        .post('/api/admin/cycles/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycles: 1,
          autoRepair: false,
          includeDailyFinances: false,
          includeTournaments: false,
          generateUsersPerCycle: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.results[0].userGeneration.usersCreated).toBe(1);

      const metadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
      expect(metadata).not.toBeNull();
      expect(metadata!.totalCycles).toBe(1);
    }, 60000);

    it('should generate correct total user count formula (N*(N+1)/2)', async () => {
      // Use 5 cycles to keep test runtime reasonable: sum(1..5) = 15 users
      const cycles = 5;
      const expectedTotal = (cycles * (cycles + 1)) / 2; // 15 users

      await request(app)
        .post('/api/admin/cycles/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycles,
          autoRepair: false,
          includeDailyFinances: false,
          includeTournaments: false,
          generateUsersPerCycle: true,
        });

      const totalUsers = await prisma.user.count({
        where: { username: { startsWith: 'auto_' } },
      });

      expect(totalUsers).toBe(expectedTotal);
    }, 180000);

    it('should create robots eligible for matchmaking', async () => {
      await request(app)
        .post('/api/admin/cycles/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycles: 3,
          autoRepair: false,
          includeDailyFinances: false,
          includeTournaments: false,
          generateUsersPerCycle: true,
        });

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
