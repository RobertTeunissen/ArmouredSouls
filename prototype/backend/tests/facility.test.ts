import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import facilityRoutes from '../src/routes/facility';
import { createTestUser, deleteTestUser } from './testHelpers';

dotenv.config();

const prisma = new PrismaClient();

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/facility', facilityRoutes);

describe('Facility Routes', () => {
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    await prisma.$connect();
    
    // Create test user
    testUser = await createTestUser();

    // Generate JWT token
    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterAll(async () => {
    // Cleanup
    if (testUser) {
      await deleteTestUser(testUser.id);
    }
    await prisma.$disconnect();
  });

  describe('GET /api/facility', () => {
    it('should get user facilities with auth', async () => {
      const response = await request(app)
        .get('/api/facility')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Verify facility structure
      if (response.body.length > 0) {
        const facility = response.body[0];
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

      // Should either succeed or indicate max level reached
      expect([200, 400]).toContain(response.status);
      
      if (response.status === 400) {
        expect(response.body.error).toMatch(/max level|already at maximum/i);
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
