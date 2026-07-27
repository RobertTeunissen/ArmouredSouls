import request from 'supertest';
import prisma from '../src/lib/prisma';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import leaderboardsRoutes from '../src/routes/leaderboards';

dotenv.config();


// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/leaderboards', leaderboardsRoutes);

describe('Leaderboards Routes', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /api/leaderboards/fame', () => {
    it('should get fame leaderboard', async () => {
      const response = await request(app)
        .get('/api/leaderboards/fame');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('leaderboard');
      expect(Array.isArray(response.body.leaderboard)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/leaderboards/fame')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination.page).toBe(1);
    });

    // Spec #46 R5: `league` and `minBattles` were removed. Zod's .strip()
    // means an old client or bookmarked URL supplying either is ignored
    // rather than rejected, and the result matches the unfiltered request.
    it('should ignore a removed league parameter', async () => {
      const [filtered, plain] = await Promise.all([
        request(app).get('/api/leaderboards/fame').query({ league: 'bronze' }),
        request(app).get('/api/leaderboards/fame'),
      ]);

      expect(filtered.status).toBe(200);
      expect(filtered.body.leaderboard).toEqual(plain.body.leaderboard);
    });

    it('should ignore a removed minBattles parameter', async () => {
      const [filtered, plain] = await Promise.all([
        request(app).get('/api/leaderboards/fame').query({ minBattles: 50 }),
        request(app).get('/api/leaderboards/fame'),
      ]);

      expect(filtered.status).toBe(200);
      expect(filtered.body.leaderboard).toEqual(plain.body.leaderboard);
    });

    it('should not expose a League column or a filters block', async () => {
      const response = await request(app).get('/api/leaderboards/fame');

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty('filters');
      for (const entry of response.body.leaderboard) {
        expect(entry).not.toHaveProperty('currentLeague');
      }
    });
  });

  describe('GET /api/leaderboards/losses', () => {
    it('should get losses leaderboard', async () => {
      const response = await request(app)
        .get('/api/leaderboards/losses');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('leaderboard');
      expect(Array.isArray(response.body.leaderboard)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/leaderboards/losses')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.pagination).toHaveProperty('page');
    });
  });

  describe('GET /api/leaderboards/prestige', () => {
    it('should get prestige leaderboard', async () => {
      const response = await request(app)
        .get('/api/leaderboards/prestige');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('leaderboard');
      expect(Array.isArray(response.body.leaderboard)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/leaderboards/prestige')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination.page).toBe(1);
    });

    // Spec #46 R5: `minRobots` was removed — it suppressed single-robot stables
    // from a ranking of stable prestige.
    it('should ignore a removed minRobots parameter', async () => {
      const [filtered, plain] = await Promise.all([
        request(app).get('/api/leaderboards/prestige').query({ minRobots: 5 }),
        request(app).get('/api/leaderboards/prestige'),
      ]);

      expect(filtered.status).toBe(200);
      expect(filtered.body.leaderboard).toEqual(plain.body.leaderboard);
    });

    it('should not expose the derived bonus fields or a filters block', async () => {
      const response = await request(app).get('/api/leaderboards/prestige');

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty('filters');
      for (const entry of response.body.leaderboard) {
        expect(entry).not.toHaveProperty('battleWinningsBonus');
        expect(entry).not.toHaveProperty('merchandisingMultiplier');
        // totalRobots is retained as identifying context (R5.14)
        expect(entry).toHaveProperty('totalRobots');
      }
    });
  });
});
