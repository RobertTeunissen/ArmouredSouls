/**
 * Tests for onboarding route Zod validation.
 *
 * Validates: Requirements 4.1, 4.2
 *
 * Verifies that onboarding body schemas reject invalid input
 * and that validateRequest middleware strips unknown fields.
 */

import { z } from 'zod';
import { Request, Response } from 'express';
import { validateRequest } from '../src/middleware/schemaValidator';
import { AppError } from '../src/errors/AppError';

// Recreate the onboarding route schemas
const updateStateBodySchema = z.object({
  step: z.number().int().min(1).max(9).optional(),
  strategy: z.enum(['1_mighty', '2_average', '3_flimsy']).optional(),
  choices: z.record(z.string(), z.unknown()).optional(),
});

const resetAccountBodySchema = z.object({
  confirmation: z.string().min(1).max(20),
  reason: z.string().max(500).optional(),
});

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {} as Record<string, string>,
    query: {},
    originalUrl: '/api/onboarding/test',
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  return {} as Response;
}

describe('Onboarding route validation schemas', () => {
  describe('updateStateBodySchema (POST /state)', () => {
    it('should accept valid step number', () => {
      const result = updateStateBodySchema.safeParse({ step: 3 });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.step).toBe(3);
    });

    it('should reject step < 1', () => {
      const result = updateStateBodySchema.safeParse({ step: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject step > 9', () => {
      const result = updateStateBodySchema.safeParse({ step: 10 });
      expect(result.success).toBe(false);
    });

    it('should accept valid strategy', () => {
      for (const strategy of ['1_mighty', '2_average', '3_flimsy']) {
        const result = updateStateBodySchema.safeParse({ strategy });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid strategy', () => {
      const result = updateStateBodySchema.safeParse({ strategy: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should accept empty body (all optional)', () => {
      const result = updateStateBodySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept choices object', () => {
      const result = updateStateBodySchema.safeParse({
        choices: { robotName: 'TestBot', strategy: 'aggressive' },
      });
      expect(result.success).toBe(true);
    });

    it('should strip unknown fields from body', () => {
      const middleware = validateRequest({ body: updateStateBodySchema });
      const req = mockReq({
        body: { step: 2, strategy: '2_average', isAdmin: true, role: 'superuser' },
      });
      const next = jest.fn();
      middleware(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
      expect(req.body.isAdmin).toBeUndefined();
      expect(req.body.role).toBeUndefined();
    });
  });

  describe('resetAccountBodySchema (POST /reset-account)', () => {
    it('should accept valid confirmation', () => {
      const result = resetAccountBodySchema.safeParse({ confirmation: 'RESET' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.confirmation).toBe('RESET');
    });

    it('should accept confirmation with optional reason', () => {
      const result = resetAccountBodySchema.safeParse({
        confirmation: 'RESET',
        reason: 'Made poor initial choices',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty confirmation', () => {
      const result = resetAccountBodySchema.safeParse({ confirmation: '' });
      expect(result.success).toBe(false);
    });

    it('should reject missing confirmation', () => {
      const result = resetAccountBodySchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject reason > 500 chars', () => {
      const result = resetAccountBodySchema.safeParse({
        confirmation: 'RESET',
        reason: 'x'.repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it('should strip unknown fields from body', () => {
      const middleware = validateRequest({ body: resetAccountBodySchema });
      const req = mockReq({
        body: { confirmation: 'RESET', currency: 999999, role: 'admin' },
      });
      const next = jest.fn();
      middleware(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
      expect(req.body.currency).toBeUndefined();
      expect(req.body.role).toBeUndefined();
    });
  });

  describe('Empty schema validation for GET endpoints', () => {
    it('should call next() for validateRequest({}) on GET /state', () => {
      const middleware = validateRequest({});
      const req = mockReq();
      const next = jest.fn();
      middleware(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
    });
  });
});
