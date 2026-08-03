/**
 * Schema validation tests for admin tournament routes.
 *
 * Validates Zod schemas reject invalid input for tournament management endpoints.
 */

import { z } from 'zod';
import { positiveIntParam } from '../../src/utils/securityValidation';

// Recreate schemas from adminTournaments.ts
const tournamentIdParamsSchema = z.object({
  id: positiveIntParam,
});

const createTournamentBodySchema = z.object({
  tournamentType: z.enum(['single_elimination']).optional().default('single_elimination'),
});

const tournamentListQuerySchema = z.object({
  status: z.string().max(30).optional(),
  participantType: z.enum(['robot', 'team_2v2', 'team_3v3']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
});

describe('Admin Tournaments — Schema Validation', () => {
  describe('tournamentIdParamsSchema', () => {
    it('should accept valid positive integer id', () => {
      const result = tournamentIdParamsSchema.safeParse({ id: '5' });
      expect(result.success).toBe(true);
    });

    it('should reject id of 0', () => {
      const result = tournamentIdParamsSchema.safeParse({ id: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject negative id', () => {
      const result = tournamentIdParamsSchema.safeParse({ id: '-1' });
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric id', () => {
      const result = tournamentIdParamsSchema.safeParse({ id: 'abc' });
      expect(result.success).toBe(false);
    });
  });

  describe('createTournamentBodySchema', () => {
    it('should accept empty body (defaults to single_elimination)', () => {
      const result = createTournamentBodySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tournamentType).toBe('single_elimination');
      }
    });

    it('should accept explicit single_elimination', () => {
      const result = createTournamentBodySchema.safeParse({ tournamentType: 'single_elimination' });
      expect(result.success).toBe(true);
    });

    it('should reject unknown tournament type', () => {
      const result = createTournamentBodySchema.safeParse({ tournamentType: 'double_elimination' });
      expect(result.success).toBe(false);
    });
  });

  describe('tournamentListQuerySchema', () => {
    it('should accept empty query (all defaults)', () => {
      const result = tournamentListQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should accept valid participantType', () => {
      const result = tournamentListQuerySchema.safeParse({ participantType: 'team_2v2' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid participantType', () => {
      const result = tournamentListQuerySchema.safeParse({ participantType: 'team_5v5' });
      expect(result.success).toBe(false);
    });

    it('should reject page of 0', () => {
      const result = tournamentListQuerySchema.safeParse({ page: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject limit above 50', () => {
      const result = tournamentListQuerySchema.safeParse({ limit: '51' });
      expect(result.success).toBe(false);
    });

    it('should reject status longer than 30 chars', () => {
      const result = tournamentListQuerySchema.safeParse({ status: 'a'.repeat(31) });
      expect(result.success).toBe(false);
    });
  });
});
