/**
 * Admin Cycle Generation Integration Tests
 * Tests for POST /api/admin/cycles/bulk with generateUsersPerCycle flag
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import adminRoutes from '../../src/routes/admin';
import { createTestUser, deleteTestUser } from '../testHelpers';

dotenv.config();

const prisma = new PrismaClient();

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/admin', adminRoutes);

describe('Admin Cycle Generation Integration Tests', () => {
  let adminUser: any;
  let adminToken: string;

  beforeAll(async () => {
    await prisma.$connect();

    // Seed weapons required by archetypes
    await prisma.weapon.createMany({
      data: [
        { name: 'Power Sword', weaponType: 'melee', baseDamage: 10, cooldown: 3, cost: 100000, handsRequired: 'one', damageType: 'melee', loadoutType: 'single' },
        { name: 'Combat Shield', weaponType: 'shield', baseDamage: 0, cooldown: 0, cost: 100000, handsRequired: 'shield', damageType: 'none', loadoutType: 'weapon_shield' },
        { name: 'Plasma Cannon', weaponType: 'energy', baseDamage: 25, cooldown: 5, cost: 500000, handsRequired: 'two', damageType: 'energy', loadoutType: 'two_handed' },
        { name: 'Railgun', weaponType: 'ballistic', baseDamage: 30, cooldown: 6, cost: 600000, handsRequired: 'two', damageType: 'ballistic', loadoutType: 'two_handed' },
        { name: 'Heavy Hammer', weaponType: 'melee', baseDamage: 28, cooldown: 5, cost: 550000, handsRequired: 'two', damageType: 'melee', loadoutType: 'two_handed' },
        { name: 'Machine Gun', weaponType: 'ballistic', baseDamage: 7, cooldown: 2, cost: 150000, handsRequired: 'one', damageType: 'ballistic', loadoutType: 'single' },
        { name: 'Plasma Blade', weaponType: 'energy', baseDamage: 12, cooldown: 2, cost: 200000, handsRequired: 'one', damageType: 'energy', loadoutType: 'single' },
        { name: 'Plasma Rifle', weaponType: 'energy', baseDamage: 15, cooldown: 3, cost: 250000, handsRequired: 'one', damageType: 'energy', loadoutType: 'single' },
      ],
      skipDuplicates: true,
    });

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
      process.env.JWT_SECRET || 'test-secret'
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
    // Clean up auto-generated users and their data after each test
    const autoUsers = await prisma.user.findMany({
      where: { username: { startsWith: 'auto_user_' } },
      select: { id: true },
    });
    
    const userIds = autoUsers.map(u => u.id);
    
    if (userIds.length > 0) {
      const robots = await prisma.robot.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      });
      const robotIds = robots.map(r => r.id);
      
      if (robotIds.length > 0) {
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
        await prisma.scheduledMatch.deleteMany({
          where: {
            OR: [
              { robot1Id: { in: robotIds } },
              { robot2Id: { in: robotIds } },
            ],
          },
        });
      }
      
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

    // Cleanup weapons created in beforeAll
    await prisma.weapon.deleteMany({
      where: {
        name: {
          in: ['Power Sword', 'Combat Shield', 'Plasma Cannon', 'Railgun', 'Heavy Hammer', 'Machine Gun', 'Plasma Blade', 'Plasma Rifle'],
        },
      },
    });

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

      // Verify user generation in each cycle
      expect(response.body.results[0].userGeneration.usersCreated).toBe(1);
      expect(response.body.results[1].userGeneration.usersCreated).toBe(2);
      expect(response.body.results[2].userGeneration.usersCreated).toBe(3);

      // Verify total users created (1+2+3 = 6)
      const totalUsers = await prisma.user.count({
        where: { username: { startsWith: 'auto_user_' } },
      });
      expect(totalUsers).toBe(6);
    });

    it('should persist cycle count across multiple runs', async () => {
      // First run: 5 cycles
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

      // Verify cycle metadata
      const metadata1 = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
      expect(metadata1!.totalCycles).toBe(5);

      // Second run: 3 cycles (should start at cycle 6)
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

      // Verify user generation continues from cycle 6
      expect(response2.body.results[0].userGeneration.usersCreated).toBe(6);
      expect(response2.body.results[1].userGeneration.usersCreated).toBe(7);
      expect(response2.body.results[2].userGeneration.usersCreated).toBe(8);

      // Verify total users created (1+2+3+4+5+6+7+8 = 36)
      const totalUsers = await prisma.user.count({
        where: { username: { startsWith: 'auto_user_' } },
      });
      expect(totalUsers).toBe(36);

      // Verify cycle metadata
      const metadata2 = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
      expect(metadata2!.totalCycles).toBe(8);
    });

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

      // Verify no user generation in results
      response.body.results.forEach((result: any) => {
        expect(result.userGeneration).toBeNull();
      });

      // Verify no users were created
      const totalUsers = await prisma.user.count({
        where: { username: { startsWith: 'auto_user_' } },
      });
      expect(totalUsers).toBe(0);
    });

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

      // Verify no users were created
      const totalUsers = await prisma.user.count({
        where: { username: { startsWith: 'auto_user_' } },
      });
      expect(totalUsers).toBe(0);
    });

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
    });

    it('should handle errors in user generation gracefully', async () => {
      // Delete Practice Sword to cause error
      const practiceSword = await prisma.weapon.findFirst({
        where: { name: 'Practice Sword' },
      });

      if (practiceSword) {
        // Delete weapon inventory entries
        await prisma.weaponInventory.deleteMany({
          where: { weaponId: practiceSword.id },
        });

        // Update robots to remove references
        await prisma.robot.updateMany({
          where: { mainWeaponId: { not: null } },
          data: { mainWeaponId: null },
        });

        await prisma.weapon.delete({
          where: { id: practiceSword.id },
        });

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

        // Cycle should still complete despite user generation error
        expect(response.status).toBe(200);
        expect(response.body.results[0].userGeneration).toHaveProperty('error');
        expect(response.body.results[0].userGeneration.error).toContain('Practice Sword');

        // Restore Practice Sword
        await prisma.weapon.create({
          data: {
            name: 'Practice Sword',
            weaponType: 'melee',
            baseDamage: 10,
            cooldown: 3,
            cost: 0,
            handsRequired: 'one',
            damageType: 'melee',
            loadoutType: 'any',
            description: 'A basic training weapon',
          },
        });
      }
    });

    it('should return correct response structure', async () => {
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

      // Verify result structure
      response.body.results.forEach((result: any) => {
        expect(result).toHaveProperty('cycle');
        expect(result).toHaveProperty('userGeneration');
        expect(result.userGeneration).toHaveProperty('usersCreated');
        expect(result.userGeneration).toHaveProperty('robotsCreated');
        expect(result.userGeneration).toHaveProperty('usernames');
      });
    });

    it('should require admin authentication', async () => {
      // Create regular user token
      const regularUser = await createTestUser();
      const regularToken = jwt.sign(
        { userId: regularUser.id, username: regularUser.username, role: 'user' },
        process.env.JWT_SECRET || 'test-secret'
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
    });

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

      // Verify CycleMetadata was created
      const metadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
      expect(metadata).not.toBeNull();
      expect(metadata!.totalCycles).toBe(1);
    });

    it('should generate correct total user count formula (N*(N+1)/2)', async () => {
      const cycles = 10;
      const expectedTotal = (cycles * (cycles + 1)) / 2; // 55 users

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
        where: { username: { startsWith: 'auto_user_' } },
      });

      expect(totalUsers).toBe(expectedTotal);
    });

    it('should create users eligible for matchmaking', async () => {
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
        where: { user: { username: { startsWith: 'auto_user_' } } },
      });

      // Verify all robots meet battle readiness criteria
      robots.forEach((robot) => {
        const hpPercentage = (robot.currentHP / robot.maxHP) * 100;
        expect(hpPercentage).toBeGreaterThanOrEqual(75);
        expect(hpPercentage).toBeGreaterThanOrEqual(robot.yieldThreshold);
        expect(robot.mainWeaponId).not.toBeNull();
      });
    });
  });
});
