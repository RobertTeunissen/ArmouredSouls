/**
 * Unit tests for buildUserFilter utility.
 *
 * Tests all prefix patterns, edge cases (empty string, partial matches),
 * and verifies the returned Prisma where clause structure.
 *
 * _Requirements: 5.3_
 */

import { buildUserFilter } from '../buildUserFilter';
import type { Prisma } from '../../../generated/prisma';

describe('buildUserFilter', () => {
  // ── 'all' filter ──────────────────────────────────────────────────

  describe("filter type 'all'", () => {
    it('should return an empty object (no filter)', () => {
      const result = buildUserFilter('all');
      expect(result).toEqual({});
    });

    it('should have no keys in the returned object', () => {
      const result = buildUserFilter('all');
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  // ── 'real' filter ─────────────────────────────────────────────────

  describe("filter type 'real'", () => {
    let result: Prisma.UserWhereInput;

    beforeEach(() => {
      result = buildUserFilter('real');
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
  });

  // ── 'auto' filter ─────────────────────────────────────────────────

  describe("filter type 'auto'", () => {
    let result: Prisma.UserWhereInput;

    beforeEach(() => {
      result = buildUserFilter('auto');
    });

    it('should return an object with an OR array', () => {
      expect(result).toHaveProperty('OR');
      expect(Array.isArray(result.OR)).toBe(true);
    });

    it('should include only the three auto bot prefixes', () => {
      const orArray = result.OR as Prisma.UserWhereInput[];
      const startsWithValues = orArray
        .map((c) => (c.username as { startsWith: string }).startsWith);

      expect(startsWithValues).toEqual([
        'auto_wimpbot_',
        'auto_averagebot_',
        'auto_expertbot_',
      ]);
    });

    it('should have exactly 3 inclusion conditions', () => {
      const orArray = result.OR as Prisma.UserWhereInput[];
      expect(orArray).toHaveLength(3);
    });

    it('should not include system prefixes', () => {
      const orArray = result.OR as Prisma.UserWhereInput[];
      const startsWithValues = orArray
        .map((c) => (c.username as { startsWith: string }).startsWith);

      expect(startsWithValues).not.toContain('test_user_');
      expect(startsWithValues).not.toContain('archetype_');
      expect(startsWithValues).not.toContain('attr_');
    });

    it('should not have a NOT property', () => {
      expect(result).not.toHaveProperty('NOT');
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle empty string username — not matched by auto filter (no prefix match)', () => {
      const autoFilter = buildUserFilter('auto');
      // Empty string doesn't start with any auto prefix, so OR conditions won't match
      const orArray = autoFilter.OR as Prisma.UserWhereInput[];
      for (const condition of orArray) {
        const prefix = (condition.username as { startsWith: string }).startsWith;
        expect(''.startsWith(prefix)).toBe(false);
      }
    });

    it('should handle empty string username — included by real filter (not excluded)', () => {
      const realFilter = buildUserFilter('real');
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

    it("should not match partial prefix 'auto_' without full bot prefix", () => {
      const autoFilter = buildUserFilter('auto');
      const orArray = autoFilter.OR as Prisma.UserWhereInput[];
      // 'auto_someuser' doesn't start with any of the full auto bot prefixes
      for (const condition of orArray) {
        const prefix = (condition.username as { startsWith: string }).startsWith;
        expect('auto_someuser'.startsWith(prefix)).toBe(false);
      }
    });

    it("should not match partial prefix 'auto_wimp' without full 'auto_wimpbot_'", () => {
      const autoFilter = buildUserFilter('auto');
      const orArray = autoFilter.OR as Prisma.UserWhereInput[];
      for (const condition of orArray) {
        const prefix = (condition.username as { startsWith: string }).startsWith;
        expect('auto_wimp'.startsWith(prefix)).toBe(false);
      }
    });

    it("should match exact 'bye_robot_user' in real filter exclusions (not a prefix match)", () => {
      const realFilter = buildUserFilter('real');
      const notArray = realFilter.NOT as Prisma.UserWhereInput[];
      const exactMatches = notArray.filter((c) => typeof c.username === 'string');
      // bye_robot_user is an exact match, not a startsWith
      expect(exactMatches).toHaveLength(1);
      expect(exactMatches[0].username).toBe('bye_robot_user');
    });

    it("should not exclude 'bye_robot_user_extra' from real filter (exact match only)", () => {
      const realFilter = buildUserFilter('real');
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

    it("should match 'auto_wimpbot_123' in auto filter", () => {
      const autoFilter = buildUserFilter('auto');
      const orArray = autoFilter.OR as Prisma.UserWhereInput[];
      const matches = orArray.some((condition) => {
        const prefix = (condition.username as { startsWith: string }).startsWith;
        return 'auto_wimpbot_123'.startsWith(prefix);
      });
      expect(matches).toBe(true);
    });

    it("should exclude 'test_user_abc' from real filter", () => {
      const realFilter = buildUserFilter('real');
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
