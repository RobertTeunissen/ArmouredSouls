/**
 * Unit tests for achievement API route handlers.
 *
 * Tests the three achievement endpoints:
 * - GET /api/achievements — full achievement catalog with player progress
 * - GET /api/achievements/recent — last N unlocked achievements
 * - PUT /api/achievements/pinned — update pinned achievement IDs
 *
 * Mocks the achievementService, auth middleware, and schema validator
 * to isolate route handler logic from service and middleware internals.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.6, 16.1, 16.2, 16.3, 16.6
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

const mockGetPlayerAchievements = jest.fn();
const mockGetRecentUnlocks = jest.fn();
const mockUpdatePinnedAchievements = jest.fn();

jest.mock('../../services/achievement', () => ({
  achievementService: {
    getPlayerAchievements: (...args: unknown[]) => mockGetPlayerAchievements(...args),
    getRecentUnlocks: (...args: unknown[]) => mockGetRecentUnlocks(...args),
    updatePinnedAchievements: (...args: unknown[]) => mockUpdatePinnedAchievements(...args),
  },
}));

// Mock auth middleware to inject userId
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: Record<string, unknown>, _res: unknown, next: () => void) => {
    req.user = { userId: 1, username: 'test_user', role: 'user' };
    next();
  },
  AuthRequest: {},
}));

// Mock validateRequest to pass through
jest.mock('../../middleware/schemaValidator', () => ({
  validateRequest: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Mock logger to suppress output during tests
jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import request from 'supertest';
import express from 'express';
import achievementsRouter from '../achievements';
import { errorHandler } from '../../middleware/errorHandler';
import { AchievementError, AchievementErrorCode } from '../../errors/achievementErrors';

// ---------------------------------------------------------------------------
// Test app setup
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use('/api/achievements', achievementsRouter);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleAchievementsResponse = {
  achievements: [
    {
      id: 'C1',
      name: "I'll Be Back",
      description: 'Win your first battle',
      category: 'combat',
      tier: 'easy',
      rewardCredits: 25_000,
      rewardPrestige: 25,
      hidden: false,
      unlocked: true,
      unlockedAt: '2026-04-20T12:00:00.000Z',
      robotId: 1,
      robotName: 'Ultron',
      progress: { current: 5, target: 1, label: 'wins' },
      isPinned: false,
    },
  ],
  summary: {
    total: 63,
    unlocked: 12,
    byTier: {
      easy: { total: 20, unlocked: 10 },
      medium: { total: 15, unlocked: 2 },
      hard: { total: 12, unlocked: 0 },
      very_hard: { total: 8, unlocked: 0 },
      secret: { total: 8, unlocked: 0 },
    },
  },
  rarity: {
    counts: { C1: 10, C2: 8 },
    totalActivePlayers: 16,
  },
};

const sampleRecentUnlocks = [
  {
    id: 'C1',
    name: "I'll Be Back",
    description: 'Win your first battle',
    tier: 'easy',
    rewardCredits: 25_000,
    rewardPrestige: 25,
    badgeIconFile: 'achievement-c1',
    robotId: 1,
    robotName: 'Ultron',
  },
  {
    id: 'E1',
    name: 'Hello World',
    description: 'Complete onboarding',
    tier: 'easy',
    rewardCredits: 25_000,
    rewardPrestige: 25,
    badgeIconFile: 'achievement-e1',
    robotId: null,
    robotName: null,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Achievement API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // GET /api/achievements
  // -----------------------------------------------------------------------

  describe('GET /api/achievements', () => {
    it('should return the full achievement catalog with correct response shape', async () => {
      mockGetPlayerAchievements.mockResolvedValue(sampleAchievementsResponse);

      const res = await request(app).get('/api/achievements');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('achievements');
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('rarity');
      expect(Array.isArray(res.body.achievements)).toBe(true);
      expect(res.body.summary).toHaveProperty('total');
      expect(res.body.summary).toHaveProperty('unlocked');
      expect(res.body.summary).toHaveProperty('byTier');
      expect(res.body.rarity).toHaveProperty('counts');
      expect(res.body.rarity).toHaveProperty('totalActivePlayers');
    });

    it('should call getPlayerAchievements with the authenticated userId', async () => {
      mockGetPlayerAchievements.mockResolvedValue(sampleAchievementsResponse);

      await request(app).get('/api/achievements');

      expect(mockGetPlayerAchievements).toHaveBeenCalledWith(1);
    });

    it('should propagate service errors to the error handler', async () => {
      mockGetPlayerAchievements.mockRejectedValue(new Error('Database connection failed'));

      const res = await request(app).get('/api/achievements');

      expect(res.status).toBe(500);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/achievements/recent
  // -----------------------------------------------------------------------

  describe('GET /api/achievements/recent', () => {
    it('should return an array of recent unlocks', async () => {
      mockGetRecentUnlocks.mockResolvedValue(sampleRecentUnlocks);

      const res = await request(app).get('/api/achievements/recent');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('tier');
    });

    it('should use the limit query param when provided', async () => {
      mockGetRecentUnlocks.mockResolvedValue([sampleRecentUnlocks[0]]);

      const res = await request(app).get('/api/achievements/recent?limit=5');

      expect(res.status).toBe(200);
      // The route handler reads limit from query and passes it to the service.
      // Since validateRequest is mocked to pass through, the raw query value
      // is coerced via Number() in the route handler.
      expect(mockGetRecentUnlocks).toHaveBeenCalledWith(1, expect.any(Number), undefined);
    });

    it('should default to 10 when no limit is provided', async () => {
      mockGetRecentUnlocks.mockResolvedValue(sampleRecentUnlocks);

      await request(app).get('/api/achievements/recent');

      expect(mockGetRecentUnlocks).toHaveBeenCalledWith(1, 10, undefined);
    });

    it('should propagate service errors to the error handler', async () => {
      mockGetRecentUnlocks.mockRejectedValue(new Error('Unexpected error'));

      const res = await request(app).get('/api/achievements/recent');

      expect(res.status).toBe(500);
    });
  });

  // -----------------------------------------------------------------------
  // PUT /api/achievements/pinned
  // -----------------------------------------------------------------------

  describe('PUT /api/achievements/pinned', () => {
    it('should accept valid input and return success', async () => {
      mockUpdatePinnedAchievements.mockResolvedValue(undefined);

      const res = await request(app)
        .put('/api/achievements/pinned')
        .send({ achievementIds: ['C1', 'C2', 'E1'] });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    it('should call the service with the correct userId and achievementIds', async () => {
      mockUpdatePinnedAchievements.mockResolvedValue(undefined);

      await request(app)
        .put('/api/achievements/pinned')
        .send({ achievementIds: ['C1', 'L5'] });

      expect(mockUpdatePinnedAchievements).toHaveBeenCalledWith(1, ['C1', 'L5']);
    });

    it('should return 400 when service throws AchievementError for invalid pin', async () => {
      mockUpdatePinnedAchievements.mockRejectedValue(
        new AchievementError(
          AchievementErrorCode.INVALID_ACHIEVEMENT_ID,
          'Achievement ID "INVALID" does not exist',
          400,
          { achievementId: 'INVALID' },
        ),
      );

      const res = await request(app)
        .put('/api/achievements/pinned')
        .send({ achievementIds: ['INVALID'] });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ACHIEVEMENT_INVALID_ID');
      expect(res.body.error).toBe('Achievement ID "INVALID" does not exist');
    });

    it('should return 400 when service throws AchievementError for locked achievement', async () => {
      mockUpdatePinnedAchievements.mockRejectedValue(
        new AchievementError(
          AchievementErrorCode.ACHIEVEMENT_NOT_UNLOCKED,
          'Achievement "C5" is not unlocked',
          400,
          { achievementId: 'C5' },
        ),
      );

      const res = await request(app)
        .put('/api/achievements/pinned')
        .send({ achievementIds: ['C5'] });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ACHIEVEMENT_NOT_UNLOCKED');
    });

    it('should return 400 when service throws AchievementError for too many pins', async () => {
      mockUpdatePinnedAchievements.mockRejectedValue(
        new AchievementError(
          AchievementErrorCode.TOO_MANY_PINNED,
          'Cannot pin more than 6 achievements',
          400,
          { count: 7, max: 6 },
        ),
      );

      const res = await request(app)
        .put('/api/achievements/pinned')
        .send({ achievementIds: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'] });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ACHIEVEMENT_TOO_MANY_PINNED');
    });

    it('should propagate unexpected service errors as 500', async () => {
      mockUpdatePinnedAchievements.mockRejectedValue(new Error('Database failure'));

      const res = await request(app)
        .put('/api/achievements/pinned')
        .send({ achievementIds: ['C1'] });

      expect(res.status).toBe(500);
    });
  });
});
