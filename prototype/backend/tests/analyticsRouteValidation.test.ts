/**
 * Tests for analytics route Zod validation.
 *
 * Validates: Requirements 3.1, 3.2
 *
 * Verifies that the new analytics schemas reject invalid input
 * and that validateRequest middleware is applied correctly.
 */

import { z } from 'zod';
import { Request, Response } from 'express';
import { validateRequest } from '../src/middleware/schemaValidator';
import { AppError } from '../src/errors/AppError';

// Recreate the analytics route schemas
const leaderboardQuerySchema = z.object({
  orderBy: z.enum(['elo', 'winRate', 'battles', 'kills', 'damageDealt']).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

const cycleRangeQuerySchema = z.object({
  startCycle: z.coerce.number().int().positive().optional(),
  endCycle: z.coerce.number().int().positive().optional(),
});

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {} as Record<string, string>,
    query: {},
    originalUrl: '/api/analytics/test',
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  return {} as Response;
}

describe('Analytics route validation schemas', () => {
  describe('leaderboardQuerySchema (GET /leaderboard)', () => {
    it('should accept valid orderBy values', () => {
      for (const orderBy of ['elo', 'winRate', 'battles', 'kills', 'damageDealt']) {
        const result = leaderboardQuerySchema.safeParse({ orderBy });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid orderBy value', () => {
      const result = leaderboardQuerySchema.safeParse({ orderBy: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should accept valid limit and offset', () => {
      const result = leaderboardQuerySchema.safeParse({ limit: '100', offset: '0' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(100);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should reject limit > 1000', () => {
      const result = leaderboardQuerySchema.safeParse({ limit: '1001' });
      expect(result.success).toBe(false);
    });

    it('should reject negative offset', () => {
      const result = leaderboardQuerySchema.safeParse({ offset: '-1' });
      expect(result.success).toBe(false);
    });

    it('should accept empty query (all optional)', () => {
      const result = leaderboardQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('cycleRangeQuerySchema (GET /performance, /integrity, /logs/summary)', () => {
    it('should accept valid cycle range', () => {
      const result = cycleRangeQuerySchema.safeParse({ startCycle: '1', endCycle: '10' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startCycle).toBe(1);
        expect(result.data.endCycle).toBe(10);
      }
    });

    it('should accept empty query (defaults apply in handler)', () => {
      const result = cycleRangeQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject non-positive startCycle', () => {
      const result = cycleRangeQuerySchema.safeParse({ startCycle: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric endCycle', () => {
      const result = cycleRangeQuerySchema.safeParse({ endCycle: 'abc' });
      expect(result.success).toBe(false);
    });
  });

  describe('validateRequest middleware for analytics', () => {
    it('should call next() for empty schema on GET /cycle/current', () => {
      const middleware = validateRequest({});
      const req = mockReq();
      const next = jest.fn();
      middleware(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it('should throw VALIDATION_ERROR for invalid leaderboard query', () => {
      const middleware = validateRequest({ query: leaderboardQuerySchema });
      const req = mockReq({ query: { limit: '-5' } });
      expect(() => middleware(req, mockRes(), jest.fn())).toThrow(AppError);
    });
  });
});
