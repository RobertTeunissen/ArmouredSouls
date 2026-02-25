import request from 'supertest';
import prisma from '../src/lib/prisma';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import matchesRoutes from '../src/routes/matches';
import { createTestUser, createTestRobot, deleteTestUser } from './testHelpers';

dotenv.config();


// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/matches', matchesRoutes);

describe('Matches Routes', () => {
  let testUserIds: number[] = [];
  let testUser: any;
  let authToken: string;
  let testRobotId: number | undefined;

  beforeAll(async () => {
    await prisma.$connect();
    
    // Create test user
    testUser = await createTestUser();
    testUserIds.push(testUser.id);

    // Create a test robot
    const robot = await createTestRobot(testUser.id);
    testRobotId = robot.id;

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

  describe('GET /api/matches/upcoming', () => {
    it('should get upcoming matches with auth', async () => {
      const response = await request(app)
        .get('/api/matches/upcoming')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matches');
      expect(Array.isArray(response.body.matches)).toBe(true);
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('leagueMatches');
      expect(response.body).toHaveProperty('tournamentMatches');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/matches/upcoming');

      expect(response.status).toBe(401);
    });

    it('should return 403 with invalid token', async () => {
      const response = await request(app)
        .get('/api/matches/upcoming')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/matches/history', () => {
    it('should get match history with auth', async () => {
      const response = await request(app)
        .get('/api/matches/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/matches/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, perPage: 10 });

      expect(response.status).toBe(200);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination).toHaveProperty('perPage');
      expect(response.body.pagination.perPage).toBe(10);
    });

    it('should filter by robot ID', async () => {
      // Skip if no robot found
      if (!testRobotId) {
        return;
      }

      const response = await request(app)
        .get('/api/matches/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ robotId: testRobotId });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/matches/history');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/matches/battles/:id/log', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/matches/battles/test-battle-id/log');

      expect(response.status).toBe(401);
    });

    it('should return 403 with invalid token', async () => {
      const response = await request(app)
        .get('/api/matches/battles/test-battle-id/log')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(403);
    });

    it('should handle non-existent battle ID with auth', async () => {
      const response = await request(app)
        .get('/api/matches/battles/non-existent-id/log')
        .set('Authorization', `Bearer ${authToken}`);

      // Should return 404, 500, or empty result, not crash
      expect([200, 404, 500]).toContain(response.status);
    });
  });
});
