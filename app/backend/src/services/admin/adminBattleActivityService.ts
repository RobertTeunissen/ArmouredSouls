/**
 * Admin dashboard battle activity: one row per battle mode.
 *
 * Definitions (shared with `/api/admin/stats` so the two cannot disagree):
 * - **Season**: every row in `battles`. The table is truncated at
 *   Season_Rollover, so it holds exactly the current season.
 * - **Last cycle**: battles created between the ends of the two most recent
 *   settlements (`cycle_snapshots.end_time`); null when there is no such pair.
 * - **Walkover**: a bye or a battle-time forfeit, detected the way the match
 *   history does: `is_bye_match` on the scheduling row, a forfeited
 *   participant, or a bracket row with status `forfeit`. Walkovers count as
 *   battles but are left out of the rates, since nothing was simulated.
 * - **Draw**: `winner_id IS NULL AND winning_side IS NULL` — team battles record
 *   their result in `winning_side` (see `resolveSideOutcome`).
 * - **Kill**: at least one participant `destroyed`.
 *
 * The filter keeps battles with at least one participant robot owned by a
 * filtered user. "Queued" is always system-wide.
 */
import prisma from '../../lib/prisma';
import { Prisma } from '../../../generated/prisma';
import { buildUserFilter, type UserFilterType } from '../../utils/buildUserFilter';
import { countQueuedMatchesByMode, DASHBOARD_BATTLE_MODES } from './adminQueuedMatches';

/** Modes where a draw cannot happen (placement modes always have a winner). */
const NO_DRAW_MODES: ReadonlySet<string> = new Set(['koth', 'grand_melee']);

/** Results are cached per filter: a season holds hundreds of thousands of battles. */
const CACHE_TTL_MS = 60_000;

export interface BattleActivityRow {
  mode: string;
  lastCycle: number | null;
  season: number;
  walkovers: number;
  queued: number;
  /** Percentage with one decimal over fought battles; null where draws cannot happen. */
  drawRate: number | null;
  /** Percentage with one decimal over fought battles. */
  killRate: number;
  /** Mean duration of fought battles, one decimal. */
  avgDurationSeconds: number;
}

export interface BattleActivity {
  rows: BattleActivityRow[];
  totals: Omit<BattleActivityRow, 'mode'>;
  lastCycleWindow: { cycleNumber: number; from: string; to: string } | null;
  timestamp: string;
}

/** One aggregated row as returned by the SQL. */
export interface RawBattleTypeAggregate {
  battleType: string;
  season: number;
  lastCycle: number | null;
  walkovers: number;
  fought: number;
  draws: number;
  kills: number;
  avgDuration: number;
}

interface RawBattleTypeRow {
  battle_type: string;
  season_total: bigint;
  last_cycle: bigint | null;
  walkovers: bigint;
  fought: bigint;
  draws: bigint;
  kills: bigint;
  avg_duration: number | null;
}

function oneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function rate(part: number, whole: number): number {
  return whole > 0 ? oneDecimal((part / whole) * 100) : 0;
}

function toRow(mode: string, raw: RawBattleTypeAggregate | undefined, queued: number, hasWindow: boolean): BattleActivityRow {
  const fought = raw?.fought ?? 0;
  return {
    mode,
    lastCycle: hasWindow ? raw?.lastCycle ?? 0 : null,
    season: raw?.season ?? 0,
    walkovers: raw?.walkovers ?? 0,
    queued,
    drawRate: NO_DRAW_MODES.has(mode) ? null : rate(raw?.draws ?? 0, fought),
    killRate: rate(raw?.kills ?? 0, fought),
    avgDurationSeconds: oneDecimal(raw?.avgDuration ?? 0),
  };
}

/**
 * Turn aggregates into display rows. Pure.
 *
 * Every dashboard mode gets a row, in a fixed order, even with no battles. A
 * `battle_type` outside that list (legacy data) is kept as its own row rather
 * than dropped, so the totals always equal the sum of the rows.
 */
export function toBattleActivityRows(
  raw: readonly RawBattleTypeAggregate[],
  queuedByMode: ReadonlyMap<string, number>,
  hasWindow: boolean,
): { rows: BattleActivityRow[]; totals: Omit<BattleActivityRow, 'mode'> } {
  const byType = new Map(raw.map((row) => [row.battleType, row]));
  const known = new Set<string>(DASHBOARD_BATTLE_MODES);
  const extraModes = raw.map((row) => row.battleType).filter((type) => !known.has(type)).sort();
  const modes: string[] = [...DASHBOARD_BATTLE_MODES, ...extraModes];
  const rows = modes.map((mode) => toRow(mode, byType.get(mode), queuedByMode.get(mode) ?? 0, hasWindow));

  let fought = 0;
  let draws = 0;
  let drawEligibleFought = 0;
  let kills = 0;
  let durationSum = 0;
  for (const row of raw) {
    fought += row.fought;
    kills += row.kills;
    durationSum += row.avgDuration * row.fought;
    if (!NO_DRAW_MODES.has(row.battleType)) {
      draws += row.draws;
      drawEligibleFought += row.fought;
    }
  }
  const sum = (pick: (row: BattleActivityRow) => number): number => rows.reduce((total, row) => total + pick(row), 0);

  return {
    rows,
    totals: {
      lastCycle: hasWindow ? sum((row) => row.lastCycle ?? 0) : null,
      season: sum((row) => row.season),
      walkovers: sum((row) => row.walkovers),
      queued: sum((row) => row.queued),
      drawRate: rate(draws, drawEligibleFought),
      killRate: rate(kills, fought),
      avgDurationSeconds: fought > 0 ? oneDecimal(durationSum / fought) : 0,
    },
  };
}

