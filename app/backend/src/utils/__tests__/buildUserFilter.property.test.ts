/**
 * Property-based tests for buildUserFilter.
 * Uses fast-check to verify universal properties across generated inputs.
 *
 * Property 6: User filter classification correctness
 * For any username string, the buildUserFilter function SHALL classify it correctly:
 * - Usernames starting with auto_wimpbot_, auto_averagebot_, or auto_expertbot_ are auto-generated
 * - Usernames starting with test_user_, archetype_, attr_, or equal to bye_robot_user are system/test accounts
 * - All other usernames are real players
 * The Prisma where clause produced by buildUserFilter('real') SHALL exclude all auto-generated
 * and system usernames, and buildUserFilter('auto') SHALL include only auto-generated usernames.
 *
 * **Validates: Requirements 5.3**
 */

import * as fc from 'fast-check';
import { buildUserFilter } from '../buildUserFilter';
import type { Prisma } from '../../../generated/prisma';

// ── Username classification constants (mirroring the source) ──

const AUTO_BOT_PREFIXES = [
  'auto_wimpbot_',
  'auto_averagebot_',
  'auto_expertbot_',
];

const SYSTEM_PREFIXES = ['test_user_', 'archetype_', 'attr_'];

const SYSTEM_EXACT_USERNAMES = ['bye_robot_user'];

// ── Classification helper ──

type UsernameCategory = 'auto' | 'system' | 'real';

/**
 * Classifies a username into its category using the same rules
 * that buildUserFilter encodes into Prisma where clauses.
 */
function classifyUsername(username: string): UsernameCategory {
  if (AUTO_BOT_PREFIXES.some((prefix) => username.startsWith(prefix))) {
    return 'auto';
  }
  if (SYSTEM_PREFIXES.some((prefix) => username.startsWith(prefix))) {
    return 'system';
  }
  if (SYSTEM_EXACT_USERNAMES.includes(username)) {
    return 'system';
  }
  return 'real';
}

// ── Where clause evaluation helper ──

/**
 * Evaluates whether a username matches a Prisma UserWhereInput clause.
 * Supports the subset of Prisma operators used by buildUserFilter:
 * - startsWith on username
 * - exact match on username
 * - NOT (array of conditions)
 * - OR (array of conditions)
 * - empty object (matches all)
 */
function matchesFilter(
  username: string,
  where: Prisma.UserWhereInput
): boolean {
  // Empty object = matches everything
  if (Object.keys(where).length === 0) {
    return true;
  }

  // NOT: array of conditions — username must NOT match ANY of them
  if (where.NOT && Array.isArray(where.NOT)) {
    const matchesAnyExclusion = (
      where.NOT as Prisma.UserWhereInput[]
    ).some((condition) => matchesSingleCondition(username, condition));
    return !matchesAnyExclusion;
  }

  // OR: array of conditions — username must match AT LEAST ONE
  if (where.OR && Array.isArray(where.OR)) {
    return (where.OR as Prisma.UserWhereInput[]).some((condition) =>
      matchesSingleCondition(username, condition)
    );
  }

  return matchesSingleCondition(username, where);
}

function matchesSingleCondition(
  username: string,
  condition: Prisma.UserWhereInput
): boolean {
  if (!condition.username) return false;

  // Exact match: { username: "some_value" }
  if (typeof condition.username === 'string') {
    return username === condition.username;
  }

  // startsWith: { username: { startsWith: "prefix" } }
  if (
    typeof condition.username === 'object' &&
    'startsWith' in condition.username &&
    typeof condition.username.startsWith === 'string'
  ) {
    return username.startsWith(condition.username.startsWith);
  }

  return false;
}

// ── fast-check arbitraries for username generation ──

/** Generates a username with one of the auto bot prefixes */
const autoBotUsername = fc.oneof(
  ...AUTO_BOT_PREFIXES.map((prefix) =>
    fc.string({ minLength: 1, maxLength: 20 }).map((suffix) => prefix + suffix)
  )
);

