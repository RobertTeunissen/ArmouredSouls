/**
 * Schema validation tests for admin maintenance routes.
 *
 * Validates the bulk cycles body schema. The repair-all and scheduler-trigger
 * routes were removed with the Maintenance redesign.
 */

import { z } from 'zod';

// Recreate schemas from adminMaintenance.ts
const bulkCyclesBodySchema = z.object({
  cycles: z.number().int().nonnegative().max(100).optional().default(1),
  generateUsersPerCycle: z.boolean().optional().default(false),
  includeTournaments: z.boolean().optional().default(true),
  includeKoth: z.boolean().optional().default(true),
});

describe('Admin Maintenance — Schema Validation', () => {
  describe('bulkCyclesBodySchema', () => {
    it('should accept empty body (all defaults)', () => {
      const result = bulkCyclesBodySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cycles).toBe(1);
        expect(result.data.generateUsersPerCycle).toBe(false);
        expect(result.data.includeTournaments).toBe(true);
        expect(result.data.includeKoth).toBe(true);
      }
    });

    it('should accept cycles of 0 (noop run)', () => {
      const result = bulkCyclesBodySchema.safeParse({ cycles: 0 });
      expect(result.success).toBe(true);
    });

    it('should accept cycles at max (100)', () => {
      const result = bulkCyclesBodySchema.safeParse({ cycles: 100 });
      expect(result.success).toBe(true);
    });

    it('should reject cycles above 100', () => {
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

    it('should reject non-boolean includeTournaments', () => {
      const result = bulkCyclesBodySchema.safeParse({ includeTournaments: 'yes' });
      expect(result.success).toBe(false);
    });
  });
});
