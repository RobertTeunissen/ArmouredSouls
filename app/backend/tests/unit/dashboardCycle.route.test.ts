/**
 * Unit tests for `GET /api/dashboard/current-cycle` — Spec #48 Requirement 8.
 *
 * Built on the express-app pattern in `tuningAllocation.route.test.ts`, with a
 * robots-router stand-in mounted FIRST. That stand-in is the point: the
 * tuning-allocation endpoint needed a two-segment path because `/api/robots`'s
 * `GET /:id` captured single-segment collection paths. This endpoint sits on a fresh
 * `/api/dashboard` base path instead, and these tests pin that the shadowing cannot
 * reach it (criterion 2).
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

const mockGetCycleProgressSummary = jest.fn();

jest.mock('../../src/services/dashboard/cycleProgressService', () => ({
  getCycleProgressSummary: mockGetCycleProgressSummary,
}));

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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import express, { Response } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import dashboardCycleRouter from '../../src/routes/dashboardCycle';
import { errorHandler } from '../../src/middleware/errorHandler';
import { AuthRequest, authenticateToken } from '../../src/middleware/auth';
import { validateRequest } from '../../src/middleware/schemaValidator';
import { positiveIntParam } from '../../src/utils/securityValidation';

const SUMMARY = {
  window: { start: '2026-08-26T00:00:00.000Z', end: '2026-08-26T12:00:00.000Z', cycleNumber: 61 },
  battlesFought: 3,
  matchesScheduled: 5,
  winLossDraw: { wins: 2, losses: 1, draws: 0 },
  bestPlacement: { position: 4, fieldSize: 20 },
  remainingSlotsUtc: ['15:00', '18:00'],
  nextSettlementAt: '2026-08-27T00:00:00.000Z',
  prestigeEarned: 40,
  battleEarnings: 51000,
  repairSpend: { manual: 1200, automatic: 800 },
  comparison: {
    cycleNumber: 60,
    prestigeEarned: 55,
    battleEarnings: 62000,
    repairSpend: { manual: 900, automatic: 1500 },
  },
};

/**
 * A stand-in for the robots router, mounted first with the same `GET /:id` shape
 * that shadowed `/api/robots/tuning-allocations`. It is mounted on `/api/robots`,
 * NOT `/api/dashboard`, which is exactly why it cannot interfere here.
 */
function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  const robotsStandIn = express.Router();
  robotsStandIn.get(
    '/:id',
    authenticateToken,
    validateRequest({ params: z.object({ id: positiveIntParam }) }),
    (_req: AuthRequest, res: Response) => {
      res.json({ reached: 'robots-:id' });
    },
  );
  app.use('/api/robots', robotsStandIn);

  app.use('/api/dashboard', dashboardCycleRouter);
  app.use(errorHandler);
  return app;
}

function token(payload: Record<string, unknown> = {}): string {
  return jwt.sign(
    { userId: 7, username: 'tester', role: 'user', tokenVersion: 0, ...payload },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

let app: express.Express;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCycleProgressSummary.mockReset();
  mockGetCycleProgressSummary.mockResolvedValue(SUMMARY);
  // `authenticateToken` verifies tokenVersion against the database.
  mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 0, stableName: 'Test', role: 'user' });
  app = createApp();
});

describe('Requirement 8 criteria 1 and 2: route resolution', () => {
  it('resolves past a robots router mounted first', async () => {
    const res = await request(app)
      .get('/api/dashboard/current-cycle')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(SUMMARY);
    expect(mockGetCycleProgressSummary).toHaveBeenCalledTimes(1);
  });

  it('the robots stand-in still captures its own single-segment paths', async () => {
    // Confirms the stand-in is a faithful reproduction of the shadowing shape, so the
    // test above is a real result rather than an accident of a broken fixture.
    const res = await request(app)
      .get('/api/robots/42')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reached: 'robots-:id' });
  });
});

describe('Requirement 8 criterion 9: authentication precedes everything', () => {
  it('rejects a request with no token and calls no service', async () => {
    const res = await request(app).get('/api/dashboard/current-cycle');

    expect(res.status).toBe(401);
    expect(mockGetCycleProgressSummary).not.toHaveBeenCalled();
  });

  it('rejects a token signed with the wrong secret and calls no service', async () => {
    const bad = jwt.sign({ userId: 7, username: 'tester', role: 'user' }, 'wrong-secret');
    const res = await request(app)
      .get('/api/dashboard/current-cycle')
      .set('Authorization', `Bearer ${bad}`);

    expect(res.status).toBe(401);
    expect(mockGetCycleProgressSummary).not.toHaveBeenCalled();
  });

  it('rejects a token whose tokenVersion no longer matches the database', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 3, stableName: 'T', role: 'user' });

    const res = await request(app)
      .get('/api/dashboard/current-cycle')
      .set('Authorization', `Bearer ${token({ tokenVersion: 0 })}`);

    expect(res.status).toBe(401);
    expect(mockGetCycleProgressSummary).not.toHaveBeenCalled();
  });
});

describe('Requirement 8 criteria 3 and 4: input handling', () => {
  it('strips an unknown query field rather than rejecting the request', async () => {
    const res = await request(app)
      .get('/api/dashboard/current-cycle?bogus=1&anotherOne=abc')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(mockGetCycleProgressSummary).toHaveBeenCalledTimes(1);
  });

  it('takes the user id from the token and ignores one supplied in the query', async () => {
    const res = await request(app)
      .get('/api/dashboard/current-cycle?userId=999')
      .set('Authorization', `Bearer ${token({ userId: 7 })}`);

    expect(res.status).toBe(200);
    expect(mockGetCycleProgressSummary).toHaveBeenCalledWith(7);
  });

  it('ignores a user id supplied in the body', async () => {
    const res = await request(app)
      .get('/api/dashboard/current-cycle')
      .set('Authorization', `Bearer ${token({ userId: 7 })}`)
      .send({ userId: 999 });

    expect(res.status).toBe(200);
    expect(mockGetCycleProgressSummary).toHaveBeenCalledWith(7);
  });
});

describe('Requirement 8 criterion 8: the route delegates', () => {
  it('propagates a service failure to the error handler rather than swallowing it', async () => {
    mockGetCycleProgressSummary.mockRejectedValueOnce(new Error('aggregation exploded'));

    const res = await request(app)
      .get('/api/dashboard/current-cycle')
      .set('Authorization', `Bearer ${token()}`);

    // Express 5 forwards the rejection; the handler carries no try/catch.
    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});
