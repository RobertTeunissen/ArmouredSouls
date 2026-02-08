import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import leaderboardsRoutes from '../src/routes/leaderboards';

dotenv.config();

const prisma = new PrismaClient();

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

    it('should filter by league', async () => {
      const response = await request(app)
        .get('/api/leaderboards/fame')
        .query({ league: 'bronze' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('leaderboard');
    });

    it('should filter by minimum battles', async () => {
      const response = await request(app)
        .get('/api/leaderboards/fame')
        .query({ minBattles: 5 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('leaderboard');
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
  });
});
