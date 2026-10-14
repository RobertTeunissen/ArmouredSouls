/**
 * League instance placement inside a caller's transaction.
 *
 * Picks the league instance a new standings row should join. The pick runs on the
 * caller's transaction client under a mode/tier advisory lock, so concurrent
 * placements into the same mode and tier serialise and the instance counts they
 * read are current.
 *
 * This module deliberately imports neither `lib/prisma` nor `config/logger`
 * (only Prisma *types*): `prisma/seed.ts` owns its own `PrismaClient` and is
 * imported by unit tests, so anything it reaches must stay singleton-free.
 *
 * @module services/league/leagueInstancePlacement
 */

import type { Prisma, StandingsMode } from '../../../generated/prisma';

/** Maximum entities per league instance (unified across all modes). */
export const MAX_ENTITIES_PER_INSTANCE = 100;

/**
 * Advisory lock key for placements into `mode` + `tier`.
 *
 * The algorithm and the hashed string (`${mode}_${tier}`) are unchanged from the
 * former `hashTierName` in `leagueInstanceService`, so every caller keeps
 * contending on the same key.
 */
export function leagueInstanceLockKey(mode: string, tier: string): number {
  const name = `${mode}_${tier}`;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % 2147483647;
}

function instanceNumberOf(leagueInstanceId: string): number {
  return parseInt(leagueInstanceId.split('_')[1] || '1');
}

/**
 * Pick the instance a new entity joins in `mode` + `tier`, holding the
 * mode/tier advisory lock for the rest of the transaction.
 *
 * - No rows yet: `${tier}_1`.
 * - Otherwise the least-full instance; ties go to the lowest instance number.
 * - If even the least-full instance holds `maxPerInstance` or more rows, a new
 *   instance `${tier}_${highestNumber + 1}` is opened.
 */
export async function pickLeagueInstanceInTransaction(
  tx: Prisma.TransactionClient,
  mode: StandingsMode,
  tier: string,
  maxPerInstance: number,
): Promise<string> {
  const lockKey = leagueInstanceLockKey(mode, tier);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

  const groups = await tx.standing.groupBy({
    by: ['leagueInstanceId'],
    where: { mode, tier },
    _count: { id: true },
  });

  if (groups.length === 0) {
    return `${tier}_1`;
  }

  const instances = groups
    .map((group) => ({
      leagueId: group.leagueInstanceId,
      instanceNumber: instanceNumberOf(group.leagueInstanceId),
      count: group._count.id,
    }))
    .sort((a, b) => a.count - b.count || a.instanceNumber - b.instanceNumber);

  const leastFull = instances[0];
  if (leastFull.count >= maxPerInstance) {
    const highest = Math.max(...instances.map((instance) => instance.instanceNumber));
    return `${tier}_${highest + 1}`;
  }

  return leastFull.leagueId;
}
