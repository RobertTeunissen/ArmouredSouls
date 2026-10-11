import type { Prisma } from '../../generated/prisma';

/**
 * Auto-generated bot username prefixes.
 * These users are created by the bulk cycle runner's user generation feature.
 */
const AUTO_BOT_PREFIXES = [
  'auto_wimpbot_',
  'auto_averagebot_',
  'auto_expertbot_',
] as const;

/**
 * Additional non-real user prefixes (test/system accounts).
 * These are excluded from the "real" filter alongside auto bots.
 */
const SYSTEM_PREFIXES = ['test_user_', 'archetype_', 'attr_'] as const;

/**
 * Exact-match usernames excluded from the "real" filter.
 */
const SYSTEM_EXACT_USERNAMES = ['bye_robot_user'] as const;

export type UserFilterType = 'all' | 'real' | 'auto' | 'automaton';

/** Every accepted filter value, for Zod enums at the route boundary. */
export const USER_FILTER_TYPES = ['all', 'real', 'auto', 'automaton'] as const satisfies readonly UserFilterType[];

/**
 * Builds a Prisma `UserWhereInput` clause to filter users by type.
 *
 * - `'all'`       — no filter (returns all users)
 * - `'real'`      — excludes auto-generated bots, system/test accounts and
 *                   Automaton_Stables (Spec #55 R1.6)
 * - `'auto'`      — includes only auto-generated bot accounts
 * - `'automaton'` — includes exactly the users with `stableType = automaton`
 *
 * The returned object can be spread into a Prisma query's `where` clause.
 */
export function buildUserFilter(filter: UserFilterType): Prisma.UserWhereInput {
  if (filter === 'automaton') {
    return { stableType: 'automaton' };
  }

  if (filter === 'real') {
    // Top-level keys of a Prisma where clause are combined with AND, so this is
    // "none of the excluded usernames AND not an Automaton_Stable".
    return {
      stableType: { not: 'automaton' },
      NOT: [
        ...AUTO_BOT_PREFIXES.map((prefix) => ({
          username: { startsWith: prefix },
        })),
        ...SYSTEM_PREFIXES.map((prefix) => ({
          username: { startsWith: prefix },
        })),
        ...SYSTEM_EXACT_USERNAMES.map((name) => ({
          username: name,
        })),
      ],
    };
  }

  if (filter === 'auto') {
    return {
      OR: AUTO_BOT_PREFIXES.map((prefix) => ({
        username: { startsWith: prefix },
      })),
    };
  }

  // 'all' — no filter
  return {};
}
