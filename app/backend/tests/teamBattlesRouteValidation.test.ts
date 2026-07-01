/**
 * Tests for team battles route Zod validation schemas.
 *
 * Validates that team battle endpoints reject invalid input
 * (invalid robot IDs, team sizes, names, etc.).
 */

import { z } from 'zod';
import { positiveIntParam, safeName } from '../src/utils/securityValidation';

// --- Recreate schemas (same as teamBattles.ts) ---

const teamIdParamsSchema = z.object({
  id: positiveIntParam,
});

const registerTeamBodySchema = z.object({
  robotIds: z.array(z.number().int().positive()).min(2).max(3),
  teamName: safeName.pipe(z.string().min(3).max(32)),
  teamSize: z.union([z.literal(2), z.literal(3)]),
});

const swapMemberBodySchema = z.object({
  oldRobotId: z.number().int().positive(),
  newRobotId: z.number().int().positive(),
});

const renameTeamBodySchema = z.object({
  teamName: safeName.pipe(z.string().min(3).max(32)),
});

// --- Tests ---

describe('Team Battles route validation schemas', () => {
  describe('teamIdParamsSchema', () => {
    it('should accept valid team ID', () => {
      const result = teamIdParamsSchema.safeParse({ id: '10' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.id).toBe(10);
    });

    it('should reject zero', () => {
      expect(teamIdParamsSchema.safeParse({ id: '0' }).success).toBe(false);
    });

    it('should reject non-numeric', () => {
      expect(teamIdParamsSchema.safeParse({ id: 'abc' }).success).toBe(false);
    });
  });

  describe('registerTeamBodySchema', () => {
    it('should accept valid 2-member team registration', () => {
      const result = registerTeamBodySchema.safeParse({
        robotIds: [1, 2],
        teamName: 'Iron Duo',
        teamSize: 2,
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid 3-member team registration', () => {
      const result = registerTeamBodySchema.safeParse({
        robotIds: [1, 2, 3],
        teamName: 'Triple Threat',
        teamSize: 3,
      });
      expect(result.success).toBe(true);
    });

    it('should reject less than 2 robots', () => {
      const result = registerTeamBodySchema.safeParse({
        robotIds: [1],
        teamName: 'Solo Bot',
        teamSize: 2,
      });
      expect(result.success).toBe(false);
    });

    it('should reject more than 3 robots', () => {
      const result = registerTeamBodySchema.safeParse({
        robotIds: [1, 2, 3, 4],
        teamName: 'Quad Squad',
        teamSize: 3,
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid team sizes (only 2 or 3)', () => {
      expect(registerTeamBodySchema.safeParse({
        robotIds: [1, 2],
        teamName: 'Bad Size',
        teamSize: 4,
      }).success).toBe(false);

      expect(registerTeamBodySchema.safeParse({
        robotIds: [1, 2],
        teamName: 'Bad Size',
        teamSize: 1,
      }).success).toBe(false);
    });

    it('should reject team name shorter than 3 chars', () => {
      expect(registerTeamBodySchema.safeParse({
        robotIds: [1, 2],
        teamName: 'AB',
        teamSize: 2,
      }).success).toBe(false);
    });

    it('should reject team name longer than 32 chars', () => {
      expect(registerTeamBodySchema.safeParse({
        robotIds: [1, 2],
        teamName: 'A'.repeat(33),
        teamSize: 2,
      }).success).toBe(false);
    });

    it('should reject negative robot IDs', () => {
      expect(registerTeamBodySchema.safeParse({
        robotIds: [-1, 2],
        teamName: 'Bad Team',
        teamSize: 2,
      }).success).toBe(false);
    });

    it('should reject zero robot IDs', () => {
      expect(registerTeamBodySchema.safeParse({
        robotIds: [0, 2],
        teamName: 'Bad Team',
        teamSize: 2,
      }).success).toBe(false);
    });

    it('should strip unknown fields', () => {
      const result = registerTeamBodySchema.safeParse({
        robotIds: [1, 2],
        teamName: 'Iron Duo',
        teamSize: 2,
        hackerField: 'ignored',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).not.toHaveProperty('hackerField');
    });
  });

  describe('swapMemberBodySchema', () => {
    it('should accept valid swap', () => {
      const result = swapMemberBodySchema.safeParse({ oldRobotId: 5, newRobotId: 10 });
      expect(result.success).toBe(true);
    });

    it('should reject zero IDs', () => {
      expect(swapMemberBodySchema.safeParse({ oldRobotId: 0, newRobotId: 10 }).success).toBe(false);
      expect(swapMemberBodySchema.safeParse({ oldRobotId: 5, newRobotId: 0 }).success).toBe(false);
    });

    it('should reject negative IDs', () => {
      expect(swapMemberBodySchema.safeParse({ oldRobotId: -1, newRobotId: 10 }).success).toBe(false);
    });

    it('should reject non-integer IDs', () => {
      expect(swapMemberBodySchema.safeParse({ oldRobotId: 1.5, newRobotId: 10 }).success).toBe(false);
    });
  });

  describe('renameTeamBodySchema', () => {
    it('should accept valid team name', () => {
      const result = renameTeamBodySchema.safeParse({ teamName: 'New Name' });
      expect(result.success).toBe(true);
    });

    it('should reject name shorter than 3 chars', () => {
      expect(renameTeamBodySchema.safeParse({ teamName: 'AB' }).success).toBe(false);
    });

    it('should reject name longer than 32 chars', () => {
      expect(renameTeamBodySchema.safeParse({ teamName: 'A'.repeat(33) }).success).toBe(false);
    });
  });
});
