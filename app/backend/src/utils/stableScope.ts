/**
 * The admin portal's one stable-type filter: Players / Automatons / Generated /
 * All, used by every admin page that splits by stable type (Dashboard, Meta,
 * Economy, Achievements).
 *
 * - `players`    — human stables without system and test accounts (the
 *                  `real` rule of `buildUserFilter`);
 * - `automatons` — `stableType = automaton`;
 * - `generated`  — `stableType = generated` (bots, including the seeded
 *                  `test_user_*` stables), so the three add up to All apart
 *                  from a few system accounts;
 * - `all`        — no restriction.
 *
 * It replaces the username-prefix `filter=real|auto|automaton|all` the
 * Dashboard and Meta used, where `test_user_*` stables showed up only under All.
 */
import type { Prisma } from '../../generated/prisma';
import { buildUserFilter } from './buildUserFilter';

export const STABLE_SCOPES = ['players', 'automatons', 'generated', 'all'] as const;
export type StableScope = (typeof STABLE_SCOPES)[number];

export function buildStableScopeFilter(scope: StableScope): Prisma.UserWhereInput {
  if (scope === 'players') return buildUserFilter('real');
  if (scope === 'automatons') return { stableType: 'automaton' };
  if (scope === 'generated') return { stableType: 'generated' };
  return {};
}
