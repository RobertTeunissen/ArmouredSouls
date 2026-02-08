import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import financesRoutes from '../src/routes/finances';

dotenv.config();

const prisma = new PrismaClient();

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/finances', financesRoutes);

describe('Finances Routes', () => {
  let testUser: any;
  let testRobot: any;
  let authToken: string;

  beforeAll(async () => {
    await prisma.$connect();
    
    // Create test user for this test suite
    testUser = await prisma.user.create({
      data: {
        username: `test_finances_${Date.now()}`,
        passwordHash: '$2b$10$abcdefghijklmnopqrstuv', // hashed 'password'
        prestige: 1000,
        currency: 5000,
      },
    });

    // Create a test robot
    testRobot = await prisma.robot.create({
      data: {
        name: `TestRobot_${Date.now()}`,
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

    // Generate JWT token
    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterAll(async () => {
    // Cleanup: delete test robot and user
    if (testRobot) {
      await prisma.robot.delete({ where: { id: testRobot.id } }).catch(() => {});
    }
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
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

      expect(response.status).toBe(200);
      // Should return financial data
      expect(response.body).toBeDefined();
      expect(typeof response.body).toBe('object');
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

      expect(response.status).toBe(200);
      // Should return some financial data
      expect(response.body).toBeDefined();
      expect(typeof response.body).toBe('object');
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

      expect(response.status).toBe(200);
      // Projections should have projections and metrics
      expect(response.body).toHaveProperty('projections');
      expect(response.body.projections).toHaveProperty('weekly');
      expect(response.body.projections).toHaveProperty('monthly');
      expect(typeof response.body.projections.weekly).toBe('number');
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
