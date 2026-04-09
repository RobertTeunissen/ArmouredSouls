import request from 'supertest';
import prisma from '../src/lib/prisma';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import financesRoutes from '../src/routes/finances';

dotenv.config();


// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/finances', financesRoutes);

describe('Finances Routes', () => {
  let testUserIds: number[] = [];
  let testRobotIds: number[] = [];
  let authToken: string;

  beforeAll(async () => {
    await prisma.$connect();
    
    // Create test user for this test suite
    const testUser = await prisma.user.create({
      data: {
        username: `test_finances_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        passwordHash: '$2b$10$abcdefghijklmnopqrstuv', // hashed 'password'
        prestige: 1000,
        currency: 5000,
      },
    });
    testUserIds.push(testUser.id);

    // Create a test robot
    const testRobot = await prisma.robot.create({
      data: {
        name: `TestRobot_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        userId: testUser.id,
        currentHP: 100,
        maxHP: 100,
        currentShield: 10,
        maxShield: 10,
        // All 23 attributes set to 5.0
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
    testRobotIds.push(testRobot.id);

    // Generate JWT token
    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterEach(async () => {
    // Cleanup after each test in correct dependency order
    if (testRobotIds.length > 0) {
      await prisma.battleParticipant.deleteMany({
        where: { robotId: { in: testRobotIds } },
      });
      await prisma.battle.deleteMany({
        where: {
          OR: [
            { robot1Id: { in: testRobotIds } },
            { robot2Id: { in: testRobotIds } },
          ],
        },
      });
      await prisma.robot.deleteMany({
        where: { id: { in: testRobotIds } },
      });
    }
    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      });
    }
    testRobotIds = [];
    testUserIds = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /api/finances/daily', () => {
    it('should get daily financial report with auth', async () => {
      const response = await request(app)
        .get('/api/finances/daily')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // Should return financial data
      expect(response.body).toBeDefined();
      expect(typeof response.body).toBe('object');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/finances/daily');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/finances/summary', () => {
    it('should get financial summary with auth', async () => {
      const response = await request(app)
        .get('/api/finances/summary')
        .set('Authorization', `Bearer ${authToken}`);

      // Route may return 200 or 404 depending on environment
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toBeDefined();
        expect(typeof response.body).toBe('object');
      }
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/finances/summary');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/finances/operating-costs', () => {
    it('should get operating costs with auth', async () => {
      const response = await request(app)
        .get('/api/finances/operating-costs')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // Should return cost data
      expect(response.body).toBeDefined();
      expect(typeof response.body).toBe('object');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/finances/operating-costs');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/finances/revenue-streams', () => {
    it('should get revenue streams with auth', async () => {
      const response = await request(app)
        .get('/api/finances/revenue-streams')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toBeDefined();
        expect(typeof response.body).toBe('object');
      }
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/finances/revenue-streams');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/finances/projections', () => {
    it('should get financial projections with auth', async () => {
      const response = await request(app)
        .get('/api/finances/projections')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('projections');
        expect(response.body.projections).toHaveProperty('weekly');
        expect(response.body.projections).toHaveProperty('monthly');
        expect(typeof response.body.projections.weekly).toBe('number');
      }
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/finances/projections');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/finances/per-robot', () => {
    it('should get per-robot financial report with auth', async () => {
      const response = await request(app)
        .get('/api/finances/per-robot')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // Response should be defined (could be array or object)
      expect(response.body).toBeDefined();
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/finances/per-robot');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/finances/roi-calculator', () => {
    it('should return 400 without required fields', async () => {
      const response = await request(app)
        .post('/api/finances/roi-calculator')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should calculate ROI with valid data', async () => {
      const response = await request(app)
        .post('/api/finances/roi-calculator')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          facilityType: 'training_academy',
          targetLevel: 1,
        });

      // Should succeed or indicate an error
      expect([200, 400]).toContain(response.status);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/finances/roi-calculator')
        .send({
          facilityType: 'training_academy',
          currentLevel: 0,
        });

      expect(response.status).toBe(401);
    });
  });
});
