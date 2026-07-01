/**
 * Tests for subscriptions route Zod validation schemas.
 *
 * Validates that subscription endpoints reject invalid input.
 */

import { z } from 'zod';
import { positiveIntParam } from '../src/utils/securityValidation';

// --- Recreate schemas (same as subscriptions.ts) ---

const robotIdParamSchema = z.object({
  robotId: positiveIntParam,
});

const subscribeBodySchema = z.object({
  eventType: z.string().min(1).max(30),
});

const adminAnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional(),
});

// --- Tests ---

describe('Subscriptions route validation schemas', () => {
  describe('robotIdParamSchema', () => {
    it('should accept valid robot ID', () => {
      const result = robotIdParamSchema.safeParse({ robotId: '5' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.robotId).toBe(5);
    });

    it('should reject zero', () => {
      expect(robotIdParamSchema.safeParse({ robotId: '0' }).success).toBe(false);
    });

    it('should reject negative', () => {
      expect(robotIdParamSchema.safeParse({ robotId: '-1' }).success).toBe(false);
    });

    it('should reject non-numeric', () => {
      expect(robotIdParamSchema.safeParse({ robotId: 'abc' }).success).toBe(false);
    });
  });

  describe('subscribeBodySchema', () => {
    it('should accept valid event type', () => {
      const result = subscribeBodySchema.safeParse({ eventType: 'league_1v1' });
      expect(result.success).toBe(true);
    });

    it('should reject empty event type', () => {
      expect(subscribeBodySchema.safeParse({ eventType: '' }).success).toBe(false);
    });

    it('should reject event type over 30 chars', () => {
      expect(subscribeBodySchema.safeParse({ eventType: 'a'.repeat(31) }).success).toBe(false);
    });

    it('should strip unknown fields', () => {
      const result = subscribeBodySchema.safeParse({ eventType: 'koth', extra: 'ignored' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).not.toHaveProperty('extra');
    });
  });

  describe('adminAnalyticsQuerySchema', () => {
    it('should accept valid days parameter', () => {
      const result = adminAnalyticsQuerySchema.safeParse({ days: '30' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.days).toBe(30);
    });

    it('should accept omitted days (optional)', () => {
      const result = adminAnalyticsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject days below 1', () => {
      expect(adminAnalyticsQuerySchema.safeParse({ days: '0' }).success).toBe(false);
    });

    it('should reject days above 90', () => {
      expect(adminAnalyticsQuerySchema.safeParse({ days: '91' }).success).toBe(false);
    });

    it('should reject non-integer days', () => {
      expect(adminAnalyticsQuerySchema.safeParse({ days: '3.5' }).success).toBe(false);
    });
  });
});
