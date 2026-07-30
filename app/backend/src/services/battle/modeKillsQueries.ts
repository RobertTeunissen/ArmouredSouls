/**
 * Per-battle-type destruction tally — read helpers.
 *
 * `robot_mode_kills` is the single source of truth for how many opponents a
 * robot has written off in a given battle type. `robots.kills` holds the same
 * figure summed across every type.
 *
 * These counts used to live in `standings.total_kills`, which only worked for
 * KotH and Grand Melee: standings rows for the team modes belong to the team,
 * not the robot, and matchmaking reads standings by `mode` alone and treats
 * every `entity_id` as its own entity type.
 *
 * @module services/battle/modeKillsQueries
 */

import prisma from '../../lib/prisma';
import type { StandingsMode } from '../../../generated/prisma';

/** Destructions a single robot has inflicted in one battle type. */
export async function getModeKills(robotId: number, mode: StandingsMode): Promise<number> {
  const row = await prisma.robotModeKills.findUnique({
    where: { robotId_mode: { robotId, mode } },
    select: { kills: true },
  });
  return row?.kills ?? 0;
}

/**
 * Destructions for many robots in one battle type, keyed by robot id.
 *
 * Robots with no tally are absent from the map — read through `?? 0`. Returns an
 * empty map for an empty input rather than querying for `IN ()`.
 */
export async function getModeKillsMap(
  robotIds: number[],
  mode: StandingsMode,
): Promise<Map<number, number>> {
  if (robotIds.length === 0) return new Map();

  const rows = await prisma.robotModeKills.findMany({
    where: { mode, robotId: { in: robotIds } },
    select: { robotId: true, kills: true },
  });

  return new Map(rows.map((r) => [r.robotId, r.kills]));
}

/**
 * Top robots by destructions in one battle type, highest first.
 *
 * Robots with no destructions are excluded, so an untouched mode yields an empty
 * list instead of a page of zeroes.
 */
export async function getTopModeKills(
  mode: StandingsMode,
  take: number,
): Promise<Array<{ robotId: number; kills: number }>> {
  const rows = await prisma.robotModeKills.findMany({
    where: { mode, kills: { gt: 0 } },
    orderBy: [{ kills: 'desc' }, { robotId: 'asc' }],
    take,
    select: { robotId: true, kills: true },
  });

  return rows.map((r) => ({ robotId: r.robotId, kills: r.kills }));
}
