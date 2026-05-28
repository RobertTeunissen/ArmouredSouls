/**
 * API route tests for subscription endpoints.
 *
 * Tests Zod validation, auth, ownership 403, cap exceeded 400,
 * lock 409, success responses, and admin analytics authorization.
 *
 * _Requirements: R10.1, R10.2, R10.3_
 */

import request from 'supertest';
import express from 'express';
import { errorHandler } from '../../src/middleware/errorHandler';

// ── Mocks ────────────────────────────────────────────────────────────

// Mock prisma
const mockPrisma = {
  robot: { count: jest.fn() },
  subscription: {
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
  cycleMetadata: { findFirst: jest.fn() },
  auditLog: { findMany: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

// Mock logger
jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock security monitor
jest.mock('../../src/services/security/securityMonitor', () => ({
  securityMonitor: {
    logValidationFailure: jest.fn(),
    logAuthorizationFailure: jest.fn(),
    logAdminAccess: jest.fn(),
    trackRateLimitViolation: jest.fn(),
  },
}));

// Mock subscription service
const mockGetSubscriptionsForRobot = jest.fn();
const mockSubscribeRobot = jest.fn();
const mockUnsubscribeRobot = jest.fn();
const mockGetStableOverview = jest.fn();
jest.mock('../../src/services/subscription/subscriptionService', () => ({
  __esModule: true,
  getSubscriptionsForRobot: (...args: unknown[]) => mockGetSubscriptionsForRobot(...args),
  subscribeRobot: (...args: unknown[]) => mockSubscribeRobot(...args),
  unsubscribeRobot: (...args: unknown[]) => mockUnsubscribeRobot(...args),
  getStableOverview: (...args: unknown[]) => mockGetStableOverview(...args),
}));

// Mock eligibility filter
const mockGetEligibleEvents = jest.fn();
jest.mock('../../src/services/subscription/rosterEligibilityFilter', () => ({
  __esModule: true,
  getEligibleEvents: (...args: unknown[]) => mockGetEligibleEvents(...args),
}));

// Mock auth middleware — we control authentication per test
let mockUser: { userId: number; username: string; role: string } | null = null;
jest.mock('../../src/middleware/auth', () => ({
  __esModule: true,
  authenticateToken: (req: any, res: any, next: any) => {
    if (!mockUser) {
      return res.status(401).json({ error: 'Access token required' });
    }
    req.user = mockUser;
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  },
}));

// Import routes after mocks are set up
import subscriptionsRoutes from '../../src/routes/subscriptions';
import { SubscriptionError, SubscriptionErrorCode } from '../../src/errors/subscriptionErrors';

// ── Test App ─────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/api/subscriptions', subscriptionsRoutes);
app.use(errorHandler);

// ── Tests ────────────────────────────────────────────────────────────

describe('Subscription Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { userId: 1, username: 'testuser', role: 'user' };
  });

  // ── Auth Tests ───────────────────────────────────────────────────

  describe('Authentication', () => {
    it('GET /robot/:robotId returns 401 without token', async () => {
      mockUser = null;
      const res = await request(app).get('/api/subscriptions/robot/1');
      expect(res.status).toBe(401);
    });

    it('POST /robot/:robotId/subscribe returns 401 without token', async () => {
      mockUser = null;
      const res = await request(app)
        .post('/api/subscriptions/robot/1/subscribe')
        .send({ eventType: 'league' });
      expect(res.status).toBe(401);
    });

    it('POST /robot/:robotId/unsubscribe returns 401 without token', async () => {
      mockUser = null;
      const res = await request(app)
        .post('/api/subscriptions/robot/1/unsubscribe')
        .send({ eventType: 'league' });
      expect(res.status).toBe(401);
    });

    it('GET /overview returns 401 without token', async () => {
      mockUser = null;
      const res = await request(app).get('/api/subscriptions/overview');
      expect(res.status).toBe(401);
    });

    it('GET /registry returns 401 without token', async () => {
      mockUser = null;
      const res = await request(app).get('/api/subscriptions/registry');
      expect(res.status).toBe(401);
    });

    it('GET /admin/analytics returns 401 without token', async () => {
      mockUser = null;
      const res = await request(app).get('/api/subscriptions/admin/analytics');
      expect(res.status).toBe(401);
    });
  });

  // ── Zod Validation Tests ─────────────────────────────────────────

  describe('Zod Validation', () => {
    it('GET /robot/:robotId returns 400 for non-numeric robotId', async () => {
      const res = await request(app).get('/api/subscriptions/robot/abc');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('GET /robot/:robotId returns 400 for negative robotId', async () => {
      const res = await request(app).get('/api/subscriptions/robot/-1');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('GET /robot/:robotId returns 400 for zero robotId', async () => {
      const res = await request(app).get('/api/subscriptions/robot/0');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('POST /robot/:robotId/subscribe returns 400 for missing eventType', async () => {
      const res = await request(app)
        .post('/api/subscriptions/robot/1/subscribe')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('POST /robot/:robotId/subscribe returns 400 for empty eventType', async () => {
      const res = await request(app)
        .post('/api/subscriptions/robot/1/subscribe')
        .send({ eventType: '' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('POST /robot/:robotId/subscribe returns 400 for eventType exceeding 30 chars', async () => {
      const res = await request(app)
        .post('/api/subscriptions/robot/1/subscribe')
        .send({ eventType: 'a'.repeat(31) });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('POST /robot/:robotId/unsubscribe returns 400 for missing eventType', async () => {
      const res = await request(app)
        .post('/api/subscriptions/robot/1/unsubscribe')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // ── Ownership 403 Tests ──────────────────────────────────────────

  describe('Ownership Verification', () => {
    it('POST /robot/:robotId/subscribe returns 403 when robot not owned by user', async () => {
      mockSubscribeRobot.mockRejectedValue(
        new SubscriptionError(SubscriptionErrorCode.ACCESS_DENIED, 'Access denied', 403),
      );

      const res = await request(app)
        .post('/api/subscriptions/robot/999/subscribe')
        .send({ eventType: 'league' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCESS_DENIED');
    });

    it('POST /robot/:robotId/unsubscribe returns 403 when robot not owned by user', async () => {
      mockUnsubscribeRobot.mockRejectedValue(
        new SubscriptionError(SubscriptionErrorCode.ACCESS_DENIED, 'Access denied', 403),
      );

      const res = await request(app)
        .post('/api/subscriptions/robot/999/unsubscribe')
        .send({ eventType: 'league' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCESS_DENIED');
    });
  });

  // ── Cap Exceeded 400 Tests ───────────────────────────────────────

  describe('Cap Exceeded', () => {
    it('POST /robot/:robotId/subscribe returns 400 when cap exceeded', async () => {
      mockSubscribeRobot.mockRejectedValue(
        new SubscriptionError(
          SubscriptionErrorCode.SUBSCRIPTION_CAP_EXCEEDED,
          'Robot has 3/3 subscriptions. Upgrade Booking Office for more.',
          400,
          { currentCount: 3, cap: 3, level: 0 },
        ),
      );

      const res = await request(app)
        .post('/api/subscriptions/robot/1/subscribe')
        .send({ eventType: 'koth' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SUBSCRIPTION_CAP_EXCEEDED');
      expect(res.body.details).toEqual({ currentCount: 3, cap: 3, level: 0 });
    });
  });

  // ── Lock 409 Tests ───────────────────────────────────────────────

  describe('Subscription Lock', () => {
    it('POST /robot/:robotId/unsubscribe returns 409 when tournament robot is alive in bracket', async () => {
      mockUnsubscribeRobot.mockRejectedValue(
        new SubscriptionError(
          SubscriptionErrorCode.EVENT_SUBSCRIPTION_LOCKED,
          'Cannot unsubscribe from tournament while alive in a bracket',
          409,
        ),
      );

      const res = await request(app)
        .post('/api/subscriptions/robot/1/unsubscribe')
        .send({ eventType: 'tournament' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EVENT_SUBSCRIPTION_LOCKED');
    });
  });

  // ── Success Response Tests ───────────────────────────────────────

  describe('Success Responses', () => {
    it('GET /robot/:robotId returns subscription info', async () => {
      mockGetSubscriptionsForRobot.mockResolvedValue({
        subscriptions: [
          { id: 1, robotId: 1, eventType: 'league', createdAt: new Date() },
          { id: 2, robotId: 1, eventType: 'tournament', createdAt: new Date() },
        ],
        cap: 4,
        level: 1,
      });

      const res = await request(app).get('/api/subscriptions/robot/1');

      expect(res.status).toBe(200);
      expect(res.body.subscriptions).toHaveLength(2);
      expect(res.body.cap).toBe(4);
      expect(res.body.level).toBe(1);
    });

    it('POST /robot/:robotId/subscribe returns success message', async () => {
      mockSubscribeRobot.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/subscriptions/robot/1/subscribe')
        .send({ eventType: 'league' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Subscribed to league');
      expect(mockSubscribeRobot).toHaveBeenCalledWith(1, 'league', 1);
    });

    it('POST /robot/:robotId/unsubscribe returns success message', async () => {
      mockUnsubscribeRobot.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/subscriptions/robot/1/unsubscribe')
        .send({ eventType: 'tournament' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Unsubscribed from tournament');
      expect(mockUnsubscribeRobot).toHaveBeenCalledWith(1, 'tournament', 1);
    });

    it('GET /overview returns stable overview', async () => {
      mockGetStableOverview.mockResolvedValue({
        robots: [
          { robotId: 1, robotName: 'Bot1', subscriptions: ['league', 'koth'], cap: 3 },
        ],
        registeredEvents: [
          { type: 'league', label: '1v1 League' },
          { type: 'koth', label: 'King of the Hill' },
        ],
        bookingOfficeLevel: 0,
      });

      const res = await request(app).get('/api/subscriptions/overview');

      expect(res.status).toBe(200);
      expect(res.body.robots).toHaveLength(1);
      expect(res.body.registeredEvents).toHaveLength(2);
      expect(res.body.bookingOfficeLevel).toBe(0);
    });

    it('GET /registry returns eligible events', async () => {
      mockPrisma.robot.count.mockResolvedValue(2);
      mockGetEligibleEvents.mockReturnValue([
        { type: 'league', label: '1v1 League', eligible: true },
        { type: 'tag_team', label: 'Tag Team', eligible: true },
      ]);

      const res = await request(app).get('/api/subscriptions/registry');

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(2);
      expect(mockGetEligibleEvents).toHaveBeenCalledWith(2);
    });
  });

  // ── Admin Analytics Tests ────────────────────────────────────────

  describe('Admin Analytics', () => {
    it('GET /admin/analytics returns 403 for non-admin user', async () => {
      mockUser = { userId: 1, username: 'testuser', role: 'user' };

      const res = await request(app).get('/api/subscriptions/admin/analytics');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Admin access required');
    });

    it('GET /admin/analytics returns data for admin user', async () => {
      mockUser = { userId: 1, username: 'admin', role: 'admin' };

      mockPrisma.subscription.groupBy.mockResolvedValue([
        { eventType: 'league', _count: { id: 42 } },
        { eventType: 'tournament', _count: { id: 30 } },
      ]);
      mockPrisma.cycleMetadata.findFirst.mockResolvedValue({ totalCycles: 60 });
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const res = await request(app).get('/api/subscriptions/admin/analytics');

      expect(res.status).toBe(200);
      expect(res.body.perEvent).toHaveLength(2);
      expect(res.body.perEvent[0]).toEqual({ eventType: 'league', subscriberCount: 42 });
      expect(res.body.trends).toBeDefined();
      expect(res.body.perStable).toBeDefined();
    });

    it('GET /admin/analytics accepts days query parameter', async () => {
      mockUser = { userId: 1, username: 'admin', role: 'admin' };

      mockPrisma.subscription.groupBy.mockResolvedValue([]);
      mockPrisma.cycleMetadata.findFirst.mockResolvedValue({ totalCycles: 60 });
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const res = await request(app).get('/api/subscriptions/admin/analytics?days=7');

      expect(res.status).toBe(200);
      // Verify the audit log query used the correct cycle range
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cycleNumber: { gte: 53 }, // 60 - 7
          }),
        }),
      );
    });

    it('GET /admin/analytics returns 400 for invalid days parameter', async () => {
      mockUser = { userId: 1, username: 'admin', role: 'admin' };

      const res = await request(app).get('/api/subscriptions/admin/analytics?days=0');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('GET /admin/analytics returns 400 for days > 90', async () => {
      mockUser = { userId: 1, username: 'admin', role: 'admin' };

      const res = await request(app).get('/api/subscriptions/admin/analytics?days=91');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
