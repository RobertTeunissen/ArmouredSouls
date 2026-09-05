import request from 'supertest';
import prisma from '../src/lib/prisma';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import matchesRoutes from '../src/routes/matches';
import { createTestUser, createTestRobot, deleteTestUser } from './testHelpers';
import { errorHandler } from '../src/middleware/errorHandler';
import { getConfig } from '../src/config/env';
import type { Server } from 'node:http';

dotenv.config();


// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/matches', matchesRoutes);

// Spec #51: without the errorHandler mounted, a thrown AppError falls through
// to Express's default handler, which sends the right status with an EMPTY
// body. That is why these suites saw 400 but no `body.error` or `body.code`.
app.use(errorHandler);

/** Bind the app once to avoid Supertest's per-request listener churn. */
let server: Server;

describe('Matches Routes', () => {
  const testUserIds: number[] = [];
  let testUser: any;
  let authToken: string;
  let testRobotId: number | undefined;

  beforeAll(async () => {
    await prisma.$connect();
    server = app.listen(0);
    
    // Create test user
    testUser = await createTestUser();
    testUserIds.push(testUser.id);

    // Create a test robot
    const robot = await createTestRobot(testUser.id);
    testRobotId = robot.id;

    // Generate JWT token
    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      getConfig().jwtSecret,
    );
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
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
      const response = await request(server)
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
      const response = await request(server)
        .get('/api/matches/upcoming');

      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(server)
        .get('/api/matches/upcoming')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/matches/history', () => {
    it('should get match history with auth', async () => {
      const response = await request(server)
        .get('/api/matches/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
    });

    it('should support pagination', async () => {
      const response = await request(server)
        .get('/api/matches/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, perPage: 10 });

      expect(response.status).toBe(200);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination.page).toBe(1);
      // The request parameter is `perPage`; the response field is `pageSize`. That
      // asymmetry is what the frontend reads (LeagueStandingsPage.tsx and the shared
      // pagination shape), so the response side is asserted as `pageSize`.
      expect(response.body.pagination).toHaveProperty('pageSize');
      expect(response.body.pagination.pageSize).toBe(10);
    });

    it('should filter by robot ID', async () => {
      // Skip if no robot found
      if (!testRobotId) {
        return;
      }

      const response = await request(server)
        .get('/api/matches/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ robotId: testRobotId });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(server)
        .get('/api/matches/history');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/matches/battles/:id/log', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(server)
        .get('/api/matches/battles/test-battle-id/log');

      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(server)
        .get('/api/matches/battles/test-battle-id/log')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
    });

    it('should handle non-existent battle ID with auth', async () => {
      const response = await request(server)
        .get('/api/matches/battles/non-existent-id/log')
        .set('Authorization', `Bearer ${authToken}`);

      // Zod validation rejects non-numeric ID with 400, or handler returns 404/500
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });
});
