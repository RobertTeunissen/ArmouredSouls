/**
 * Unit tests for the Practice Arena route
 *
 * Tests validation, ownership, cycle guard, batch handling,
 * sparring-partners endpoint, and rate limiting.
 *
 * Requirements: 8.6, 8.7, 9.1, 9.2, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

const mockExecutePracticeBattle = jest.fn();
const mockExecutePracticeBatch = jest.fn();
const mockGetSparringPartnerDefinitions = jest.fn();

jest.mock('../../src/services/practice-arena', () => ({
  executePracticeBattle: mockExecutePracticeBattle,
  executePracticeBatch: mockExecutePracticeBatch,
  getSparringPartnerDefinitions: mockGetSparringPartnerDefinitions,
  practiceArenaMetrics: {
    recordRateLimitHit: jest.fn(),
  },
}));

const mockGetSchedulerState = jest.fn();
jest.mock('../../src/services/cycle/cycleScheduler', () => ({
  getSchedulerState: mockGetSchedulerState,
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

jest.mock('../../src/config/env', () => ({
  getConfig: () => ({ jwtSecret: 'test-secret-key-for-jwt-signing-1234567890' }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import practiceArenaRouter from '../../src/routes/practiceArena';
import { errorHandler } from '../../src/middleware/errorHandler';

// ---------------------------------------------------------------------------
// Test App Setup
// ---------------------------------------------------------------------------

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/practice-arena', practiceArenaRouter);
  app.use(errorHandler);
  return app;
}

/** Generate a valid JWT for the test user */
function authToken(userId = 1, role = 'user'): string {
  return jwt.sign(
    { userId, username: 'testuser', role, tokenVersion: 0 },
    'test-secret-key-for-jwt-signing-1234567890',
  );
}

/** Valid sparring-vs-sparring battle body */
function validBattleBody() {
  return {
    robot1: {
      type: 'sparring',
      config: {
        botTier: 'WimpBot',
        loadoutType: 'single',
        rangeBand: 'melee',
        stance: 'balanced',
        yieldThreshold: 20,
      },
    },
    robot2: {
      type: 'sparring',
      config: {
        botTier: 'ExpertBot',
        loadoutType: 'weapon_shield',
        rangeBand: 'mid',
        stance: 'defensive',
        yieldThreshold: 30,
      },
    },
  };
}

