import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import leaguesRoutes from '../src/routes/leagues';
import { createTestUser, deleteTestUser } from './testHelpers';

dotenv.config();

const prisma = new PrismaClient();

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/leagues', leaguesRoutes);

describe('Leagues Routes', () => {
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

  describe('GET /api/leagues/:tier/standings', () => {
    it('should get bronze league standings', async () => {
      const response = await request(app)
        .get('/api/leagues/bronze/standings');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total');
      expect(typeof response.body.pagination.total).toBe('number');
    });

    it('should get silver league standings', async () => {
      const response = await request(app)
        .get('/api/leagues/silver/standings');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });

    it('should return 400 for invalid tier', async () => {
      const response = await request(app)
        .get('/api/leagues/invalid_tier/standings');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/leagues/bronze/standings')
        .query({ page: 1, perPage: 10 });

      expect(response.status).toBe(200);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination).toHaveProperty('pageSize');
      expect(response.body.pagination.pageSize).toBe(10);
    });
  });

  describe('GET /api/leagues/:tier/instances', () => {
    it('should get bronze league instances', async () => {
      const response = await request(app)
        .get('/api/leagues/bronze/instances');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Each instance should have required fields
      if (response.body.length > 0) {
        const instance = response.body[0];
        expect(instance).toHaveProperty('leagueId');
        expect(instance).toHaveProperty('leagueTier');
      }
    });

    it('should return 400 for invalid tier', async () => {
      const response = await request(app)
        .get('/api/leagues/invalid_tier/instances');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
});
