import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import weaponsRoutes from '../src/routes/weapons';
import { createTestUser, deleteTestUser } from './testHelpers';

dotenv.config();

const prisma = new PrismaClient();

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/weapons', weaponsRoutes);

describe('Weapons Routes', () => {
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

  describe('GET /api/weapons', () => {
    it('should get all weapons with auth', async () => {
      const response = await request(app)
        .get('/api/weapons')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Verify weapon structure if any weapons exist
      if (response.body.length > 0) {
        const weapon = response.body[0];
        expect(weapon).toHaveProperty('id');
        expect(weapon).toHaveProperty('name');
        expect(weapon).toHaveProperty('cost');
        expect(weapon).toHaveProperty('baseDamage');
      }
    });

    it('should return weapons sorted by cost', async () => {
      const response = await request(app)
        .get('/api/weapons')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      
      // Verify weapons are sorted by cost (ascending)
      if (response.body.length > 1) {
        for (let i = 1; i < response.body.length; i++) {
          expect(response.body[i].cost).toBeGreaterThanOrEqual(response.body[i - 1].cost);
        }
      }
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/weapons');

      expect(response.status).toBe(401);
    });

    it('should return 403 with invalid token', async () => {
      const response = await request(app)
        .get('/api/weapons')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
    });
  });
});
