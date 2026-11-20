/**
 * Property-based tests for realUserFilter.
 * Uses fast-check to verify universal properties across generated inputs.
 *
 * Property 6: User filter classification correctness
 * For any username string, the realUserFilter function SHALL classify it correctly:
 * - Usernames starting with auto_wimpbot_, auto_averagebot_, or auto_expertbot_ are auto-generated
 * - Usernames starting with test_user_, archetype_, attr_, or equal to bye_robot_user are system/test accounts
 * - All other usernames are real players
 * The Prisma where clause produced by realUserFilter() SHALL exclude all auto-generated
 * and system usernames, and auto-generated usernames are never real players.
 *
 * **Validates: Requirements 5.3**
 */

import * as fc from 'fast-check';
import { realUserFilter } from '../realUserFilter';
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
 * that realUserFilter encodes into Prisma where clauses.
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
 * Supports the subset of Prisma operators used by realUserFilter:
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

describe('realUserFilter Property Tests', () => {
  /**
   * Property 6: User filter classification correctness
   * **Validates: Requirements 5.3**
   */
  describe('Property 6: User filter classification correctness', () => {
    it("'real' filter excludes all auto-generated usernames", () => {
      const realFilter = realUserFilter();

      fc.assert(
        fc.property(autoBotUsername, (username: string) => {
          expect(matchesFilter(username, realFilter)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("'real' filter excludes all system prefix usernames", () => {
      const realFilter = realUserFilter();

      fc.assert(
        fc.property(systemPrefixUsername, (username: string) => {
          expect(matchesFilter(username, realFilter)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("'real' filter excludes exact system usernames", () => {
      const realFilter = realUserFilter();

      fc.assert(
        fc.property(systemExactUsername, (username: string) => {
          expect(matchesFilter(username, realFilter)).toBe(false);
        }),
        { numRuns: 10 }
      );
    });

    it("'real' filter includes all normal usernames", () => {
      const realFilter = realUserFilter();

      fc.assert(
        fc.property(normalUsername, (username: string) => {
          expect(matchesFilter(username, realFilter)).toBe(true);
        }),
        { numRuns: 100 }
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


    it("'real' never matches an automaton user, whatever the username", () => {
      const filter = realUserFilter();
      fc.assert(
        fc.property(anyUsername, (username) => {
          expect(matchesUser({ username, stableType: 'automaton' }, filter)).toBe(false);
        }),
        { numRuns: 200 },
      );
    });

    it("'real' keeps its result for non-automaton users", () => {
      const filter = realUserFilter();
      fc.assert(
        fc.property(anyUsername, fc.constantFrom<StableTypeValue>('human', 'generated'), (username, stableType) => {
          expect(matchesUser({ username, stableType }, filter)).toBe(classifyUsername(username) === 'real');
        }),
        { numRuns: 200 },
      );
    });

  });
});
