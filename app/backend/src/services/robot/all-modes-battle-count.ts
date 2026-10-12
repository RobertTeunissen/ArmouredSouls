/**
 * All-modes battle count (#532, #530).
 *
 * The one authoritative "battles played across every mode" figure for a robot.
 * Use it wherever the meaning is "how many battles has this robot played"
 * (streaming revenue, Finance Center breakdown, robot profile headline, Hall of
 * Records "Most Battles" and its season accolade).
 *
 * Query-time, no stored counter:
 *   allModes = robots.total_battles
 *            + standings.total_matches for every PLACEMENT_COUNTED_MODES row
 *
 * - `robots.total_battles` already counts league 1v1, tournaments (1v1/2v2/3v3),
 *   tag team (active and reserve) and 2v2/3v3 League. Do not add those again
 *   from team standings: that would double count them.
 * - KotH and Grand Melee pass `skipBattleCounters: true`, so they never touch
 *   `total_battles`; their matches live in `standings.total_matches`, the source
 *   of truth for competitive data. Placement-mode byes write no standing, so only
 *   fought matches are added.
 * - `robots.total_battles` stays the W/L/D denominator for win rates. Placement
 *   modes have no win/loss, so they must not be folded into that column.
 *
 * Both sides are current-season data (robots and standings are purged together at
 * rollover), so the sum never mixes seasons.
 */
import prisma from '../../lib/prisma';
import type { StandingsMode } from '../../../generated/prisma';

/**
 * Modes whose orchestrators call `updateRobotCombatStats` with
 * `skipBattleCounters: true`. Their matches are counted from
 * `standings.total_matches` instead of `robots.total_battles`.
 */
export const PLACEMENT_COUNTED_MODES: readonly StandingsMode[] = ['koth', 'grand_melee'];

/** Combine the stored win/loss-mode count with the placement-mode match count. */
export function combineAllModesBattleCount(totalBattles: number, placementMatches: number): number {
  return totalBattles + placementMatches;
}

/**
 * Placement-mode (KotH + Grand Melee) match counts per robot, in one query.
 * Robots without placement standings are absent from the map (treat as 0).
 */
export async function getPlacementMatchCounts(robotIds: readonly number[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  const ids = Array.from(new Set(robotIds));
  if (ids.length === 0) return counts;

  const rows = await prisma.standing.findMany({
    where: {
      entityType: 'robot',
      entityId: { in: ids },
      mode: { in: [...PLACEMENT_COUNTED_MODES] },
    },
    select: { entityId: true, totalMatches: true },
  });

  for (const row of rows) {
    counts.set(row.entityId, (counts.get(row.entityId) ?? 0) + (row.totalMatches ?? 0));
  }
  return counts;
}

/** All-modes battle count per robot id, in one query. */
export async function getAllModesBattleCounts(
  robots: ReadonlyArray<{ id: number; totalBattles: number }>,
): Promise<Map<number, number>> {
  const placement = await getPlacementMatchCounts(robots.map((r) => r.id));
  const result = new Map<number, number>();
  for (const robot of robots) {
    result.set(robot.id, combineAllModesBattleCount(robot.totalBattles, placement.get(robot.id) ?? 0));
  }
  return result;
}

/** All-modes battle count for one robot. */
export async function getAllModesBattleCount(robot: { id: number; totalBattles: number }): Promise<number> {
  const counts = await getAllModesBattleCounts([robot]);
  return counts.get(robot.id) ?? robot.totalBattles;
}

/** One ranked robot with the all-modes count the rank was computed on. */
export interface RankedAllModesBattleCount {
  robotId: number;
  allModesBattleCount: number;
}

/**
 * The `limit` robots with the highest all-modes battle count, best first, each
 * with that count (Hall of Records "Most Battles" and its season accolade).
 *
 * Ranked in SQL on the combined value, so a robot whose KotH / Grand Melee
 * matches lift it into the top N is never dropped by a pre-filter on
 * `total_battles`. Ties: more win/loss-mode battles first (the column the
 * ranking used before), then the lower robot id, so the order is deterministic.
 * Robots and standings are both current-season, so the ranking is too.
 *
 * The SQL sum is the same as `getAllModesBattleCounts` (total_battles + KotH and
 * Grand Melee total_matches, NULL as 0). The returned count is built from the
 * same row with `combineAllModesBattleCount`, so rank and displayed value come
 * from one read. Arithmetic is bigint: `SUM(int)` is bigint already, and int4 +
 * int4 overflows (PostgreSQL 22003) once the two parts pass 2^31 together.
 */
export async function getTopRobotsByAllModesBattleCount(limit: number): Promise<RankedAllModesBattleCount[]> {
  const rows = await prisma.$queryRaw<Array<{ id: number; total_battles: number; placement_matches: bigint }>>`
    SELECT r.id, r.total_battles, COALESCE(p.placement_matches, 0::bigint) AS placement_matches
    FROM robots r
    LEFT JOIN (
      SELECT s.entity_id, SUM(COALESCE(s.total_matches, 0))::bigint AS placement_matches
      FROM standings s
      WHERE s.entity_type = 'robot'
        AND s.mode::text = ANY(${[...PLACEMENT_COUNTED_MODES]}::text[])
      GROUP BY s.entity_id
    ) p ON p.entity_id = r.id
    ORDER BY r.total_battles::bigint + COALESCE(p.placement_matches, 0::bigint) DESC, r.total_battles DESC, r.id ASC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({
    robotId: row.id,
    allModesBattleCount: combineAllModesBattleCount(Number(row.total_battles), Number(row.placement_matches)),
  }));
}
