/**
 * Tests for subscriptions route Zod validation schemas.
 *
 * Imports the real schemas rather than re-declaring them. The previous version of
 * this file carried its own copy and went on asserting `z.string().max(30)` long
 * after the route had moved to a registry-backed enum — a green test proving
 * nothing about the running code.
 */

import {
  robotIdParamSchema,
  subscribeBodySchema,
  setSubscriptionsBodySchema,
  adminAnalyticsQuerySchema,
} from '../src/routes/schemas/subscriptionSchemas';
import { SUBSCRIBABLE_EVENT_TYPES } from '../src/services/subscription/eventRegistry';

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
    it.each(SUBSCRIBABLE_EVENT_TYPES)('should accept the registered event %s', (eventType) => {
      expect(subscribeBodySchema.safeParse({ eventType }).success).toBe(true);
    });

    it('should reject an event type that is not in the registry', () => {
      // 'league' was the pre-#36 name; a stale client must not slip through.
      expect(subscribeBodySchema.safeParse({ eventType: 'league' }).success).toBe(false);
    });

    it('should reject empty event type', () => {
      expect(subscribeBodySchema.safeParse({ eventType: '' }).success).toBe(false);
    });

    it('should reject a missing event type', () => {
      expect(subscribeBodySchema.safeParse({}).success).toBe(false);
    });

    it('should strip unknown fields', () => {
      const result = subscribeBodySchema.safeParse({ eventType: 'koth', extra: 'ignored' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).not.toHaveProperty('extra');
    });
  });

  describe('setSubscriptionsBodySchema', () => {
    it('should accept an empty array, which clears all subscriptions', () => {
      expect(setSubscriptionsBodySchema.safeParse({ eventTypes: [] }).success).toBe(true);
    });

    it('should accept every registered event at once', () => {
      const result = setSubscriptionsBodySchema.safeParse({
        eventTypes: [...SUBSCRIBABLE_EVENT_TYPES],
      });
      expect(result.success).toBe(true);
    });

    it('should reject an array longer than the number of events', () => {
      // The bound is the DoS control: a request cannot ask for more work than the
      // game has modes, however large a body it sends.
      const tooMany = Array(SUBSCRIBABLE_EVENT_TYPES.length + 1).fill('league_1v1');
      expect(setSubscriptionsBodySchema.safeParse({ eventTypes: tooMany }).success).toBe(false);
    });

    it('should reject the whole array when one entry is unknown', () => {
      const result = setSubscriptionsBodySchema.safeParse({
        eventTypes: ['league_1v1', 'not_a_mode'],
      });
      expect(result.success).toBe(false);
    });

    it('should reject a non-array body', () => {
      expect(setSubscriptionsBodySchema.safeParse({ eventTypes: 'league_1v1' }).success).toBe(false);
    });

    it('should reject a missing eventTypes field', () => {
      expect(setSubscriptionsBodySchema.safeParse({}).success).toBe(false);
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
