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

/**
 * Prisma `UserWhereInput` for real players: excludes auto-generated bots,
 * system/test accounts and Automaton_Stables (Spec #55 R1.6).
 *
 * Top-level keys of a Prisma where clause are combined with AND, so this is
 * "none of the excluded usernames AND not an Automaton_Stable".
 */
export function realUserFilter(): Prisma.UserWhereInput {
  return {
    stableType: { not: 'automaton' },
    NOT: [
      ...AUTO_BOT_PREFIXES.map((prefix) => ({ username: { startsWith: prefix } })),
      ...SYSTEM_PREFIXES.map((prefix) => ({ username: { startsWith: prefix } })),
      ...SYSTEM_EXACT_USERNAMES.map((name) => ({ username: name })),
    ],
  };
}
