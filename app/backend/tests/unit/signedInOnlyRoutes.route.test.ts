/**
 * Player data needs a login (Nov 2026): the league standings, leaderboards,
 * Hall of Records and the robot ELO chart answered anonymous requests, and the
 * event-log summary was open while its siblings (/performance, /integrity) were
 * admin-only. These pin every one of them behind `authenticateToken`, and the
 * log summary behind `requireAdmin`.
 *
 * Only the auth layer runs here: Prisma is mocked, so an unauthenticated
 * request must be refused before any route touches the database.
 */

const mockPrisma = {
  user: { findUnique: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../src/services/security/securityMonitor', () => ({
  securityMonitor: {
    trackRateLimitViolation: jest.fn(),
    logValidationFailure: jest.fn(),
    logAuthorizationFailure: jest.fn(),
    setStableName: jest.fn(),
  },
}));

jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const JWT_SECRET = 'test-secret-key-for-jwt-signing-1234567890';
jest.mock('../../src/config/env', () => ({
  getConfig: () => ({ jwtSecret: 'test-secret-key-for-jwt-signing-1234567890' }),
}));

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import leaguesRouter from '../../src/routes/leagues';
import leaderboardsRouter from '../../src/routes/leaderboards';
import recordsRouter from '../../src/routes/records';
import analyticsRouter from '../../src/routes/analytics';
import { errorHandler } from '../../src/middleware/errorHandler';

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/leagues', leaguesRouter);
  app.use('/api/leaderboards', leaderboardsRouter);
  app.use('/api/records', recordsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use(errorHandler);
  return app;
}

const FORMERLY_PUBLIC = [
  '/api/leagues/bronze/standings',
  '/api/leagues/bronze/standings?mode=koth',
  '/api/leagues/bronze/instances',
  '/api/leaderboards/fame',
  '/api/leaderboards/losses',
  '/api/leaderboards/prestige',
  '/api/leaderboards/cache?category=fame',
  '/api/records',
  '/api/analytics/robot/1/elo?cycleRange=[1,10]',
  '/api/analytics/logs/summary?startCycle=1&endCycle=10',
];

let app: express.Express;

beforeEach(() => {
  jest.clearAllMocks();
  app = createApp();
});

describe('player data needs a login', () => {
  it.each(FORMERLY_PUBLIC)('refuses %s without a token', async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it.each(FORMERLY_PUBLIC)('refuses %s with a forged token', async (path) => {
    const forged = jwt.sign({ userId: 7, username: 'tester', role: 'admin', tokenVersion: 0 }, 'wrong-secret');
    const res = await request(app).get(path).set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/analytics/logs/summary', () => {
  it('is admin-only, like /performance and /integrity', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 0, stableName: 'Tester', role: 'user', stableType: 'human' });
    const playerToken = jwt.sign({ userId: 7, username: 'tester', role: 'user', tokenVersion: 0 }, JWT_SECRET);

    const res = await request(app)
      .get('/api/analytics/logs/summary?startCycle=1&endCycle=10')
      .set('Authorization', `Bearer ${playerToken}`);

    expect(res.status).toBe(403);
  });
});
