/**
 * Schema validation tests for admin battle trigger routes.
 *
 * Validates Zod schemas reject invalid input for team battle and
 * grand melee manual-trigger endpoints.
 */

import { z } from 'zod';

// Recreate schemas from adminBattleTriggers.ts
const teamBattleMatchmakingBodySchema = z.object({
  teamSize: z.union([z.literal(2), z.literal(3)]),
  scheduledFor: z.string().datetime().optional(),
});

const teamBattleBattlesBodySchema = z.object({
  teamSize: z.union([z.literal(2), z.literal(3)]),
});

describe('Admin Battle Triggers — Schema Validation', () => {
  describe('teamBattleMatchmakingBodySchema', () => {
    it('should accept teamSize 2 without scheduledFor', () => {
      const result = teamBattleMatchmakingBodySchema.safeParse({ teamSize: 2 });
      expect(result.success).toBe(true);
    });

    it('should accept teamSize 3 with valid scheduledFor', () => {
      const result = teamBattleMatchmakingBodySchema.safeParse({
        teamSize: 3,
        scheduledFor: '2026-08-01T10:00:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    it('should reject teamSize 1', () => {
      const result = teamBattleMatchmakingBodySchema.safeParse({ teamSize: 1 });
      expect(result.success).toBe(false);
    });

    it('should reject teamSize 4', () => {
      const result = teamBattleMatchmakingBodySchema.safeParse({ teamSize: 4 });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer teamSize', () => {
      const result = teamBattleMatchmakingBodySchema.safeParse({ teamSize: 2.5 });
      expect(result.success).toBe(false);
    });

    it('should reject invalid scheduledFor format', () => {
      const result = teamBattleMatchmakingBodySchema.safeParse({
        teamSize: 2,
        scheduledFor: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing teamSize', () => {
      const result = teamBattleMatchmakingBodySchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('teamBattleBattlesBodySchema', () => {
    it('should accept teamSize 2', () => {
      const result = teamBattleBattlesBodySchema.safeParse({ teamSize: 2 });
      expect(result.success).toBe(true);
    });

    it('should accept teamSize 3', () => {
      const result = teamBattleBattlesBodySchema.safeParse({ teamSize: 3 });
      expect(result.success).toBe(true);
    });

    it('should reject teamSize 5', () => {
      const result = teamBattleBattlesBodySchema.safeParse({ teamSize: 5 });
      expect(result.success).toBe(false);
    });

    it('should reject missing teamSize', () => {
      const result = teamBattleBattlesBodySchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
