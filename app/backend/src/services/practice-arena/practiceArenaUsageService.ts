/**
 * Practice Arena usage (admin Practice Arena page).
 *
 * Every Practice Arena request writes one `practice_arena_events` row: the
 * battles it ran, or why it was refused (rate limit, or a scheduler job
 * holding the lock). The admin overview aggregates those rows by UTC day, adds
 * the season totals from each stable's `totalPracticeBattles` counter, and the
 * time the arena was unavailable from the scheduler run history.
 *
 * Recording never fails a request: a failed write is logged and dropped.
 *
 * @module services/practice-arena/practiceArenaUsageService
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import type { PracticeBattleRequest } from './practiceArenaService';

export const PRACTICE_OUTCOMES = ['battle', 'rate_limited', 'cycle_busy'] as const;
export type PracticeOutcome = (typeof PRACTICE_OUTCOMES)[number];

export const PRACTICE_MATCHUPS = ['owned_vs_sparring', 'owned_vs_owned', 'sparring_vs_sparring'] as const;
export type PracticeMatchup = (typeof PRACTICE_MATCHUPS)[number];

export const PRACTICE_BOT_TIERS = ['WimpBot', 'AverageBot', 'ExpertBot', 'UltimateBot'] as const;

/** Days of history on the admin page (today included). */
export const OVERVIEW_DAYS = 30;
/** Players listed under "Top practitioners". */
export const TOP_PRACTITIONERS = 10;
/** The migration that started recording events; its finish time bounds the history. */
export const EVENTS_MIGRATION = '20261023140000_practice_arena_events';

const DAY_MS = 86_400_000;

// ─── Recording ───────────────────────────────────────────────────────

export interface RequestClassification {
  matchup: PracticeMatchup | null;
  botTier: string | null;
  overrides: boolean;
}

/** Matchup, the sparring opponent's tier and whether what-if overrides were used. */
export function classifyRequest(request: PracticeBattleRequest | null | undefined): RequestClassification {
  if (!request?.robot1 || !request.robot2) return { matchup: null, botTier: null, overrides: false };
  const slots = [request.robot1, request.robot2];
  const sparring = slots.filter((slot) => slot.type === 'sparring');
  const matchup: PracticeMatchup = sparring.length === 0 ? 'owned_vs_owned' : sparring.length === 1 ? 'owned_vs_sparring' : 'sparring_vs_sparring';
  // The opponent: the second slot when it is a sparring partner (the player's
  // robot goes in the first), otherwise the first.
  const opponent = request.robot2.type === 'sparring' ? request.robot2 : request.robot1;
  const overrides = slots.some((slot) => slot.type === 'owned' && slot.overrides !== undefined
    && Object.values(slot.overrides).some((value) => value !== undefined && !(typeof value === 'object' && value !== null && Object.keys(value).length === 0)));
  return { matchup, botTier: opponent.type === 'sparring' ? opponent.config.botTier : null, overrides };
}

export interface PracticeRequestRecord {
  userId: number;
  outcome: PracticeOutcome;
  /** Battles requested (clamped to 1–10). */
  requested: number;
  /** The validated request, when there is one (refusals before validation have none). */
  request?: PracticeBattleRequest | null;
  at?: Date;
}

