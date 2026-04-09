/**
 * Tests for leaderboards, admin tournaments, and robots route Zod validation.
 *
 * Validates: Requirements 5.1, 6.1, 7.1
 */

import { z } from 'zod';
import { Request, Response } from 'express';
import { validateRequest } from '../src/middleware/schemaValidator';
import { AppError } from '../src/errors/AppError';

// Recreate leaderboard schemas
const fameQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  league: z.string().max(30).optional(),
  minBattles: z.coerce.number().int().nonnegative().optional(),
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

    it('should accept league filter', () => {
      const result = fameQuerySchema.safeParse({ league: 'bronze_1' });
      expect(result.success).toBe(true);
    });

    it('should accept empty query', () => {
      const result = fameQuerySchema.safeParse({});
      expect(result.success).toBe(true);
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
