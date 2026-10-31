/**
 * Dormant human stables: player accounts with no login during a whole season.
 *
 * The season rollover deletes them (Stage 3, next to the Generated_Stables), so
 * accounts that signed up once and never came back stop counting as players
 * and stop re-entering every season with fresh starting credits. A returning
 * player registers again.
 *
 * Who counts: a human stable (not generated, not an Automaton, not a system or
 * test account, never an admin) whose last activity — its last login, or its
 * registration when it never logged in — is before the ending season started.
 * Stables registered during the season are kept.
 *
 * @module services/season/dormantStables
 */

import prisma from '../../lib/prisma';
import type { Prisma } from '../../../generated/prisma';
import { buildUserFilter } from '../../utils/buildUserFilter';

/** Most dormant stable names the rollover preview lists. */
export const DORMANT_PREVIEW_NAME_LIMIT = 50;

/** The dormant predicate for a season that started at `seasonStartedAt`. */
export function dormantHumanStableWhere(seasonStartedAt: Date): Prisma.UserWhereInput {
  return {
    AND: [
      buildUserFilter('real'),
      { isGenerated: false, stableType: 'human', role: { not: 'admin' } },
      {
        OR: [
          { lastLoginAt: { lt: seasonStartedAt } },
          { lastLoginAt: null, createdAt: { lt: seasonStartedAt } },
        ],
      },
    ],
  };
}

/** Pure form of the predicate, for one stable (shared with the Players page). */
export function isDormant(
  stable: { lastLoginAt: Date | null; createdAt: Date },
  seasonStartedAt: Date,
): boolean {
  const lastActivity = stable.lastLoginAt ?? stable.createdAt;
  return lastActivity.getTime() < seasonStartedAt.getTime();
}

/** When the season `seasonNumber` started, or null when it has no row. */
export async function seasonStartedAt(seasonNumber: number): Promise<Date | null> {
  const row = await prisma.season.findUnique({ where: { seasonNumber }, select: { startedAt: true } });
  return row?.startedAt ?? null;
}

/** Ids of the dormant human stables of a season, oldest first. */
export async function findDormantHumanStableIds(startedAt: Date): Promise<number[]> {
  const rows = await prisma.user.findMany({
    where: dormantHumanStableWhere(startedAt),
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  return rows.map((row) => row.id);
}

/** Count and the first names (stable name, else username) for the rollover preview. */
export async function previewDormantHumanStables(startedAt: Date): Promise<{ count: number; names: string[] }> {
  const where = dormantHumanStableWhere(startedAt);
  const [count, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: { username: true, stableName: true },
      orderBy: { id: 'asc' },
      take: DORMANT_PREVIEW_NAME_LIMIT,
    }),
  ]);
  return { count, names: rows.map((row) => row.stableName ?? row.username) };
}