/** Record one request. Never rejects: a failed write is logged and dropped. */
export async function recordPracticeRequest(record: PracticeRequestRecord): Promise<void> {
  const requested = Number.isInteger(record.requested) ? Math.min(10, Math.max(1, record.requested)) : 1;
  const { matchup, botTier, overrides } = classifyRequest(record.request);
  try {
    await prisma.practiceArenaEvent.create({
      data: {
        userId: record.userId,
        outcome: record.outcome,
        requested,
        battles: record.outcome === 'battle' ? requested : 0,
        matchup,
        botTier,
        overrides,
        ...(record.at ? { occurredAt: record.at } : {}),
      },
    });
  } catch (error) {
    logger.error(`[PracticeArena] could not record a ${record.outcome} event for user ${record.userId} — ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ─── Aggregation (pure) ──────────────────────────────────────────────

export interface UsageEvent {
  userId: number;
  occurredAt: Date;
  outcome: string;
  requested: number;
  battles: number;
  matchup: string | null;
  botTier: string | null;
  overrides: boolean;
}

export interface LockInterval {
  start: Date;
  end: Date;
}

export interface PracticeDayStats {
  /** "YYYY-MM-DD" (UTC). */
  date: string;
  battles: number;
  /** Requests that ran battles. */
  requests: number;
  /** Players who ran at least one battle. */
  players: number;
  rateLimited: number;
  cycleBusy: number;
  /** Time a scheduler job held the lock (practice refused); null before run history. */
  unavailableMs: number | null;
  /** False for days before recording started (or before this season): no data, not zero. */
  recorded: boolean;
}

export interface PracticeUsage {
  battles: number;
  requests: number;
  /** Battles per matchup. */
  matchups: Record<PracticeMatchup, number>;
  /** Battles per sparring-partner tier (requests with a sparring partner). */
  botTiers: Record<string, number>;
  /** Requests by batch size. */
  batchSizes: { single: number; small: number; large: number };
  /** Requests where an owned robot carried what-if overrides. */
  overridesRequests: number;
}

export const utcDayKey = (date: Date): string => date.toISOString().slice(0, 10);

const dayStart = (key: string): number => Date.parse(`${key}T00:00:00.000Z`);

/** The last `days` UTC day keys, newest (today) first. */
export function lastUtcDays(now: Date, days: number): string[] {
  const today = dayStart(utcDayKey(now));
  return Array.from({ length: days }, (_, index) => utcDayKey(new Date(today - index * DAY_MS)));
}

/** Union of the intervals (the lock is exclusive, but a rollover runs inside settlement). */
export function mergeIntervals(intervals: readonly LockInterval[]): LockInterval[] {
  const sorted = intervals
    .filter((interval) => interval.end.getTime() > interval.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: LockInterval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start.getTime() <= last.end.getTime()) {
      if (interval.end.getTime() > last.end.getTime()) last.end = interval.end;
    } else {
      merged.push({ start: interval.start, end: interval.end });
    }
  }
  return merged;
}

/** Milliseconds of each day covered by the intervals, clipped to `now`. */
export function unavailableByDay(intervals: readonly LockInterval[], dayKeys: readonly string[], now: Date): Map<string, number> {
  const merged = mergeIntervals(intervals);
  const result = new Map<string, number>();
  for (const key of dayKeys) {
    const from = dayStart(key);
    const to = Math.min(from + DAY_MS, now.getTime());
    let total = 0;
    for (const interval of merged) {
      const start = Math.max(from, interval.start.getTime());
      const end = Math.min(to, interval.end.getTime());
      if (end > start) total += end - start;
    }
    result.set(key, total);
  }
  return result;
}

/**
 * One row per day, newest first. A day before `recordingSince` reports no
 * data (`recorded: false`); its unavailable time is null before
 * `lockTrackingSince` (no run history yet).
 */
export function aggregateDays(input: {
  events: readonly UsageEvent[];
  intervals: readonly LockInterval[];
  now: Date;
  days: number;
  recordingSince: Date | null;
  lockTrackingSince: Date | null;
}): PracticeDayStats[] {
  const keys = lastUtcDays(input.now, input.days);
  const unavailable = unavailableByDay(input.intervals, keys, input.now);
  const rows = new Map<string, PracticeDayStats & { playerIds: Set<number> }>();
  for (const key of keys) {
    const end = dayStart(key) + DAY_MS;
    rows.set(key, {
      date: key,
      battles: 0,
      requests: 0,
      players: 0,
      rateLimited: 0,
      cycleBusy: 0,
      unavailableMs: input.lockTrackingSince && input.lockTrackingSince.getTime() < end ? unavailable.get(key) ?? 0 : null,
      recorded: input.recordingSince !== null && input.recordingSince.getTime() < end,
      playerIds: new Set<number>(),
    });
  }
  for (const event of input.events) {
    const row = rows.get(utcDayKey(event.occurredAt));
    if (!row) continue;
    if (event.outcome === 'battle') {
      row.battles += event.battles;
      row.requests += 1;
      row.playerIds.add(event.userId);
    } else if (event.outcome === 'rate_limited') {
      row.rateLimited += 1;
    } else if (event.outcome === 'cycle_busy') {
      row.cycleBusy += 1;
    }
  }
  return keys.map((key) => {
    const { playerIds, ...row } = rows.get(key)!;
    return { ...row, players: playerIds.size };
  });
}

/** What the battles of the window were: matchups, tiers, batch sizes, overrides. */
export function aggregateUsage(events: readonly UsageEvent[]): PracticeUsage {
  const usage: PracticeUsage = {
    battles: 0,
    requests: 0,
    matchups: { owned_vs_sparring: 0, owned_vs_owned: 0, sparring_vs_sparring: 0 },
    botTiers: Object.fromEntries(PRACTICE_BOT_TIERS.map((tier) => [tier, 0])),
    batchSizes: { single: 0, small: 0, large: 0 },
    overridesRequests: 0,
  };
  for (const event of events) {
    if (event.outcome !== 'battle') continue;
    usage.battles += event.battles;
    usage.requests += 1;
    if (event.matchup && event.matchup in usage.matchups) usage.matchups[event.matchup as PracticeMatchup] += event.battles;
    if (event.botTier) usage.botTiers[event.botTier] = (usage.botTiers[event.botTier] ?? 0) + event.battles;
    if (event.battles <= 1) usage.batchSizes.single += 1;
    else if (event.battles <= 5) usage.batchSizes.small += 1;
    else usage.batchSizes.large += 1;
    if (event.overrides) usage.overridesRequests += 1;
  }
  return usage;
}

// ─── Overview (DB) ───────────────────────────────────────────────────

export interface PracticeArenaOverview {
  timestamp: string;
  windowDays: number;
  /** When events started being recorded for this season (later of the migration and season start). */
  recordingSince: string | null;
  season: { number: number | null; battles: number; players: number };
  /** Newest (today) first. */
  days: PracticeDayStats[];
  topPractitioners: Array<{
    userId: number;
    username: string;
    stableName: string | null;
    battles: number;
    /** Latest recorded battle; null when all of it predates recording. */
    lastPracticeAt: string | null;
  }>;
  usage: PracticeUsage;
}

async function eventsMigrationFinishedAt(): Promise<Date | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ finished_at: Date | null }>>`
      SELECT finished_at FROM _prisma_migrations WHERE migration_name = ${EVENTS_MIGRATION} LIMIT 1`;
    return rows[0]?.finished_at ?? null;
  } catch (error) {
    logger.error(`[PracticeArena] could not read the migration history — ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** Everything the admin Practice Arena page shows. */
export async function getPracticeArenaOverview(now: Date = new Date()): Promise<PracticeArenaOverview> {
  const keys = lastUtcDays(now, OVERVIEW_DAYS);
  const from = new Date(dayStart(keys[keys.length - 1]));

  const [events, runs, firstProcess, season, seasonTotals, players, top, migratedAt] = await Promise.all([
    prisma.practiceArenaEvent.findMany({
      where: { occurredAt: { gte: from } },
      select: { userId: true, occurredAt: true, outcome: true, requested: true, battles: true, matchup: true, botTier: true, overrides: true },
    }),
    prisma.schedulerJobRun.findMany({
      where: { startedAt: { not: null }, OR: [{ finishedAt: null }, { finishedAt: { gte: from } }] },
      select: { startedAt: true, finishedAt: true },
    }),
    prisma.schedulerProcess.findFirst({ orderBy: { startedAt: 'asc' }, select: { startedAt: true } }),
    prisma.season.findFirst({ where: { phase: { not: 'completed' } }, orderBy: { seasonNumber: 'desc' }, select: { seasonNumber: true, startedAt: true } }),
    prisma.user.aggregate({ _sum: { totalPracticeBattles: true } }),
    prisma.user.count({ where: { totalPracticeBattles: { gt: 0 } } }),
    prisma.user.findMany({
      where: { totalPracticeBattles: { gt: 0 } },
      orderBy: [{ totalPracticeBattles: 'desc' }, { id: 'asc' }],
      take: TOP_PRACTITIONERS,
      select: { id: true, username: true, stableName: true, totalPracticeBattles: true },
    }),
    eventsMigrationFinishedAt(),
  ]);

  const last = top.length === 0 ? [] : await prisma.practiceArenaEvent.groupBy({
    by: ['userId'],
    where: { userId: { in: top.map((user) => user.id) }, outcome: 'battle' },
    _max: { occurredAt: true },
  });
  const lastByUser = new Map(last.map((row) => [row.userId, row._max.occurredAt]));

  // Recording covers this season only: events are emptied at rollover.
  const starts = [migratedAt, season?.startedAt ?? null].filter((date): date is Date => date !== null);
  const recordingSince = migratedAt === null ? null : new Date(Math.max(...starts.map((date) => date.getTime())));

  const intervals: LockInterval[] = runs
    .filter((run): run is typeof run & { startedAt: Date } => run.startedAt !== null)
    // A queued-then-running run without an end is still holding the lock (or the process died; then it is marked interrupted at the next start).
    .map((run) => ({ start: run.startedAt, end: run.finishedAt ?? now }));

  return {
    timestamp: now.toISOString(),
    windowDays: OVERVIEW_DAYS,
    recordingSince: recordingSince?.toISOString() ?? null,
    season: { number: season?.seasonNumber ?? null, battles: seasonTotals._sum.totalPracticeBattles ?? 0, players },
    days: aggregateDays({ events, intervals, now, days: OVERVIEW_DAYS, recordingSince, lockTrackingSince: firstProcess?.startedAt ?? null }),
    topPractitioners: top.map((user) => ({
      userId: user.id,
      username: user.username,
      stableName: user.stableName,
      battles: user.totalPracticeBattles,
      lastPracticeAt: lastByUser.get(user.id)?.toISOString() ?? null,
    })),
    usage: aggregateUsage(events),
  };
}

/**
 * The original `GET /api/admin/practice-arena/stats` shape, now computed from
 * the events. `totalBattlesSinceStart` is this season's battles (it used to
 * count since the last restart).
 */
export async function getLegacyPracticeArenaStats(now: Date = new Date()): Promise<{
  current: { totalBattlesSinceStart: number; battlesToday: number; rateLimitHitsToday: number; uniquePlayersToday: number };
  history: Array<{ date: string; totalBattles: number; uniquePlayers: number; rateLimitHits: number }>;
}> {
  const overview = await getPracticeArenaOverview(now);
  const today = overview.days[0];
  return {
    current: {
      totalBattlesSinceStart: overview.season.battles,
      battlesToday: today.battles,
      rateLimitHitsToday: today.rateLimited,
      uniquePlayersToday: today.players,
    },
    history: overview.days
      .filter((day) => day.recorded)
      .map((day) => ({ date: day.date, totalBattles: day.battles, uniquePlayers: day.players, rateLimitHits: day.rateLimited })),
  };
}