/** The window between the ends of the two most recent settlements, or null. */
async function readLastCycleWindow(): Promise<{ cycleNumber: number; from: Date; to: Date } | null> {
  const snapshots = await prisma.cycleSnapshot.findMany({
    orderBy: { cycleNumber: 'desc' },
    take: 2,
    select: { cycleNumber: true, endTime: true },
  });
  if (snapshots.length < 2) return null;
  return { cycleNumber: snapshots[0].cycleNumber, from: snapshots[1].endTime, to: snapshots[0].endTime };
}

/** Ids of the users in the filter, or null for "all" (no restriction). */
async function resolveFilterUserIds(filter: UserFilterType): Promise<number[] | null> {
  if (filter === 'all') return null;
  const users = await prisma.user.findMany({ where: buildUserFilter(filter), select: { id: true } });
  return users.map((user) => user.id);
}

/**
 * Aggregate `battles` per `battle_type`. `userIds` null means every battle;
 * otherwise only battles with a participant robot owned by one of them.
 * Exported for the integration test, which scopes it to its own fixture users.
 */
export async function aggregateBattles(
  userIds: number[] | null,
  window: { from: Date; to: Date } | null,
): Promise<RawBattleTypeAggregate[]> {
  if (userIds !== null && userIds.length === 0) return [];

  const ownerFilter = userIds === null
    ? Prisma.empty
    : Prisma.sql`WHERE EXISTS (
        SELECT 1 FROM "battle_participants" op
        JOIN "robots" r ON r.id = op.robot_id
        WHERE op.battle_id = b.id AND r.user_id = ANY(${userIds}::int[])
      )`;
  const lastCycle = window === null
    ? Prisma.sql`NULL::bigint`
    : Prisma.sql`COUNT(*) FILTER (WHERE s.created_at > ${window.from} AND s.created_at <= ${window.to})::bigint`;

  const rows = await prisma.$queryRaw<RawBattleTypeRow[]>`
    WITH scoped AS (
      SELECT
        b.battle_type,
        b.winner_id,
        b.winning_side,
        b.duration_seconds,
        b.created_at,
        (
          EXISTS (SELECT 1 FROM "scheduled_matches_v2" sm WHERE sm.battle_id = b.id AND sm.is_bye_match IS TRUE)
          OR EXISTS (
            SELECT 1 FROM "tournament_matches" tm
            WHERE tm.battle_id = b.id AND (tm.is_bye_match IS TRUE OR tm.status = 'forfeit')
          )
          OR EXISTS (SELECT 1 FROM "battle_participants" fp WHERE fp.battle_id = b.id AND fp.forfeited IS TRUE)
        ) AS walkover,
        EXISTS (SELECT 1 FROM "battle_participants" dp WHERE dp.battle_id = b.id AND dp.destroyed IS TRUE) AS has_kill
      FROM "battles" b
      ${ownerFilter}
    )
    SELECT
      s.battle_type,
      COUNT(*)::bigint AS season_total,
      ${lastCycle} AS last_cycle,
      COUNT(*) FILTER (WHERE s.walkover)::bigint AS walkovers,
      COUNT(*) FILTER (WHERE NOT s.walkover)::bigint AS fought,
      COUNT(*) FILTER (WHERE NOT s.walkover AND s.winner_id IS NULL AND s.winning_side IS NULL)::bigint AS draws,
      COUNT(*) FILTER (WHERE NOT s.walkover AND s.has_kill)::bigint AS kills,
      AVG(s.duration_seconds) FILTER (WHERE NOT s.walkover)::float8 AS avg_duration
    FROM scoped s
    GROUP BY s.battle_type
  `;

  return rows.map((row) => ({
    battleType: row.battle_type,
    season: Number(row.season_total),
    lastCycle: row.last_cycle === null ? null : Number(row.last_cycle),
    walkovers: Number(row.walkovers),
    fought: Number(row.fought),
    draws: Number(row.draws),
    kills: Number(row.kills),
    avgDuration: row.avg_duration === null ? 0 : Number(row.avg_duration),
  }));
}

const cache = new Map<UserFilterType, { expiresAt: number; value: BattleActivity }>();

/** Drop cached results (tests, and an explicit refresh). */
export function clearBattleActivityCache(): void {
  cache.clear();
}

/** Battle activity per mode for the dashboard filter. Cached for 60 s per filter. */
export async function getBattleActivity(
  filter: UserFilterType,
  options: { fresh?: boolean; now?: Date } = {},
): Promise<BattleActivity> {
  const now = options.now ?? new Date();
  const cached = cache.get(filter);
  if (!options.fresh && cached && cached.expiresAt > now.getTime()) return cached.value;

  const [window, userIds, queuedByMode] = await Promise.all([
    readLastCycleWindow(),
    resolveFilterUserIds(filter),
    countQueuedMatchesByMode(),
  ]);
  const raw = await aggregateBattles(userIds, window);
  const { rows, totals } = toBattleActivityRows(raw, queuedByMode, window !== null);

  const value: BattleActivity = {
    rows,
    totals,
    lastCycleWindow: window
      ? { cycleNumber: window.cycleNumber, from: window.from.toISOString(), to: window.to.toISOString() }
      : null,
    timestamp: now.toISOString(),
  };
  cache.set(filter, { expiresAt: now.getTime() + CACHE_TTL_MS, value });
  return value;
}
