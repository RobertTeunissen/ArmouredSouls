/**
 * Schema validation tests for admin users routes.
 *
 * Validates Zod schemas reject invalid input for user management,
 * security events, battle inspection, and audit log endpoints.
 */

import { z } from 'zod';
import { positiveIntParam, paginationQuery } from '../../src/utils/securityValidation';

// Recreate schemas from adminUsers.ts
const battleIdParamsSchema = z.object({
  id: positiveIntParam,
});

const battlesQuerySchema = paginationQuery.extend({
  leagueType: z.string().optional(),
  battleType: z.string().optional(),
});

const recentUsersQuerySchema = z.object({
  cycles: z.coerce.number().int().positive().max(200).optional().default(10),
  filter: z.enum(['all', 'real', 'auto']).optional().default('real'),
});

const repairAuditQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  repairType: z.enum(['manual', 'automatic']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

describe('Admin Users — Schema Validation', () => {
  describe('battleIdParamsSchema', () => {
    it('should accept valid positive integer', () => {
      const result = battleIdParamsSchema.safeParse({ id: '42' });
      expect(result.success).toBe(true);
    });

    it('should reject zero', () => {
      const result = battleIdParamsSchema.safeParse({ id: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric', () => {
      const result = battleIdParamsSchema.safeParse({ id: 'abc' });
      expect(result.success).toBe(false);
    });
  });

  describe('battlesQuerySchema', () => {
    it('should accept empty query (pagination defaults)', () => {
      const result = battlesQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept valid leagueType and battleType', () => {
      const result = battlesQuerySchema.safeParse({
        leagueType: 'gold',
        battleType: 'league_1v1',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('recentUsersQuerySchema', () => {
    it('should accept empty query (defaults to 10 cycles, real filter)', () => {
      const result = recentUsersQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cycles).toBe(10);
        expect(result.data.filter).toBe('real');
      }
    });

    it('should accept cycles at max (200)', () => {
      const result = recentUsersQuerySchema.safeParse({ cycles: '200' });
      expect(result.success).toBe(true);
    });

    it('should reject cycles above 200', () => {
      const result = recentUsersQuerySchema.safeParse({ cycles: '201' });
      expect(result.success).toBe(false);
    });

    it('should reject cycles of 0', () => {
      const result = recentUsersQuerySchema.safeParse({ cycles: '0' });
      expect(result.success).toBe(false);
    });

    it('should accept valid filter values', () => {
      for (const filter of ['all', 'real', 'auto']) {
        const result = recentUsersQuerySchema.safeParse({ filter });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid filter value', () => {
      const result = recentUsersQuerySchema.safeParse({ filter: 'bots' });
      expect(result.success).toBe(false);
    });
  });

  describe('repairAuditQuerySchema', () => {
    it('should accept empty query (all defaults)', () => {
      const result = repairAuditQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(25);
      }
    });

    it('should accept valid repairType values', () => {
      const manual = repairAuditQuerySchema.safeParse({ repairType: 'manual' });
      const automatic = repairAuditQuerySchema.safeParse({ repairType: 'automatic' });
      expect(manual.success).toBe(true);
      expect(automatic.success).toBe(true);
    });

    it('should reject invalid repairType', () => {
      const result = repairAuditQuerySchema.safeParse({ repairType: 'partial' });
      expect(result.success).toBe(false);
    });

    it('should reject limit above 100', () => {
      const result = repairAuditQuerySchema.safeParse({ limit: '101' });
      expect(result.success).toBe(false);
    });

    it('should reject page of 0', () => {
      const result = repairAuditQuerySchema.safeParse({ page: '0' });
      expect(result.success).toBe(false);
    });
  });
});
