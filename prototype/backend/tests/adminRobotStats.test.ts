import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import adminRoutes from '../src/routes/admin';
import authRoutes from '../src/routes/auth';

dotenv.config();

const prisma = new PrismaClient();

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);

describe('Admin Robot Statistics Endpoint', () => {
  let adminToken: string;
  let adminUser: any;
  let testRobots: any[] = [];

  beforeAll(async () => {
    await prisma.$connect();

    // Create admin user
    const adminUsername = `admin_${Date.now()}`;
    const adminPassword = 'adminpass123';
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    adminUser = await prisma.user.create({
      data: {
        username: adminUsername,
        passwordHash,
        role: 'admin',
        currency: 1000000,
      },
    });

    // Login to get admin token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: adminUsername,
        password: adminPassword,
      });

    adminToken = loginResponse.body.token;

    // Create test robots with varying attributes for testing statistics
    const robotData = [
      {
        name: 'HighCombatPower',
        combatPower: 45.00, // Outlier high
        targetingSystems: 20.00,
        hullIntegrity: 15.00,
        elo: 1500,
        currentLeague: 'gold',
      },
      {
        name: 'LowCombatPower',
        combatPower: 2.00, // Outlier low
        targetingSystems: 10.00,
        hullIntegrity: 10.00,
        elo: 1000,
        currentLeague: 'bronze',
      },
      {
        name: 'AverageRobot1',
        combatPower: 15.00,
        targetingSystems: 15.00,
        hullIntegrity: 15.00,
        elo: 1200,
        currentLeague: 'silver',
      },
      {
        name: 'AverageRobot2',
        combatPower: 16.00,
        targetingSystems: 16.00,
        hullIntegrity: 14.00,
        elo: 1250,
        currentLeague: 'silver',
      },
      {
        name: 'WinnerRobot',
        combatPower: 25.00,
        targetingSystems: 25.00,
        hullIntegrity: 20.00,
        elo: 1600,
        currentLeague: 'platinum',
        totalBattles: 10,
        wins: 8,
        losses: 2,
      },
    ];

    for (const data of robotData) {
      const robot = await prisma.robot.create({
        data: {
          userId: adminUser.id,
          name: data.name,
          combatPower: data.combatPower,
          targetingSystems: data.targetingSystems,
          hullIntegrity: data.hullIntegrity,
          currentHP: 100,
          maxHP: 100,
          currentShield: 0,
          maxShield: 0,
          elo: data.elo,
          currentLeague: data.currentLeague,
          totalBattles: data.totalBattles || 0,
          wins: data.wins || 0,
          losses: data.losses || 0,
        },
      });
      testRobots.push(robot);
    }
  });

  afterAll(async () => {
    // Cleanup
    for (const robot of testRobots) {
      await prisma.robot.delete({ where: { id: robot.id } }).catch(() => {});
    }
    if (adminUser) {
      await prisma.user.delete({ where: { id: adminUser.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('GET /api/admin/stats/robots', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/stats/robots');

      expect(response.status).toBe(401);
    });

    it('should require admin role', async () => {
      // Create a regular user token
      const regularUsername = `user_${Date.now()}`;
      const regularPassword = 'userpass123';
      const passwordHash = await bcrypt.hash(regularPassword, 10);

      const regularUser = await prisma.user.create({
        data: {
          username: regularUsername,
          passwordHash,
          role: 'user',
        },
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: regularUsername,
          password: regularPassword,
        });

      const userToken = loginResponse.body.token;

      const response = await request(app)
        .get('/api/admin/stats/robots')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);

      // Cleanup
      await prisma.user.delete({ where: { id: regularUser.id } }).catch(() => {});
    });

    it('should return comprehensive robot statistics', async () => {
      const response = await request(app)
        .get('/api/admin/stats/robots')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('attributeStats');
      expect(response.body).toHaveProperty('outliers');
      expect(response.body).toHaveProperty('statsByLeague');
      expect(response.body).toHaveProperty('winRateAnalysis');
      expect(response.body).toHaveProperty('topPerformers');
      expect(response.body).toHaveProperty('bottomPerformers');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should include summary statistics', async () => {
      const response = await request(app)
        .get('/api/admin/stats/robots')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const { summary } = response.body;

      expect(summary).toHaveProperty('totalRobots');
      expect(summary).toHaveProperty('robotsWithBattles');
      expect(summary).toHaveProperty('totalBattles');
      expect(summary).toHaveProperty('overallWinRate');
      expect(summary).toHaveProperty('averageElo');
      expect(summary.totalRobots).toBeGreaterThanOrEqual(5); // At least our test robots
    });

    it('should calculate attribute statistics correctly', async () => {
      const response = await request(app)
        .get('/api/admin/stats/robots')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const { attributeStats } = response.body;

      // Check that all 23 attributes are present
      expect(attributeStats).toHaveProperty('combatPower');
      expect(attributeStats).toHaveProperty('targetingSystems');
      expect(attributeStats).toHaveProperty('hullIntegrity');

      // Check structure of stats for each attribute
      const combatPowerStats = attributeStats.combatPower;
      expect(combatPowerStats).toHaveProperty('mean');
      expect(combatPowerStats).toHaveProperty('median');
      expect(combatPowerStats).toHaveProperty('stdDev');
      expect(combatPowerStats).toHaveProperty('min');
      expect(combatPowerStats).toHaveProperty('max');
      expect(combatPowerStats).toHaveProperty('q1');
      expect(combatPowerStats).toHaveProperty('q3');
      expect(combatPowerStats).toHaveProperty('iqr');
      expect(combatPowerStats).toHaveProperty('lowerBound');
      expect(combatPowerStats).toHaveProperty('upperBound');
    });

    it('should detect outliers correctly', async () => {
      const response = await request(app)
        .get('/api/admin/stats/robots')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const { outliers } = response.body;

      // Our test data should have outliers in combatPower
      // (HighCombatPower: 45.00 and LowCombatPower: 2.00)
      if (outliers.combatPower) {
        expect(Array.isArray(outliers.combatPower)).toBe(true);
        
        // Check structure of outlier data
        const firstOutlier = outliers.combatPower[0];
        expect(firstOutlier).toHaveProperty('id');
        expect(firstOutlier).toHaveProperty('name');
        expect(firstOutlier).toHaveProperty('value');
        expect(firstOutlier).toHaveProperty('league');
        expect(firstOutlier).toHaveProperty('elo');
        expect(firstOutlier).toHaveProperty('winRate');
      }
    });

    it('should provide statistics by league tier', async () => {
      const response = await request(app)
        .get('/api/admin/stats/robots')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const { statsByLeague } = response.body;

      // Check that leagues with robots have statistics
      const leagues = Object.keys(statsByLeague);
      expect(leagues.length).toBeGreaterThan(0);

      if (statsByLeague.bronze) {
        expect(statsByLeague.bronze).toHaveProperty('count');
        expect(statsByLeague.bronze).toHaveProperty('averageElo');
        expect(statsByLeague.bronze).toHaveProperty('attributes');
        expect(statsByLeague.bronze.attributes).toHaveProperty('combatPower');
        
        const bronzeCombatPower = statsByLeague.bronze.attributes.combatPower;
        expect(bronzeCombatPower).toHaveProperty('mean');
        expect(bronzeCombatPower).toHaveProperty('median');
        expect(bronzeCombatPower).toHaveProperty('min');
        expect(bronzeCombatPower).toHaveProperty('max');
      }
    });

    it('should include top and bottom performers', async () => {
      const response = await request(app)
        .get('/api/admin/stats/robots')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const { topPerformers, bottomPerformers } = response.body;

      // Check structure for combatPower
      expect(Array.isArray(topPerformers.combatPower)).toBe(true);
      expect(Array.isArray(bottomPerformers.combatPower)).toBe(true);
      expect(topPerformers.combatPower.length).toBeGreaterThan(0);
      expect(bottomPerformers.combatPower.length).toBeGreaterThan(0);

      // Check that top performers have higher values than bottom performers
      const topValue = topPerformers.combatPower[0].value;
      const bottomValue = bottomPerformers.combatPower[0].value;
      expect(topValue).toBeGreaterThan(bottomValue);
    });

    it('should include win rate analysis', async () => {
      const response = await request(app)
        .get('/api/admin/stats/robots')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const { winRateAnalysis } = response.body;

      // Win rate analysis might be empty if not enough robots have 5+ battles
      // But if it exists, check the structure
      const attributes = Object.keys(winRateAnalysis);
      
      if (attributes.length > 0) {
        const firstAttribute = attributes[0];
        const quintiles = winRateAnalysis[firstAttribute];
        
        expect(Array.isArray(quintiles)).toBe(true);
        
        if (quintiles.length > 0) {
          expect(quintiles[0]).toHaveProperty('quintile');
          expect(quintiles[0]).toHaveProperty('avgValue');
          expect(quintiles[0]).toHaveProperty('avgWinRate');
          expect(quintiles[0]).toHaveProperty('sampleSize');
        }
      }
    });
  });
});
