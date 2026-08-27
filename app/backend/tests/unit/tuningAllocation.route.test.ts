/**
 * Unit tests for the tuning allocation routes.
 *
 * The main thing under test is route resolution for
 * `GET /api/robots/tuning-allocations/summary`. The robots router is mounted on
 * the same `/api/robots` prefix and registers `GET /:id` ahead of it, so a
 * single-segment collection path there would be captured as a robot id and
 * rejected by `positiveIntParam` before reaching this router. These tests pin
 * that the two-segment path resolves correctly with such a router in front.
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

const mockGetTuningAllocation = jest.fn();
const mockGetTuningAllocationSummaries = jest.fn();
const mockSetTuningAllocation = jest.fn();

jest.mock('../../src/services/tuning-pool', () => ({
  getTuningAllocation: mockGetTuningAllocation,
  getTuningAllocationSummaries: mockGetTuningAllocationSummaries,
  setTuningAllocation: mockSetTuningAllocation,
}));

jest.mock('../../src/services/achievement', () => ({
  achievementService: { checkAndAward: jest.fn().mockResolvedValue([]) },
}));

jest.mock('../../src/services/security/securityMonitor', () => ({
  securityMonitor: {
    trackRateLimitViolation: jest.fn(),
    logValidationFailure: jest.fn(),
    logAuthorizationFailure: jest.fn(),
    setStableName: jest.fn(),
  },
}));

const mockPrisma = {
  user: { findUnique: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
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
import tuningAllocationRouter from '../../src/routes/tuningAllocation';
import { errorHandler } from '../../src/middleware/errorHandler';
import { AuthRequest, authenticateToken } from '../../src/middleware/auth';
import { validateRequest } from '../../src/middleware/schemaValidator';
import { positiveIntParam } from '../../src/utils/securityValidation';
import { createUserEconomicLimiter } from '../../src/middleware/userRateLimiter';

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------

/**
 * Stands in for the robots router, reproducing only the route that could shadow
 * the summary path: `GET /:id` guarded by `positiveIntParam`, mirroring
 * `src/routes/robots.ts`. Mounted first, exactly as in `src/index.ts`.
 */
function robotsRouterStandIn() {
  const router = express.Router();
  router.get(
    '/:id',
    authenticateToken,
    validateRequest({ params: z.object({ id: positiveIntParam }) }),
    (req: AuthRequest, res: Response) => {
      res.json({ matchedBy: 'robots-router', id: req.params.id });
    },
  );
  return router;
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  // Mirrors `src/index.ts`: `/api/robots` sits behind the per-user economic limiter,
  // mounted after `authenticateToken` so the limiter can key on the user id. Included
  // here so the test app matches the real mounting order — a route that is rate-limited
  // in production should be rate-limited in the app under test, or the test is
  // exercising a chain that does not exist. The cap is 100 requests per minute per user
  // and this file makes nine, so it cannot trip.
  app.use('/api/robots', authenticateToken, createUserEconomicLimiter());
  app.use('/api/robots', robotsRouterStandIn());
  app.use('/api/robots', tuningAllocationRouter);
  app.use(errorHandler);
  return app;
}

function authToken(userId = 1): string {
  return jwt.sign({ userId, username: 'testuser', role: 'user', tokenVersion: 0 }, JWT_SECRET);
}

const SUMMARIES = [
  { robotId: 1, poolSize: 20, allocated: 5, remaining: 15 },
  { robotId: 2, poolSize: 20, allocated: 0, remaining: 20 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tuning allocation routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 0, stableName: 'Test', role: 'user' });
    mockGetTuningAllocationSummaries.mockResolvedValue(SUMMARIES);
  });

  describe('GET /api/robots/tuning-allocations/summary', () => {
    it('should reach the tuning router rather than the robots router', async () => {
      const res = await request(createTestApp())
        .get('/api/robots/tuning-allocations/summary')
        .set('Authorization', `Bearer ${authToken()}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ summaries: SUMMARIES });
      expect(mockGetTuningAllocationSummaries).toHaveBeenCalledTimes(1);
    });

    it('should scope the lookup to the authenticated user', async () => {
      await request(createTestApp())
        .get('/api/robots/tuning-allocations/summary')
        .set('Authorization', `Bearer ${authToken(77)}`);

      expect(mockGetTuningAllocationSummaries).toHaveBeenCalledWith(77);
    });

    it('should not accept a user id from the query string', async () => {
      await request(createTestApp())
        .get('/api/robots/tuning-allocations/summary?userId=999')
        .set('Authorization', `Bearer ${authToken(5)}`);

      expect(mockGetTuningAllocationSummaries).toHaveBeenCalledWith(5);
    });

    it('should require authentication', async () => {
      const res = await request(createTestApp()).get('/api/robots/tuning-allocations/summary');

      expect(res.status).toBe(401);
      expect(mockGetTuningAllocationSummaries).not.toHaveBeenCalled();
    });

    it('should reject an invalid token', async () => {
      const res = await request(createTestApp())
        .get('/api/robots/tuning-allocations/summary')
        .set('Authorization', 'Bearer not-a-real-token');

      expect(res.status).toBe(401);
      expect(mockGetTuningAllocationSummaries).not.toHaveBeenCalled();
    });

    it('should return an empty list for a stable with no robots', async () => {
      mockGetTuningAllocationSummaries.mockResolvedValue([]);

      const res = await request(createTestApp())
        .get('/api/robots/tuning-allocations/summary')
        .set('Authorization', `Bearer ${authToken()}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ summaries: [] });
    });
  });

  describe('route shadowing', () => {
    it('should still route a numeric id to the robots router', async () => {
      const res = await request(createTestApp())
        .get('/api/robots/42')
        .set('Authorization', `Bearer ${authToken()}`);

      // positiveIntParam coerces, so the handler sees a number rather than a string.
      expect(res.body).toMatchObject({ matchedBy: 'robots-router', id: 42 });
    });

    it('should reject a single-segment collection path, which is why the summary path has two', async () => {
      // Documents the trap: this is what `/api/robots/tuning-allocations` would hit.
      const res = await request(createTestApp())
        .get('/api/robots/tuning-allocations')
        .set('Authorization', `Bearer ${authToken()}`);

      expect(res.status).toBe(400);
      expect(mockGetTuningAllocationSummaries).not.toHaveBeenCalled();
    });

    it('should still route the per-robot detail path to the tuning router', async () => {
      mockGetTuningAllocation.mockResolvedValue({ robotId: 3, poolSize: 10, remaining: 10 });

      const res = await request(createTestApp())
        .get('/api/robots/3/tuning-allocation')
        .set('Authorization', `Bearer ${authToken()}`);

      expect(res.status).toBe(200);
      expect(mockGetTuningAllocation).toHaveBeenCalledWith(3, 1);
    });
  });
});
