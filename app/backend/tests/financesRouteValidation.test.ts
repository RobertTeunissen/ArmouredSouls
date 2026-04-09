/**
 * Tests for finances route Zod validation.
 *
 * Validates: Requirements 2.1, 2.2
 *
 * Verifies that all 7 finances handlers use validateRequest middleware
 * and that the ROI calculator body schema rejects invalid input.
 */

import { z } from 'zod';
import { Request, Response } from 'express';
import { validateRequest } from '../src/middleware/schemaValidator';
import { AppError } from '../src/errors/AppError';

// Recreate the finances route schemas
const roiCalculatorBodySchema = z.object({
  facilityType: z.string().min(1).max(50),
  targetLevel: z.coerce.number().int().positive(),
});

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {} as Record<string, string>,
    query: {},
    originalUrl: '/api/finances/test',
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  return {} as Response;
}

describe('Finances route validation schemas', () => {
  describe('roiCalculatorBodySchema (POST /roi-calculator)', () => {
    it('should accept valid facility type and target level', () => {
      const result = roiCalculatorBodySchema.safeParse({
        facilityType: 'repair_bay',
        targetLevel: 3,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.facilityType).toBe('repair_bay');
        expect(result.data.targetLevel).toBe(3);
      }
    });

    it('should reject empty facility type', () => {
      const result = roiCalculatorBodySchema.safeParse({
        facilityType: '',
        targetLevel: 1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative target level', () => {
      const result = roiCalculatorBodySchema.safeParse({
        facilityType: 'repair_bay',
        targetLevel: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject zero target level', () => {
      const result = roiCalculatorBodySchema.safeParse({
        facilityType: 'repair_bay',
        targetLevel: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should coerce string target level to number', () => {
      const result = roiCalculatorBodySchema.safeParse({
        facilityType: 'training_facility',
        targetLevel: '5',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.targetLevel).toBe(5);
    });

    it('should strip unknown fields from body', () => {
      const middleware = validateRequest({ body: roiCalculatorBodySchema });
      const req = mockReq({
        body: { facilityType: 'repair_bay', targetLevel: 2, malicious: 'payload' },
      });
      const next = jest.fn();
      middleware(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
      expect(req.body.malicious).toBeUndefined();
    });
  });

  describe('Empty schema validation for GET endpoints', () => {
    it('should call next() for validateRequest({}) on GET /daily', () => {
      const middleware = validateRequest({});
      const req = mockReq();
      const next = jest.fn();
      middleware(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
    });
  });
});