/** Mock combat result for successful battles */
function mockBattleResult() {
  return {
    combatResult: {
      winnerId: -1,
      robot1FinalHP: 80,
      robot2FinalHP: 0,
      durationSeconds: 30,
      isDraw: false,
      robot1DamageDealt: 100,
      robot2DamageDealt: 20,
      events: [],
    },
    battleLog: [],
    robot1Info: { name: 'WimpBot', maxHP: 50, maxShield: 10 },
    robot2Info: { name: 'ExpertBot', maxHP: 300, maxShield: 200 },
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Practice Arena Route', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no cycle running, user exists with matching tokenVersion
    mockGetSchedulerState.mockReturnValue({ runningJob: null, active: true, queue: [], jobs: [] });
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 0, stableName: 'Test Stable' });
    app = createTestApp();
  });

  // =========================================================================
  // POST /battle — Validation (400)
  // =========================================================================
  describe('POST /battle — validation', () => {
    it('should return 400 for missing robot configs', async () => {
      const res = await request(app)
        .post('/api/practice-arena/battle')
        .set('Authorization', `Bearer ${authToken()}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid attribute range (outside 1-50)', async () => {
      const res = await request(app)
        .post('/api/practice-arena/battle')
        .set('Authorization', `Bearer ${authToken()}`)
        .send({
          robot1: {
            type: 'owned',
            robotId: 1,
            overrides: { attributes: { combatPower: 99 } }, // exceeds max 50
          },
          robot2: validBattleBody().robot2,
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid botTier', async () => {
      const res = await request(app)
        .post('/api/practice-arena/battle')
        .set('Authorization', `Bearer ${authToken()}`)
        .send({
          robot1: {
            type: 'sparring',
            config: {
              botTier: 'SuperBot', // invalid tier
              loadoutType: 'single',
              rangeBand: 'melee',
              stance: 'balanced',
              yieldThreshold: 20,
            },
          },
          robot2: validBattleBody().robot2,
        });

      expect(res.status).toBe(400);
    });

    it('should strip arbitrary unknown fields via Zod', async () => {
      mockExecutePracticeBattle.mockResolvedValue(mockBattleResult());

      const body = {
        ...validBattleBody(),
        hackerField: 'malicious',
        count: 1,
      };

      const res = await request(app)
        .post('/api/practice-arena/battle')
        .set('Authorization', `Bearer ${authToken()}`)
        .send(body);

      // Should succeed (unknown fields stripped, not rejected)
      expect(res.status).toBe(200);
      expect(mockExecutePracticeBattle).toHaveBeenCalled();
    });

    it('should return 400 for attribute value below minimum (0)', async () => {
      const res = await request(app)
        .post('/api/practice-arena/battle')
        .set('Authorization', `Bearer ${authToken()}`)
        .send({
          robot1: {
            type: 'owned',
            robotId: 1,
            overrides: { attributes: { armorPlating: 0 } }, // below min 1
          },
          robot2: validBattleBody().robot2,
        });

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // POST /battle — Ownership (403)
  // =========================================================================
  describe('POST /battle — ownership', () => {
    it('should return 403 when robot is not owned by the authenticated user', async () => {
      const { AppError } = require('../../src/errors');
      mockExecutePracticeBattle.mockRejectedValue(
        new AppError('FORBIDDEN', 'Access denied', 403),
      );

      const res = await request(app)
        .post('/api/practice-arena/battle')
        .set('Authorization', `Bearer ${authToken()}`)
        .send({
          robot1: { type: 'owned', robotId: 999 },
          robot2: validBattleBody().robot2,
        });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // POST /battle — Cycle guard (503)
  // =========================================================================
  describe('POST /battle — cycle guard', () => {
    it('should return 503 when a cycle job is running', async () => {
      mockGetSchedulerState.mockReturnValue({
        runningJob: 'league',
        active: true,
        queue: [],
        jobs: [],
      });

      const res = await request(app)
        .post('/api/practice-arena/battle')
        .set('Authorization', `Bearer ${authToken()}`)
        .send(validBattleBody());

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('CYCLE_IN_PROGRESS');
      expect(res.body.runningJob).toBe('league');
    });
  });

  // =========================================================================
  // POST /battle — Batch (count > 1)
  // =========================================================================
  describe('POST /battle — batch', () => {
    it('should return PracticeBatchResult with 5 individual results when count is 5', async () => {
      const batchResult = {
        results: Array.from({ length: 5 }, () => mockBattleResult()),
        aggregate: {
          totalBattles: 5,
          robot1Wins: 3,
          robot2Wins: 1,
          draws: 1,
          avgDurationSeconds: 35,
          avgRobot1DamageDealt: 90,
          avgRobot2DamageDealt: 40,
        },
      };
      mockExecutePracticeBatch.mockResolvedValue(batchResult);

      const res = await request(app)
        .post('/api/practice-arena/battle')
        .set('Authorization', `Bearer ${authToken()}`)
        .send({ ...validBattleBody(), count: 5 });

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(5);
      expect(res.body.aggregate.totalBattles).toBe(5);
      expect(mockExecutePracticeBatch).toHaveBeenCalledWith(1, expect.any(Object), 5);
    });

    it('should return 400 when count exceeds max batch size of 10', async () => {
      const res = await request(app)
        .post('/api/practice-arena/battle')
        .set('Authorization', `Bearer ${authToken()}`)
        .send({ ...validBattleBody(), count: 11 });

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // GET /sparring-partners
  // =========================================================================
  describe('GET /sparring-partners', () => {
    it('should return 4 definitions with expected structure', async () => {
      const definitions = [
        {
          botTier: 'WimpBot',
          description: 'Weak opponent with level 1 attributes',
          attributeLevel: 1,
          priceTier: { min: 0, max: 99999 },
          loadoutOptions: ['single', 'weapon_shield', 'two_handed', 'dual_wield'],
          rangeBandOptions: ['melee', 'short', 'mid', 'long'],
          stanceOptions: ['offensive', 'defensive', 'balanced'],
        },
        {
          botTier: 'AverageBot',
          description: 'Standard opponent with level 5 attributes',
          attributeLevel: 5,
          priceTier: { min: 100000, max: 250000 },
          loadoutOptions: ['single', 'weapon_shield', 'two_handed', 'dual_wield'],
          rangeBandOptions: ['melee', 'short', 'mid', 'long'],
          stanceOptions: ['offensive', 'defensive', 'balanced'],
        },
        {
          botTier: 'ExpertBot',
          description: 'Tough opponent with level 10 attributes',
          attributeLevel: 10,
          priceTier: { min: 250000, max: 400000 },
          loadoutOptions: ['single', 'weapon_shield', 'two_handed', 'dual_wield'],
          rangeBandOptions: ['melee', 'short', 'mid', 'long'],
          stanceOptions: ['offensive', 'defensive', 'balanced'],
        },
        {
          botTier: 'UltimateBot',
          description: 'Elite opponent with level 15 attributes',
          attributeLevel: 15,
          priceTier: { min: 400000, max: Infinity },
          loadoutOptions: ['single', 'weapon_shield', 'two_handed', 'dual_wield'],
          rangeBandOptions: ['melee', 'short', 'mid', 'long'],
          stanceOptions: ['offensive', 'defensive', 'balanced'],
        },
      ];
      mockGetSparringPartnerDefinitions.mockReturnValue(definitions);

      const res = await request(app)
        .get('/api/practice-arena/sparring-partners')
        .set('Authorization', `Bearer ${authToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.sparringPartners).toHaveLength(4);

      const tiers = res.body.sparringPartners.map((d: { botTier: string }) => d.botTier);
      expect(tiers).toEqual(['WimpBot', 'AverageBot', 'ExpertBot', 'UltimateBot']);

      for (const def of res.body.sparringPartners) {
        expect(def).toHaveProperty('botTier');
        expect(def).toHaveProperty('description');
        expect(def).toHaveProperty('attributeLevel');
        expect(def).toHaveProperty('priceTier');
        expect(def).toHaveProperty('loadoutOptions');
        expect(def).toHaveProperty('rangeBandOptions');
        expect(def).toHaveProperty('stanceOptions');
      }
    });
  });

  // =========================================================================
  // Rate limiter (429)
  // =========================================================================
  describe('Rate limiter', () => {
    it('should return 429 after 30 requests with retryAfter info', async () => {
      mockExecutePracticeBattle.mockResolvedValue(mockBattleResult());

      // Create a fresh app for rate limit testing
      const rateLimitApp = createTestApp();
      const token = authToken();
      const body = validBattleBody();

      // Send 30 requests (should all succeed)
      for (let i = 0; i < 30; i++) {
        await request(rateLimitApp)
          .post('/api/practice-arena/battle')
          .set('Authorization', `Bearer ${token}`)
          .send(body);
      }

      // 31st request should be rate limited
      const res = await request(rateLimitApp)
        .post('/api/practice-arena/battle')
        .set('Authorization', `Bearer ${token}`)
        .send(body);

      expect(res.status).toBe(429);
      expect(res.body).toHaveProperty('retryAfter');
      expect(res.body.code).toBe('RATE_LIMIT_EXCEEDED');
    }, 30000);
  });
});