/** Generates a username with one of the system prefixes */
const systemPrefixUsername = fc.oneof(
  ...SYSTEM_PREFIXES.map((prefix) =>
    fc.string({ minLength: 1, maxLength: 20 }).map((suffix) => prefix + suffix)
  )
);

/** Generates the exact system username */
const systemExactUsername = fc.constant('bye_robot_user');

/** Generates a "normal" username that doesn't match any special prefix or exact name */
const normalUsername: fc.Arbitrary<string> = fc
  .string({ minLength: 3, maxLength: 30, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_'.split('')) })
  .filter((name: string) => {
    // Exclude names that accidentally match special patterns
    if (AUTO_BOT_PREFIXES.some((p) => name.startsWith(p))) return false;
    if (SYSTEM_PREFIXES.some((p) => name.startsWith(p))) return false;
    if (SYSTEM_EXACT_USERNAMES.includes(name)) return false;
    return true;
  });

/** Generates any username from all categories */
const anyUsername: fc.Arbitrary<string> = fc.oneof(
  { weight: 3, arbitrary: autoBotUsername },
  { weight: 2, arbitrary: systemPrefixUsername },
  { weight: 1, arbitrary: systemExactUsername },
  { weight: 4, arbitrary: normalUsername }
);

// ── Property tests ──

describe('buildUserFilter Property Tests', () => {
  /**
   * Property 6: User filter classification correctness
   * **Validates: Requirements 5.3**
   */
  describe('Property 6: User filter classification correctness', () => {
    it("'real' filter excludes all auto-generated usernames", () => {
      const realFilter = buildUserFilter('real');

      fc.assert(
        fc.property(autoBotUsername, (username: string) => {
          expect(matchesFilter(username, realFilter)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("'real' filter excludes all system prefix usernames", () => {
      const realFilter = buildUserFilter('real');

      fc.assert(
        fc.property(systemPrefixUsername, (username: string) => {
          expect(matchesFilter(username, realFilter)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("'real' filter excludes exact system usernames", () => {
      const realFilter = buildUserFilter('real');

      fc.assert(
        fc.property(systemExactUsername, (username: string) => {
          expect(matchesFilter(username, realFilter)).toBe(false);
        }),
        { numRuns: 10 }
      );
    });

    it("'real' filter includes all normal usernames", () => {
      const realFilter = buildUserFilter('real');

      fc.assert(
        fc.property(normalUsername, (username: string) => {
          expect(matchesFilter(username, realFilter)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("'auto' filter includes only auto-generated usernames", () => {
      const autoFilter = buildUserFilter('auto');

      fc.assert(
        fc.property(autoBotUsername, (username: string) => {
          expect(matchesFilter(username, autoFilter)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("'auto' filter excludes system prefix usernames", () => {
      const autoFilter = buildUserFilter('auto');

      fc.assert(
        fc.property(systemPrefixUsername, (username: string) => {
          expect(matchesFilter(username, autoFilter)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("'auto' filter excludes exact system usernames", () => {
      const autoFilter = buildUserFilter('auto');

      fc.assert(
        fc.property(systemExactUsername, (username: string) => {
          expect(matchesFilter(username, autoFilter)).toBe(false);
        }),
        { numRuns: 10 }
      );
    });

    it("'auto' filter excludes normal usernames", () => {
      const autoFilter = buildUserFilter('auto');

      fc.assert(
        fc.property(normalUsername, (username: string) => {
          expect(matchesFilter(username, autoFilter)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("'all' filter includes every username", () => {
      const allFilter = buildUserFilter('all');

      fc.assert(
        fc.property(anyUsername, (username: string) => {
          expect(matchesFilter(username, allFilter)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('classification is consistent: real filter and auto filter are mutually exclusive for any username', () => {
      const realFilter = buildUserFilter('real');
      const autoFilter = buildUserFilter('auto');

      fc.assert(
        fc.property(anyUsername, (username: string) => {
          const inReal = matchesFilter(username, realFilter);
          const inAuto = matchesFilter(username, autoFilter);

          // A username cannot be in both real and auto
          expect(inReal && inAuto).toBe(false);

          // An auto username must be excluded from real
          if (classifyUsername(username) === 'auto') {
            expect(inAuto).toBe(true);
            expect(inReal).toBe(false);
          }

          // A system username must be excluded from both real and auto
          if (classifyUsername(username) === 'system') {
            expect(inReal).toBe(false);
            expect(inAuto).toBe(false);
          }

          // A real username must be included in real and excluded from auto
          if (classifyUsername(username) === 'real') {
            expect(inReal).toBe(true);
            expect(inAuto).toBe(false);
          }
        }),
        { numRuns: 200 }
      );
    });
  });

  /**
   * Spec #55 R1.6: filters over users that carry a Stable_Type.
   * - `automaton` returns exactly the users with stableType = automaton
   * - `real` excludes automaton users in addition to its username exclusions
   * - `auto` and `all` keep their current results
   */
  describe('Spec #55: Stable_Type-aware filter classification', () => {
    type StableTypeValue = 'human' | 'generated' | 'automaton';
    interface FilterSubject { username: string; stableType: StableTypeValue }

    /** Evaluates the stableType condition of a where clause (absent = match). */
    function matchesStableType(stableType: StableTypeValue, where: Prisma.UserWhereInput): boolean {
      const condition = where.stableType;
      if (condition === undefined) return true;
      if (typeof condition === 'string') return stableType === condition;
      if (condition && typeof condition === 'object' && 'not' in condition) {
        return stableType !== condition.not;
      }
      return false;
    }

    /** Username part and Stable_Type part are combined with AND, as Prisma does for top-level keys. */
    function matchesUser(user: FilterSubject, where: Prisma.UserWhereInput): boolean {
      const { stableType: _stableType, ...usernamePart } = where;
      return matchesFilter(user.username, usernamePart) && matchesStableType(user.stableType, where);
    }

    const stableTypeArb = fc.constantFrom<StableTypeValue>('human', 'generated', 'automaton');
    const subjectArb: fc.Arbitrary<FilterSubject> = fc.record({ username: anyUsername, stableType: stableTypeArb });

    it("'automaton' matches exactly the automaton users", () => {
      const filter = buildUserFilter('automaton');
      fc.assert(
        fc.property(subjectArb, (user) => {
          expect(matchesUser(user, filter)).toBe(user.stableType === 'automaton');
        }),
        { numRuns: 200 },
      );
    });

    it("'real' never matches an automaton user, whatever the username", () => {
      const filter = buildUserFilter('real');
      fc.assert(
        fc.property(anyUsername, (username) => {
          expect(matchesUser({ username, stableType: 'automaton' }, filter)).toBe(false);
        }),
        { numRuns: 200 },
      );
    });

    it("'real' keeps its result for non-automaton users", () => {
      const filter = buildUserFilter('real');
      fc.assert(
        fc.property(anyUsername, fc.constantFrom<StableTypeValue>('human', 'generated'), (username, stableType) => {
          expect(matchesUser({ username, stableType }, filter)).toBe(classifyUsername(username) === 'real');
        }),
        { numRuns: 200 },
      );
    });

    it("'auto' and 'all' ignore Stable_Type", () => {
      const auto = buildUserFilter('auto');
      const all = buildUserFilter('all');
      fc.assert(
        fc.property(subjectArb, (user) => {
          expect(matchesUser(user, auto)).toBe(classifyUsername(user.username) === 'auto');
          expect(matchesUser(user, all)).toBe(true);
        }),
        { numRuns: 200 },
      );
    });
  });
});
