/**
 * Schema validation tests for admin maintenance routes.
 *
 * Validates Zod schemas reject invalid input for repair, bulk cycles,
 * and scheduler trigger endpoints.
 */

import { z } from 'zod';

// Recreate schemas from adminMaintenance.ts
const repairAllBodySchema = z.object({
  deductCosts: z.boolean().optional().default(false),
});

const bulkCyclesBodySchema = z.object({
  cycles: z.number().int().nonnegative().max(100).optional().default(1),
  generateUsersPerCycle: z.boolean().optional().default(false),
  includeTournaments: z.boolean().optional().default(true),
  includeKoth: z.boolean().optional().default(true),
});

// Simplified scheduler job names for testing (the real ones come from cycleScheduler)
const MOCK_JOB_NAMES = ['league', 'tournament', 'settlement', 'koth', 'tagTeam', 'team2v2League', 'team3v3League', 'team2v2Tournament', 'team3v3Tournament', 'grandMelee'] as const;
const schedulerJobParamSchema = z.object({
  jobName: z.enum(MOCK_JOB_NAMES),
});

describe('Admin Maintenance — Schema Validation', () => {
  describe('repairAllBodySchema', () => {
    it('should accept empty body (defaults deductCosts to false)', () => {
      const result = repairAllBodySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deductCosts).toBe(false);
      }
    });

    it('should accept deductCosts true', () => {
      const result = repairAllBodySchema.safeParse({ deductCosts: true });
      expect(result.success).toBe(true);
    });

    it('should reject non-boolean deductCosts', () => {
      const result = repairAllBodySchema.safeParse({ deductCosts: 'yes' });
      expect(result.success).toBe(false);
    });
  });

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

  describe('schedulerJobParamSchema', () => {
    it('should accept valid job names', () => {
      for (const name of MOCK_JOB_NAMES) {
        const result = schedulerJobParamSchema.safeParse({ jobName: name });
        expect(result.success).toBe(true);
      }
    });

    it('should reject unknown job name', () => {
      const result = schedulerJobParamSchema.safeParse({ jobName: 'invalid_job' });
      expect(result.success).toBe(false);
    });

    it('should reject missing jobName', () => {
      const result = schedulerJobParamSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
