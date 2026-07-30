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

    // The league filter was removed: total losses is a lifetime figure across
    // every mode, so a single-tier filter on the league_1v1 standing could not
    // narrow it meaningfully. Zod's .strip() means an old client or bookmarked
    // URL supplying `league` is ignored rather than rejected.
    it('should ignore a removed league parameter', async () => {
      const [filtered, plain] = await Promise.all([
        request(app).get('/api/leaderboards/losses').query({ league: 'bronze' }),
        request(app).get('/api/leaderboards/losses'),
      ]);

      expect(filtered.status).toBe(200);
      expect(filtered.body.leaderboard).toEqual(plain.body.leaderboard);
    });

    it('should not expose a League column or a filters block', async () => {
      const response = await request(app).get('/api/leaderboards/losses');

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty('filters');
      for (const entry of response.body.leaderboard) {
        expect(entry).not.toHaveProperty('currentLeague');
      }
    });

    // Destructions are tracked per battle type so a KotH specialist and a 1v1
    // specialist can be compared, both on their own type and on the total.
    const KILL_MODES = [
      'league_1v1', 'league_2v2', 'league_3v3', 'tag_team', 'koth',
      'grand_melee', 'tournament_1v1', 'tournament_2v2', 'tournament_3v3',
    ];

    it('should report destructions for every battle type on each entry', async () => {
      const response = await request(app).get('/api/leaderboards/losses');

      expect(response.status).toBe(200);
      for (const entry of response.body.leaderboard) {
        expect(entry).toHaveProperty('killsByMode');
        for (const mode of KILL_MODES) {
          expect(typeof entry.killsByMode[mode]).toBe('number');
        }
      }
    });

    it('should default to ranking by the all-type total', async () => {
      const response = await request(app).get('/api/leaderboards/losses');

      expect(response.status).toBe(200);
      expect(response.body.sortBy).toBe('total');

      const totals = response.body.leaderboard.map((e: { totalLosses: number }) => e.totalLosses);
      expect(totals).toEqual([...totals].sort((a: number, b: number) => b - a));
    });

    it.each(KILL_MODES)('should rank by %s when asked', async (mode) => {
      const response = await request(app)
        .get('/api/leaderboards/losses')
        .query({ sortBy: mode });

      expect(response.status).toBe(200);
      expect(response.body.sortBy).toBe(mode);

      const values = response.body.leaderboard.map(
        (e: { killsByMode: Record<string, number> }) => e.killsByMode[mode],
      );
      expect(values).toEqual([...values].sort((a: number, b: number) => b - a));
    });

    // The sort column is interpolated into raw SQL, so it must never reach the
    // query unvalidated. This app mounts the routes without the errorHandler
    // middleware, so only the status is asserted — the AppError's
    // VALIDATION_ERROR body shape is covered by the schemaValidator tests.
    it('should reject an unknown sort column', async () => {
      const response = await request(app)
        .get('/api/leaderboards/losses')
        .query({ sortBy: 'kills); DROP TABLE robots; --' });

      expect(response.status).toBe(400);
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
