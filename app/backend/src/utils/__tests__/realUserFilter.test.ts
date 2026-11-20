/**
 * Unit tests for realUserFilter utility.
 *
 * Tests all prefix patterns, edge cases (empty string, partial matches),
 * and verifies the returned Prisma where clause structure.
 *
 * _Requirements: 5.3_
 */

import { realUserFilter } from '../realUserFilter';
import type { Prisma } from '../../../generated/prisma';

describe('realUserFilter', () => {
  // ── 'all' filter ──────────────────────────────────────────────────

  // ── 'real' filter ─────────────────────────────────────────────────

  describe("filter type 'real'", () => {
    let result: Prisma.UserWhereInput;

    beforeEach(() => {
      result = realUserFilter();
    });

    it('should return an object with a NOT array', () => {
      expect(result).toHaveProperty('NOT');
      expect(Array.isArray(result.NOT)).toBe(true);
    });

    it('should exclude all three auto bot prefixes', () => {
      const notArray = result.NOT as Prisma.UserWhereInput[];
      const startsWithValues = notArray
        .filter((c) => typeof c.username === 'object' && c.username !== null && 'startsWith' in c.username)
        .map((c) => (c.username as { startsWith: string }).startsWith);

      expect(startsWithValues).toContain('auto_wimpbot_');
      expect(startsWithValues).toContain('auto_averagebot_');
      expect(startsWithValues).toContain('auto_expertbot_');
    });

    it('should exclude system prefixes (test_user_, archetype_, attr_)', () => {
      const notArray = result.NOT as Prisma.UserWhereInput[];
      const startsWithValues = notArray
        .filter((c) => typeof c.username === 'object' && c.username !== null && 'startsWith' in c.username)
        .map((c) => (c.username as { startsWith: string }).startsWith);

      expect(startsWithValues).toContain('test_user_');
      expect(startsWithValues).toContain('archetype_');
      expect(startsWithValues).toContain('attr_');
    });

    it('should exclude the exact bye_robot_user username', () => {
      const notArray = result.NOT as Prisma.UserWhereInput[];
      const exactMatches = notArray
        .filter((c) => typeof c.username === 'string')
        .map((c) => c.username);

      expect(exactMatches).toContain('bye_robot_user');
    });

    it('should have exactly 7 exclusion conditions (3 auto + 3 system + 1 exact)', () => {
      const notArray = result.NOT as Prisma.UserWhereInput[];
      expect(notArray).toHaveLength(7);
    });

    it('should not have an OR property', () => {
      expect(result).not.toHaveProperty('OR');
    });

    // Spec #55 R1.6: `real` also excludes Automaton_Stables, combined with the
    // username exclusions through the implicit AND of top-level where keys.
    it('should exclude stableType automaton alongside the username exclusions', () => {
      expect(result.stableType).toEqual({ not: 'automaton' });
    });
  });

  // ── 'automaton' filter (Spec #55 R1.6) ────────────────────────────

  // ── 'auto' filter ─────────────────────────────────────────────────

  // ── Edge cases ────────────────────────────────────────────────────

  describe('edge cases', () => {

    it('should handle empty string username — included by real filter (not excluded)', () => {
      const realFilter = realUserFilter();
      const notArray = realFilter.NOT as Prisma.UserWhereInput[];
      // Empty string doesn't match any exclusion condition
      for (const condition of notArray) {
        if (typeof condition.username === 'string') {
          expect('' === condition.username).toBe(false);
        } else {
          const prefix = (condition.username as { startsWith: string }).startsWith;
          expect(''.startsWith(prefix)).toBe(false);
        }
      }
    });

    it("should match exact 'bye_robot_user' in real filter exclusions (not a prefix match)", () => {
      const realFilter = realUserFilter();
      const notArray = realFilter.NOT as Prisma.UserWhereInput[];
      const exactMatches = notArray.filter((c) => typeof c.username === 'string');
      // bye_robot_user is an exact match, not a startsWith
      expect(exactMatches).toHaveLength(1);
      expect(exactMatches[0].username).toBe('bye_robot_user');
    });

    it("should not exclude 'bye_robot_user_extra' from real filter (exact match only)", () => {
      const realFilter = realUserFilter();
      const notArray = realFilter.NOT as Prisma.UserWhereInput[];
      // 'bye_robot_user_extra' is not an exact match for 'bye_robot_user'
      // and doesn't start with any excluded prefix
      let excluded = false;
      for (const condition of notArray) {
        if (typeof condition.username === 'string') {
          if ('bye_robot_user_extra' === condition.username) excluded = true;
        } else {
          const prefix = (condition.username as { startsWith: string }).startsWith;
          if ('bye_robot_user_extra'.startsWith(prefix)) excluded = true;
        }
      }
      expect(excluded).toBe(false);
    });

    it("should exclude 'test_user_abc' from real filter", () => {
      const realFilter = realUserFilter();
      const notArray = realFilter.NOT as Prisma.UserWhereInput[];
      const matchesExclusion = notArray.some((condition) => {
        if (typeof condition.username === 'string') {
          return 'test_user_abc' === condition.username;
        }
        const prefix = (condition.username as { startsWith: string }).startsWith;
        return 'test_user_abc'.startsWith(prefix);
      });
      expect(matchesExclusion).toBe(true);
    });
  });
});
