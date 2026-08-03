/**
 * Schema validation tests for admin seasons routes.
 *
 * Validates Zod schemas reject invalid input for season management endpoints.
 */

import { z } from 'zod';

// Recreate schemas from adminSeasons.ts
const rolloverBodySchema = z.object({
  confirm: z.literal('CONFIRM_ROLLOVER'),
  seasonNumber: z.number().int().min(0),
});

const extendBodySchema = z.object({
  additionalCycles: z.number().int().min(1).max(365),
});

const preparationBodySchema = z.object({
  remainingCycles: z.number().int().min(0).max(7),
});

describe('Admin Seasons — Schema Validation', () => {
  describe('rolloverBodySchema', () => {
    it('should accept valid rollover confirmation', () => {
      const result = rolloverBodySchema.safeParse({
        confirm: 'CONFIRM_ROLLOVER',
        seasonNumber: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should accept seasonNumber 0 (Season Zero)', () => {
      const result = rolloverBodySchema.safeParse({
        confirm: 'CONFIRM_ROLLOVER',
        seasonNumber: 0,
      });
      expect(result.success).toBe(true);
    });

    it('should reject wrong confirm string', () => {
      const result = rolloverBodySchema.safeParse({
        confirm: 'YES',
        seasonNumber: 1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing confirm', () => {
      const result = rolloverBodySchema.safeParse({ seasonNumber: 1 });
      expect(result.success).toBe(false);
    });

    it('should reject missing seasonNumber', () => {
      const result = rolloverBodySchema.safeParse({ confirm: 'CONFIRM_ROLLOVER' });
      expect(result.success).toBe(false);
    });

    it('should reject negative seasonNumber', () => {
      const result = rolloverBodySchema.safeParse({
        confirm: 'CONFIRM_ROLLOVER',
        seasonNumber: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer seasonNumber', () => {
      const result = rolloverBodySchema.safeParse({
        confirm: 'CONFIRM_ROLLOVER',
        seasonNumber: 1.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('extendBodySchema', () => {
    it('should accept additionalCycles within range', () => {
      const result = extendBodySchema.safeParse({ additionalCycles: 10 });
      expect(result.success).toBe(true);
    });

    it('should accept additionalCycles at max (365)', () => {
      const result = extendBodySchema.safeParse({ additionalCycles: 365 });
      expect(result.success).toBe(true);
    });

    it('should reject additionalCycles of 0', () => {
      const result = extendBodySchema.safeParse({ additionalCycles: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject additionalCycles above 365', () => {
      const result = extendBodySchema.safeParse({ additionalCycles: 366 });
      expect(result.success).toBe(false);
    });

    it('should reject missing additionalCycles', () => {
      const result = extendBodySchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('preparationBodySchema', () => {
    it('should accept remainingCycles of 0', () => {
      const result = preparationBodySchema.safeParse({ remainingCycles: 0 });
      expect(result.success).toBe(true);
    });

    it('should accept remainingCycles at max (7)', () => {
      const result = preparationBodySchema.safeParse({ remainingCycles: 7 });
      expect(result.success).toBe(true);
    });

    it('should reject remainingCycles above 7', () => {
      const result = preparationBodySchema.safeParse({ remainingCycles: 8 });
      expect(result.success).toBe(false);
    });

    it('should reject negative remainingCycles', () => {
      const result = preparationBodySchema.safeParse({ remainingCycles: -1 });
      expect(result.success).toBe(false);
    });
  });
});
