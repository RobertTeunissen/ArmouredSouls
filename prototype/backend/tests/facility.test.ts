import request from 'supertest';
import prisma from '../src/lib/prisma';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import facilityRoutes from '../src/routes/facility';
import { createTestUser, deleteTestUser } from './testHelpers';

dotenv.config();


// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/facility', facilityRoutes);

describe('Facility Routes', () => {
  let testUserIds: number[] = [];
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    await prisma.$connect();
    
    // Create test user
    testUser = await createTestUser();
    testUserIds.push(testUser.id);

    // Generate JWT token
    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterAll(async () => {
    // Cleanup
    if (testUserIds.length > 0) {
      for (const userId of testUserIds) {
        await deleteTestUser(userId);
      }
    }
    await prisma.$disconnect();
  });

  describe('GET /api/facility', () => {
    it('should get user facilities with auth', async () => {
      const response = await request(app)
        .get('/api/facility')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('facilities');
      expect(Array.isArray(response.body.facilities)).toBe(true);
      expect(response.body).toHaveProperty('userPrestige');
      expect(response.body).toHaveProperty('userCurrency');
      expect(response.body).toHaveProperty('robotCount');
      
      // Verify facility structure
      if (response.body.facilities.length > 0) {
        const facility = response.body.facilities[0];
        expect(facility).toHaveProperty('type');
        expect(facility).toHaveProperty('name');
        expect(facility).toHaveProperty('currentLevel');
        expect(facility).toHaveProperty('maxLevel');
        expect(facility).toHaveProperty('upgradeCost');
        expect(facility).toHaveProperty('canUpgrade');
      }
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/facility');

      expect(response.status).toBe(401);
    });

    it('should return 403 with invalid token', async () => {
      const response = await request(app)
        .get('/api/facility')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/facility/upgrade', () => {
    it('should return 400 without facility type', async () => {
      const response = await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });

    it('should return 400 with invalid facility type', async () => {
      const response = await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'invalid_facility_type' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle upgrade attempt when at max level', async () => {
      // Try to upgrade a facility that might be at max level
      const response = await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'roster_expansion' });

      // Should either succeed, indicate max level reached, or insufficient credits
      expect([200, 400, 403]).toContain(response.status);
      
      if (response.status === 400) {
        // Accept either max level or insufficient credits as valid responses
        expect(response.body.error).toMatch(/max level|already at maximum|insufficient credits/i);
      } else if (response.status === 403) {
        // Prestige requirement not met
        expect(response.body.error).toMatch(/insufficient prestige/i);
      } else {
        expect(response.body).toHaveProperty('facility');
      }
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/facility/upgrade')
        .send({ facilityType: 'roster_expansion' });

      expect(response.status).toBe(401);
    });
  });
});
