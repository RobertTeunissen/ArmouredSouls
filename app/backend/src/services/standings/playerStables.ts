/**
 * The player-facing "Stables" filter on the overviews (#595): every stable, or
 * only human players' entries (the admin portal's "Players"). Automatons and
 * generated filler stables are left out. Filtering never re-ranks: callers
 * keep each entry's place among all entries.
 *
 * Used by League Standings (per tier instance) and the Hall of Records.
 */
import prisma from '../../lib/prisma';
import type { StandingsMode } from '../../../generated/prisma';

export const STABLE_FILTERS = ['all', 'players'] as const;
export type StableFilter = typeof STABLE_FILTERS[number];

/** A human player's stable: the admin "Players" filter, minus seeded generated stables. */
export const PLAYER_STABLE = { stableType: 'human', isGenerated: false } as const;

/** Whether a stable row is a human player's (the same rule as `PLAYER_STABLE`). */
export function isPlayerStable(user: { stableType: string; isGenerated: boolean }): boolean {
  return user.stableType === PLAYER_STABLE.stableType && user.isGenerated === PLAYER_STABLE.isGenerated;
}

/** Entity ids (robots or teams, per the standings' entity type) owned by a player stable. */
export async function playerOwnedEntityIds(
  entityType: string,
  entityIds: readonly number[],
): Promise<Set<number>> {
  if (entityIds.length === 0) return new Set();
  const ids = [...new Set(entityIds)];
  const rows = entityType === 'robot'
    ? await prisma.robot.findMany({ where: { id: { in: ids }, user: PLAYER_STABLE }, select: { id: true } })
    : await prisma.teamBattle.findMany({ where: { id: { in: ids }, stable: PLAYER_STABLE }, select: { id: true } });
  return new Set(rows.map((row) => row.id));
}

/** Player entries per instance of one tier (instances without players are absent). */
export async function countPlayersPerInstance(mode: StandingsMode, tier: string): Promise<Map<string, number>> {
  const standings = await prisma.standing.findMany({
    where: { mode, tier },
    select: { entityType: true, entityId: true, leagueInstanceId: true },
  });
  const counts = new Map<string, number>();
  if (standings.length === 0) return counts;
  const players = await playerOwnedEntityIds(standings[0].entityType, standings.map((s) => s.entityId));
  for (const s of standings) {
    if (players.has(s.entityId)) counts.set(s.leagueInstanceId, (counts.get(s.leagueInstanceId) ?? 0) + 1);
  }
  return counts;
}
