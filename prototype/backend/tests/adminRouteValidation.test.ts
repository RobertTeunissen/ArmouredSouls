/**
 * Tests for admin route Zod validation schemas.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 *
 * Tests the schemas and validateRequest middleware directly to verify
 * that admin endpoints reject invalid input (malformed IDs, invalid
 * pagination, unexpected body fields).
 */

import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { validateRequest } from '../src/middleware/schemaValidator';
import { AppError } from '../src/errors/AppError';
import { paginationQuery, positiveIntParam } from '../src/utils/securityValidation';

// --- Recreate the admin route schemas (same definitions as admin.ts) ---

const battleIdParamsSchema = z.object({
  id: positiveIntParam,
});

const scheduledForBodySchema = z.object({
  scheduledFor: z.string().optional(),
});

const repairAllBodySchema = z.object({
  deductCosts: z.boolean().optional().default(false),
});

const bulkCyclesBodySchema = z.object({
  cycles: z.number().int().positive().max(100).optional().default(1),
  generateUsersPerCycle: z.boolean().optional().default(false),
  includeTournaments: z.boolean().optional().default(true),
  includeKoth: z.boolean().optional().default(true),
});

const battlesQuerySchema = paginationQuery.extend({
  leagueType: z.string().optional(),
  battleType: z.string().optional(),
});

const recentUsersQuerySchema = z.object({
  cycles: z.coerce.number().int().positive().max(200).optional().default(10),
});

const repairAuditQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  repairType: z.enum(['manual', 'automatic']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const securityEventsQuerySchema = z.object({
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  eventType: z.string().optional(),
  userId: z.coerce.number().int().positive().optional(),
  since: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

// --- Test helpers ---

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {} as Record<string, string>,
    query: {},
    originalUrl: '/api/admin/test',
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  return {} as Response;
}

function expectValidationError(fn: () => void): AppError {
  try {
    fn();
    throw new Error('Expected AppError to be thrown');
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    const appErr = err as AppError;
    expect(appErr.code).toBe('VALIDATION_ERROR');
    expect(appErr.statusCode).toBe(400);
    return appErr;
  }
}

describe('Admin route validation schemas', () => {
  describe('battleIdParamsSchema (GET /battles/:id)', () => {
    it('should accept valid numeric ID string', () => {
      const result = battleIdParamsSchema.safeParse({ id: '42' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.id).toBe(42);
    });

    it('should reject non-numeric ID', () => {
      const result = battleIdParamsSchema.safeParse({ id: 'abc' });
      expect(result.success).toBe(false);
    });

    it('should reject negative ID', () => {
      const result = battleIdParamsSchema.safeParse({ id: '-1' });
      expect(result.success).toBe(false);
    });

    it('should reject zero ID', () => {
      const result = battleIdParamsSchema.safeParse({ id: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject float ID', () => {
      const result = battleIdParamsSchema.safeParse({ id: '3.14' });
      expect(result.success).toBe(false);
    });
  });

  describe('scheduledForBodySchema (POST /matchmaking/run, /battles/run, /tag-teams/*)', () => {
    it('should accept empty body', () => {
      const result = scheduledForBodySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept valid scheduledFor string', () => {
      const result = scheduledForBodySchema.safeParse({ scheduledFor: '2025-01-01T00:00:00Z' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.scheduledFor).toBe('2025-01-01T00:00:00Z');
    });

    it('should strip unknown fields from body', () => {
      const middleware = validateRequest({ body: scheduledForBodySchema });
      const req = mockReq({ body: { scheduledFor: '2025-01-01', isAdmin: true, role: 'superuser' } });
      const next = jest.fn();
      middleware(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
      expect(req.body).toEqual({ scheduledFor: '2025-01-01' });
      expect(req.body.isAdmin).toBeUndefined();
      expect(req.body.role).toBeUndefined();
    });
  });

  describe('repairAllBodySchema (POST /repair/all)', () => {
    it('should default deductCosts to false', () => {
      const result = repairAllBodySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.deductCosts).toBe(false);
    });

    it('should accept deductCosts as true', () => {
      const result = repairAllBodySchema.safeParse({ deductCosts: true });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.deductCosts).toBe(true);
    });

    it('should reject non-boolean deductCosts', () => {
      const result = repairAllBodySchema.safeParse({ deductCosts: 'yes' });
      expect(result.success).toBe(false);
    });

    it('should strip unexpected fields', () => {
      const middleware = validateRequest({ body: repairAllBodySchema });
      const req = mockReq({ body: { deductCosts: true, currency: 99999 } });
      const next = jest.fn();
      middleware(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
      expect(req.body.currency).toBeUndefined();
    });
  });

  describe('bulkCyclesBodySchema (POST /cycles/bulk)', () => {
    it('should accept valid cycles count', () => {
      const result = bulkCyclesBodySchema.safeParse({ cycles: 5 });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.cycles).toBe(5);
    });

    it('should default cycles to 1', () => {
      const result = bulkCyclesBodySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.cycles).toBe(1);
    });

    it('should reject cycles > 100', () => {
      const result = bulkCyclesBodySchema.safeParse({ cycles: 101 });
      expect(result.success).toBe(false);
    });

    it('should reject negative cycles', () => {
      const result = bulkCyclesBodySchema.safeParse({ cycles: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer cycles', () => {
      const result = bulkCyclesBodySchema.safeParse({ cycles: 2.5 });
      expect(result.success).toBe(false);
    });

    it('should accept boolean options', () => {
      const result = bulkCyclesBodySchema.safeParse({
        cycles: 3,
        generateUsersPerCycle: true,
        includeTournaments: false,
        includeKoth: false,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.generateUsersPerCycle).toBe(true);
        expect(result.data.includeTournaments).toBe(false);
        expect(result.data.includeKoth).toBe(false);
      }
    });

    it('should strip unexpected fields from body', () => {
      const middleware = validateRequest({ body: bulkCyclesBodySchema });
      const req = mockReq({ body: { cycles: 2, malicious: 'payload' } });
      const next = jest.fn();
      middleware(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
      expect(req.body.malicious).toBeUndefined();
    });
  });

  describe('battlesQuerySchema (GET /battles)', () => {
    it('should accept valid pagination with filters', () => {
      const result = battlesQuerySchema.safeParse({
        page: '2',
        limit: '50',
        search: 'robot',
        leagueType: 'bronze',
        battleType: 'league',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(50);
        expect(result.data.search).toBe('robot');
        expect(result.data.leagueType).toBe('bronze');
        expect(result.data.battleType).toBe('league');
      }
    });

    it('should default page and limit', () => {
      const result = battlesQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should reject limit > 100', () => {
      const result = battlesQuerySchema.safeParse({ limit: '101' });
      expect(result.success).toBe(false);
    });

    it('should reject page = 0', () => {
      const result = battlesQuerySchema.safeParse({ page: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric page', () => {
      const result = battlesQuerySchema.safeParse({ page: 'abc' });
      expect(result.success).toBe(false);
    });
  });

  describe('recentUsersQuerySchema (GET /users/recent)', () => {
    it('should default cycles to 10', () => {
      const result = recentUsersQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.cycles).toBe(10);
    });

    it('should accept valid cycles value', () => {
      const result = recentUsersQuerySchema.safeParse({ cycles: '50' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.cycles).toBe(50);
    });

    it('should reject cycles > 200', () => {
      const result = recentUsersQuerySchema.safeParse({ cycles: '201' });
      expect(result.success).toBe(false);
    });

    it('should reject cycles = 0', () => {
      const result = recentUsersQuerySchema.safeParse({ cycles: '0' });
      expect(result.success).toBe(false);
    });
  });

  describe('repairAuditQuerySchema (GET /audit-log/repairs)', () => {
    it('should accept valid pagination and filters', () => {
      const result = repairAuditQuerySchema.safeParse({
        page: '1',
        limit: '25',
        repairType: 'manual',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.repairType).toBe('manual');
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(25);
      }
    });

    it('should reject invalid repairType', () => {
      const result = repairAuditQuerySchema.safeParse({ repairType: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should accept repairType = automatic', () => {
      const result = repairAuditQuerySchema.safeParse({ repairType: 'automatic' });
      expect(result.success).toBe(true);
    });

    it('should default page to 1 and limit to 25', () => {
      const result = repairAuditQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(25);
      }
    });

    it('should reject limit > 100', () => {
      const result = repairAuditQuerySchema.safeParse({ limit: '101' });
      expect(result.success).toBe(false);
    });
  });

  describe('securityEventsQuerySchema (GET /security/events)', () => {
    it('should accept valid filters', () => {
      const result = securityEventsQuerySchema.safeParse({
        severity: 'critical',
        eventType: 'login_failure',
        userId: '42',
        since: '2025-01-01T00:00:00Z',
        limit: '100',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.severity).toBe('critical');
        expect(result.data.userId).toBe(42);
        expect(result.data.limit).toBe(100);
      }
    });

    it('should reject invalid severity', () => {
      const result = securityEventsQuerySchema.safeParse({ severity: 'extreme' });
      expect(result.success).toBe(false);
    });

    it('should default limit to 50', () => {
      const result = securityEventsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.limit).toBe(50);
    });

    it('should reject limit > 200', () => {
      const result = securityEventsQuerySchema.safeParse({ limit: '201' });
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric userId', () => {
      const result = securityEventsQuerySchema.safeParse({ userId: 'abc' });
      expect(result.success).toBe(false);
    });
  });

  describe('Empty schema validation (no-input endpoints)', () => {
    it('should call next() for empty body with validateRequest({})', () => {
      const middleware = validateRequest({});
      const req = mockReq();
      const next = jest.fn();
      middleware(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Mass assignment prevention via validateRequest', () => {
    it('should strip unknown fields from scheduledFor body', () => {
      const middleware = validateRequest({ body: scheduledForBodySchema });
      const req = mockReq({
        body: { scheduledFor: '2025-01-01', isAdmin: true, role: 'superuser', currency: 999999 },
      });
      const next = jest.fn();
      middleware(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
      expect(Object.keys(req.body)).toEqual(['scheduledFor']);
    });

    it('should strip unknown fields from bulkCycles body', () => {
      const middleware = validateRequest({ body: bulkCyclesBodySchema });
      const req = mockReq({
        body: { cycles: 2, dangerousField: 'DROP TABLE users' },
      });
      const next = jest.fn();
      middleware(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
      expect(req.body.dangerousField).toBeUndefined();
    });
  });

  describe('validateRequest middleware rejects invalid input with structured errors', () => {
    it('should throw VALIDATION_ERROR for invalid battle ID params', () => {
      const middleware = validateRequest({ params: battleIdParamsSchema });
      const req = mockReq({ params: { id: 'not-a-number' } as Record<string, string> });
      expectValidationError(() => middleware(req, mockRes(), jest.fn()));
    });

    it('should throw VALIDATION_ERROR for invalid pagination query', () => {
      const middleware = validateRequest({ query: battlesQuerySchema });
      const req = mockReq({ query: { page: 'abc', limit: '-5' } });
      expectValidationError(() => middleware(req, mockRes(), jest.fn()));
    });

    it('should throw VALIDATION_ERROR for invalid bulk cycles body', () => {
      const middleware = validateRequest({ body: bulkCyclesBodySchema });
      const req = mockReq({ body: { cycles: -10 } });
      expectValidationError(() => middleware(req, mockRes(), jest.fn()));
    });

    it('should include fields array in error details', () => {
      const middleware = validateRequest({ body: bulkCyclesBodySchema });
      const req = mockReq({ body: { cycles: 'not-a-number' } });
      const err = expectValidationError(() => middleware(req, mockRes(), jest.fn()));
      const details = err.details as { fields: Array<{ field: string; message: string }> };
      expect(Array.isArray(details.fields)).toBe(true);
      expect(details.fields.length).toBeGreaterThan(0);
      expect(details.fields[0]).toHaveProperty('field');
      expect(details.fields[0]).toHaveProperty('message');
    });
  });
});
