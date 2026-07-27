/**
 * Tests for leaderboards, admin tournaments, and robots route Zod validation.
 *
 * Validates: Requirements 5.1, 6.1, 7.1
 */

import { z } from 'zod';
import { Request, Response } from 'express';
import { validateRequest } from '../src/middleware/schemaValidator';
import { AppError } from '../src/errors/AppError';

// Recreate leaderboard schemas.
// Spec #46 R5 removed `league` and `minBattles` from fame, and `minRobots`
// from prestige. Zod's default .strip() means a removed parameter supplied by
// an old client or a bookmarked URL is ignored, not rejected.
const fameQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const prestigeQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const createTournamentBodySchema = z.object({
  tournamentType: z.enum(['single_elimination']).optional().default('single_elimination'),
});

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {} as Record<string, string>,
    query: {},
    originalUrl: '/api/test',
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  return {} as Response;
}

describe('Leaderboards route validation', () => {
  describe('fameQuerySchema (GET /fame)', () => {
    it('should accept valid pagination', () => {
      const result = fameQuerySchema.safeParse({ page: '1', limit: '50' });
      expect(result.success).toBe(true);
    });

    it('should reject limit > 100', () => {
      const result = fameQuerySchema.safeParse({ limit: '101' });
      expect(result.success).toBe(false);
    });

    it('should accept empty query', () => {
      const result = fameQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    // Spec #46 R5.16
    it('should ignore a removed league filter rather than rejecting it', () => {
      const result = fameQuerySchema.safeParse({ league: 'bronze', page: '2' });
      expect(result.success).toBe(true);
      expect(result.success && result.data).toEqual({ page: 2 });
    });

    it('should ignore a removed minBattles filter rather than rejecting it', () => {
      const result = fameQuerySchema.safeParse({ minBattles: '50', limit: '10' });
      expect(result.success).toBe(true);
      expect(result.success && result.data).toEqual({ limit: 10 });
    });
  });

  describe('prestigeQuerySchema (GET /prestige)', () => {
    it('should accept valid pagination', () => {
      const result = prestigeQuerySchema.safeParse({ page: '1', limit: '50' });
      expect(result.success).toBe(true);
    });

    // Spec #46 R5.16
    it('should ignore a removed minRobots filter rather than rejecting it', () => {
      const result = prestigeQuerySchema.safeParse({ minRobots: '5', page: '3' });
      expect(result.success).toBe(true);
      expect(result.success && result.data).toEqual({ page: 3 });
    });
  });

  describe('createTournamentBodySchema (POST /create)', () => {
    it('should default to single_elimination', () => {
      const result = createTournamentBodySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.tournamentType).toBe('single_elimination');
    });

    it('should reject invalid tournament type', () => {
      const result = createTournamentBodySchema.safeParse({ tournamentType: 'round_robin' });
      expect(result.success).toBe(false);
    });

    it('should strip unknown fields', () => {
      const middleware = validateRequest({ body: createTournamentBodySchema });
      const req = mockReq({ body: { tournamentType: 'single_elimination', isAdmin: true } });
      const next = jest.fn();
      middleware(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
      expect(req.body.isAdmin).toBeUndefined();
    });
  });
});
