/**
 * Integration test for Streaming Studio prestige validation
 * Validates: Requirements 6.1-6.9
 * 
 * Tests that prestige requirements are enforced when upgrading the Streaming Studio facility
 */

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

describe('Streaming Studio Prestige Validation', () => {
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Create test user with sufficient credits but no prestige
    testUser = await createTestUser();
    
    // Give user enough credits for all upgrades
    await prisma.user.update({
      where: { id: testUser.id },
      data: { currency: 10000000, prestige: 0 },
    });

    // Generate JWT token
    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterEach(async () => {
    // Cleanup
    if (testUser) {
      await deleteTestUser(testUser.id);
    }
  });

  describe('Levels 1-3: No prestige required', () => {
    it('should allow upgrade to Level 1 with 0 prestige', async () => {
      const response = await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });

      expect(response.status).toBe(200);
      expect(response.body.facility.level).toBe(1);
    });

    it('should allow upgrade to Level 2 with 0 prestige', async () => {
      // First upgrade to level 1
      await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });

      // Then upgrade to level 2
      const response = await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });

      expect(response.status).toBe(200);
      expect(response.body.facility.level).toBe(2);
    });

    it('should allow upgrade to Level 3 with 0 prestige', async () => {
      // Upgrade to level 1
      await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });

      // Upgrade to level 2
      await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });

      // Upgrade to level 3
      const response = await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });

      expect(response.status).toBe(200);
      expect(response.body.facility.level).toBe(3);
    });
  });

  describe('Level 4: Requires 1,000 prestige', () => {
    beforeEach(async () => {
      // Upgrade to level 3 first
      await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });
      await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });
      await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });
    });

    it('should block upgrade to Level 4 with insufficient prestige', async () => {
      // User has 0 prestige, needs 1000
      const response = await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient prestige');
      expect(response.body.required).toBe(1000);
      expect(response.body.current).toBe(0);
      expect(response.body.message).toContain('Streaming Studio Level 4 requires 1,000 prestige');
    });

    it('should allow upgrade to Level 4 with exactly 1,000 prestige', async () => {
      // Give user exactly 1000 prestige
      await prisma.user.update({
        where: { id: testUser.id },
        data: { prestige: 1000 },
      });

      const response = await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });

      expect(response.status).toBe(200);
      expect(response.body.facility.level).toBe(4);
    });

    it('should allow upgrade to Level 4 with more than 1,000 prestige', async () => {
      // Give user 1500 prestige
      await prisma.user.update({
        where: { id: testUser.id },
        data: { prestige: 1500 },
      });

      const response = await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });

      expect(response.status).toBe(200);
      expect(response.body.facility.level).toBe(4);
    });
  });

  describe('Level 5: Requires 2,500 prestige', () => {
    beforeEach(async () => {
      // Upgrade to level 4 first (with sufficient prestige)
      await prisma.user.update({
        where: { id: testUser.id },
        data: { prestige: 1000 },
      });
      
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/facility/upgrade')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ facilityType: 'streaming_studio' });
      }
    });

    it('should block upgrade to Level 5 with insufficient prestige', async () => {
      // User has 1000 prestige, needs 2500
      const response = await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient prestige');
      expect(response.body.required).toBe(2500);
      expect(response.body.message).toContain('Streaming Studio Level 5 requires 2,500 prestige');
    });

    it('should allow upgrade to Level 5 with sufficient prestige', async () => {
      // Give user 2500 prestige
      await prisma.user.update({
        where: { id: testUser.id },
        data: { prestige: 2500 },
      });

      const response = await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });

      expect(response.status).toBe(200);
      expect(response.body.facility.level).toBe(5);
    });
  });

  describe('Higher levels: Progressive prestige requirements', () => {
    it('should enforce 5,000 prestige for Level 6', async () => {
      // Upgrade to level 5
      await prisma.user.update({
        where: { id: testUser.id },
        data: { prestige: 2500 },
      });
      
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/facility/upgrade')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ facilityType: 'streaming_studio' });
      }

      // Try to upgrade to level 6 with insufficient prestige
      const response = await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });

      expect(response.status).toBe(403);
      expect(response.body.required).toBe(5000);
    });

    it('should enforce 10,000 prestige for Level 7', async () => {
      // Upgrade to level 6
      await prisma.user.update({
        where: { id: testUser.id },
        data: { prestige: 5000 },
      });
      
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/api/facility/upgrade')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ facilityType: 'streaming_studio' });
      }

      // Try to upgrade to level 7 with insufficient prestige
      const response = await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });

      expect(response.status).toBe(403);
      expect(response.body.required).toBe(10000);
    });

    it('should enforce 15,000 prestige for Level 8', async () => {
      // Upgrade to level 7
      await prisma.user.update({
        where: { id: testUser.id },
        data: { prestige: 10000 },
      });
      
      for (let i = 0; i < 7; i++) {
        await request(app)
          .post('/api/facility/upgrade')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ facilityType: 'streaming_studio' });
      }

      // Try to upgrade to level 8 with insufficient prestige
      const response = await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });

      expect(response.status).toBe(403);
      expect(response.body.required).toBe(15000);
    });

    it('should enforce 25,000 prestige for Level 9', async () => {
      // Upgrade to level 8
      await prisma.user.update({
        where: { id: testUser.id },
        data: { prestige: 15000 },
      });
      
      for (let i = 0; i < 8; i++) {
        await request(app)
          .post('/api/facility/upgrade')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ facilityType: 'streaming_studio' });
      }

      // Try to upgrade to level 9 with insufficient prestige
      const response = await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });

      expect(response.status).toBe(403);
      expect(response.body.required).toBe(25000);
    });

    it('should enforce 50,000 prestige for Level 10', async () => {
      // Upgrade to level 9
      await prisma.user.update({
        where: { id: testUser.id },
        data: { prestige: 25000 },
      });
      
      for (let i = 0; i < 9; i++) {
        await request(app)
          .post('/api/facility/upgrade')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ facilityType: 'streaming_studio' });
      }

      // Try to upgrade to level 10 with insufficient prestige
      const response = await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });

      expect(response.status).toBe(403);
      expect(response.body.required).toBe(50000);
    });

    it('should allow upgrade to Level 10 with 50,000 prestige', async () => {
      // Upgrade to level 9 and give sufficient prestige for level 10
      await prisma.user.update({
        where: { id: testUser.id },
        data: { prestige: 50000 },
      });
      
      for (let i = 0; i < 9; i++) {
        await request(app)
          .post('/api/facility/upgrade')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ facilityType: 'streaming_studio' });
      }

      // Upgrade to level 10
      const response = await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });

      expect(response.status).toBe(200);
      expect(response.body.facility.level).toBe(10);
    });
  });

  describe('Error message format', () => {
    it('should display error message with required prestige amount', async () => {
      // Upgrade to level 3
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/facility/upgrade')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ facilityType: 'streaming_studio' });
      }

      // Try to upgrade to level 4 without prestige
      const response = await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('required');
      expect(response.body).toHaveProperty('current');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/Streaming Studio Level \d+ requires [\d,]+ prestige/);
    });
  });
});
