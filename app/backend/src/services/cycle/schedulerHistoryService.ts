/**
 * Read side of the scheduler history for Cycle Controls (`/admin/cycles`).
 *
 * - `getSchedulerOverview`: status strip and the daily schedule (each slot's
 *   last run, from the database so it survives restarts) plus the missed runs
 *   of the last 7 days.
 * - `listSchedulerRuns`: runs, "backend restarted" markers and missed runs,
 *   merged newest first, filterable and paginated.
 * - `getSchedulerRun`: one run.
 *
 * Read-only. Job labels are the frontend's; this returns job names.
 */
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { getSchedulerState } from './cycleScheduler';
import { getCurrentProcessId } from './schedulerRunStore';
import { findMissedRuns, parseDailyCron, type MissedRun } from './schedulerMissedRuns';
import { getCurrentSeason } from '../season/seasonService';
import { SchedulerError, SchedulerErrorCode } from '../../errors/schedulerErrors';
import type { SchedulerRunStatus, SchedulerRunSummary, SchedulerRunTrigger } from '../../types';

const DAY_MS = 24 * 60 * 60_000;
/** The overview's missed-run banner looks back this far. */
export const OVERVIEW_MISSED_WINDOW_DAYS = 7;
/** History never reaches further back than this. */
export const MAX_HISTORY_DAYS = 30;

export interface SchedulerRunView {
  id: number;
  jobName: string;
  trigger: SchedulerRunTrigger;
  triggeredBy: { userId: number; username: string | null } | null;
  status: SchedulerRunStatus;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  summary: SchedulerRunSummary | null;
  error: string | null;
}

export interface MissedRunView {
  jobName: string;
  expectedAt: string;
  downtime: { from: string; to: string } | null;
}

export interface SchedulerSlotView {
  jobName: string;
  schedule: string;
  /** "HH:MM" in UTC, or null for a non-daily schedule. */
  time: string | null;
  nextRunAt: string | null;
  lastRun: SchedulerRunView | null;
  /** A queued or running run of this job in this process. */
  activeRun: SchedulerRunView | null;
}

export interface SchedulerOverview {
  scheduler: {
    active: boolean;
    process: { id: number; startedAt: string; deployTag: string | null } | null;
  };
  season: { number: number; phase: string; seasonCycle: number } | null;
  cycle: { number: number };
  running: SchedulerRunView | null;
  queue: SchedulerRunView[];
  next: { jobName: string; at: string } | null;
  slots: SchedulerSlotView[];
  missed: { windowDays: number; runs: MissedRunView[] };
  timestamp: string;
}

export type SchedulerHistoryEntry =
  | { kind: 'run'; at: string; run: SchedulerRunView }
  | { kind: 'restart'; at: string; restart: { processId: number; deployTag: string | null; schedulerEnabled: boolean; downSince: string | null } }
  | { kind: 'missed'; at: string; missed: MissedRunView };

export interface SchedulerHistoryPage {
  entries: SchedulerHistoryEntry[];
  page: number;
  limit: number;
  total: number;
  windowDays: number;
}

interface RunRow {
  id: number;
  jobName: string;
  trigger: string;
  triggeredByUserId: number | null;
  status: string;
  queuedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
  summary: unknown;
  error: string | null;
}

const RUN_SELECT = {
  id: true,
  jobName: true,
  trigger: true,
  triggeredByUserId: true,
  status: true,
  queuedAt: true,
  startedAt: true,
  finishedAt: true,
  durationMs: true,
  summary: true,
  error: true,
} as const;

async function usernamesFor(rows: readonly RunRow[]): Promise<Map<number, string>> {
  const ids = [...new Set(rows.map((row) => row.triggeredByUserId).filter((id): id is number => id !== null))];
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true } });
  return new Map(users.map((user) => [user.id, user.username]));
}

function toRunView(row: RunRow, usernames: ReadonlyMap<number, string>): SchedulerRunView {
  return {
    id: row.id,
    jobName: row.jobName,
    trigger: row.trigger as SchedulerRunTrigger,
    triggeredBy: row.triggeredByUserId === null
      ? null
      : { userId: row.triggeredByUserId, username: usernames.get(row.triggeredByUserId) ?? null },
    status: row.status as SchedulerRunStatus,
    queuedAt: row.queuedAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    durationMs: row.durationMs,
    summary: (row.summary as unknown as SchedulerRunSummary | null) ?? null,
    error: row.error,
  };
}

function toMissedView(missed: MissedRun): MissedRunView {
  return {
    jobName: missed.jobName,
    expectedAt: missed.expectedAt.toISOString(),
    downtime: missed.downtime ? { from: missed.downtime.from.toISOString(), to: missed.downtime.to.toISOString() } : null,
  };
}

/** "HH:MM" of a daily cron. */
function slotTime(schedule: string): string | null {
  const time = parseDailyCron(schedule);
  return time ? `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}` : null;
}

/** Minutes after midnight, for ordering the slots; non-daily schedules last. */
function slotOrder(schedule: string): number {
  const time = parseDailyCron(schedule);
  return time ? time.hour * 60 + time.minute : Number.MAX_SAFE_INTEGER;
}

async function missedSince(from: Date, now: Date, jobName?: string): Promise<MissedRun[]> {
  const jobs = getSchedulerState().jobs
    .filter((job) => jobName === undefined || job.name === jobName)
    .map((job) => ({ jobName: job.name, schedule: job.schedule }));
  if (jobs.length === 0) return [];
  const select = { id: true, startedAt: true, lastHeartbeatAt: true, schedulerEnabled: true } as const;
  const [before, inWindow, runs] = await Promise.all([
    // The process running at `from` (if any) decides whether the window's first
    // slots were expected. Without one, tracking starts inside the window.
    prisma.schedulerProcess.findFirst({ where: { startedAt: { lt: from } }, orderBy: { startedAt: 'desc' }, select }),
    prisma.schedulerProcess.findMany({ where: { startedAt: { gte: from } }, orderBy: { startedAt: 'asc' }, select }),
    prisma.schedulerJobRun.findMany({
      where: { queuedAt: { gte: new Date(from.getTime() - 60_000) }, trigger: { in: ['cron', 'resume'] } },
      select: { jobName: true, trigger: true, queuedAt: true },
    }),
  ]);
  const processes = before ? [before, ...inWindow] : inWindow;
  return findMissedRuns({ jobs, processes, runs, from, now });
}

/** Everything the status strip, schedule and missed-run banner show. */
export async function getSchedulerOverview(now: Date = new Date()): Promise<SchedulerOverview> {
  const state = getSchedulerState();
  const processId = getCurrentProcessId();

  const [process, cycleMetadata, season, activeRows, missed] = await Promise.all([
    processId === null
      ? Promise.resolve(null)
      : prisma.schedulerProcess.findUnique({ where: { id: processId }, select: { id: true, startedAt: true, deployTag: true } }),
    prisma.cycleMetadata.findUnique({ where: { id: 1 }, select: { totalCycles: true } }),
    getCurrentSeason().catch((error: unknown) => {
      logger.error(`[SchedulerHistory] season unavailable — ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }),
    processId === null
      ? Promise.resolve([] as RunRow[])
      : prisma.schedulerJobRun.findMany({
        where: { processId, status: { in: ['queued', 'running'] } },
        select: RUN_SELECT,
        orderBy: { queuedAt: 'asc' },
      }),
    missedSince(new Date(now.getTime() - OVERVIEW_MISSED_WINDOW_DAYS * DAY_MS), now),
  ]);

  // The latest run of every job, one query per job keeps each on the (job_name, queued_at) index.
  const lastRows: Array<RunRow | null> = await Promise.all(state.jobs.map((job) => prisma.schedulerJobRun.findFirst({
    where: { jobName: job.name, status: { notIn: ['queued', 'running'] } },
    select: RUN_SELECT,
    orderBy: { queuedAt: 'desc' },
  })));
  const allRows: RunRow[] = [...activeRows, ...lastRows.filter((row): row is RunRow => row !== null)];
  const usernames = await usernamesFor(allRows);

  const active = activeRows.map((row) => toRunView(row, usernames));
  const running = active.find((run) => run.status === 'running') ?? null;
  const queue = active.filter((run) => run.status === 'queued');

  const slots: SchedulerSlotView[] = state.jobs
    .map((job, index) => ({
      jobName: job.name,
      schedule: job.schedule,
      time: slotTime(job.schedule),
      nextRunAt: job.nextRunAt ? new Date(job.nextRunAt).toISOString() : null,
      lastRun: lastRows[index] ? toRunView(lastRows[index] as RunRow, usernames) : null,
      activeRun: active.find((run) => run.jobName === job.name) ?? null,
    }))
    .sort((a, b) => slotOrder(a.schedule) - slotOrder(b.schedule));

  const upcoming = slots
    .filter((slot): slot is SchedulerSlotView & { nextRunAt: string } => slot.nextRunAt !== null)
    .sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())[0];

  return {
    scheduler: {
      active: state.active,
      process: process ? { id: process.id, startedAt: process.startedAt.toISOString(), deployTag: process.deployTag } : null,
    },
    season: season ? { number: season.seasonNumber, phase: season.phase, seasonCycle: season.seasonCycle } : null,
    cycle: { number: cycleMetadata?.totalCycles ?? 0 },
    running,
    queue,
    next: upcoming ? { jobName: upcoming.jobName, at: upcoming.nextRunAt } : null,
    slots,
    missed: { windowDays: OVERVIEW_MISSED_WINDOW_DAYS, runs: missed.map(toMissedView) },
    timestamp: now.toISOString(),
  };
}

export interface SchedulerHistoryQuery {
  jobName?: string;
  problemsOnly?: boolean;
  days?: number;
  page?: number;
  limit?: number;
}

const PROBLEM_STATUSES: ReadonlySet<string> = new Set(['failed', 'interrupted']);

/** Runs, restart markers and missed runs in the window, newest first. */
export async function listSchedulerRuns(query: SchedulerHistoryQuery, now: Date = new Date()): Promise<SchedulerHistoryPage> {
  const days = Math.min(Math.max(1, query.days ?? 7), MAX_HISTORY_DAYS);
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(Math.max(1, query.limit ?? 25), 100);
  const from = new Date(now.getTime() - days * DAY_MS);

  const [runRows, processes, missed] = await Promise.all([
    prisma.schedulerJobRun.findMany({
      where: {
        queuedAt: { gte: from },
        ...(query.jobName ? { jobName: query.jobName } : {}),
        ...(query.problemsOnly ? { status: { in: [...PROBLEM_STATUSES] } } : {}),
      },
      select: RUN_SELECT,
      orderBy: { queuedAt: 'desc' },
    }),
    prisma.schedulerProcess.findMany({
      where: { startedAt: { gte: from } },
      select: { id: true, startedAt: true, deployTag: true, schedulerEnabled: true },
      orderBy: { startedAt: 'asc' },
    }),
    missedSince(from, now, query.jobName),
  ]);

  // The heartbeat of the process before each start dates the downtime.
  const previous = await Promise.all(processes.map((process) => prisma.schedulerProcess.findFirst({
    where: { startedAt: { lt: process.startedAt } },
    orderBy: { startedAt: 'desc' },
    select: { lastHeartbeatAt: true },
  })));

  const usernames = await usernamesFor(runRows);
  const entries: SchedulerHistoryEntry[] = [
    ...runRows.map((row): SchedulerHistoryEntry => ({ kind: 'run', at: row.queuedAt.toISOString(), run: toRunView(row, usernames) })),
    ...processes.map((process, index): SchedulerHistoryEntry => ({
      kind: 'restart',
      at: process.startedAt.toISOString(),
      restart: {
        processId: process.id,
        deployTag: process.deployTag,
        schedulerEnabled: process.schedulerEnabled,
        downSince: previous[index]?.lastHeartbeatAt.toISOString() ?? null,
      },
    })),
    ...missed.map((entry): SchedulerHistoryEntry => ({ kind: 'missed', at: entry.expectedAt.toISOString(), missed: toMissedView(entry) })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const start = (page - 1) * limit;
  return { entries: entries.slice(start, start + limit), page, limit, total: entries.length, windowDays: days };
}

/** One run, or `SchedulerError` 404. */
export async function getSchedulerRun(id: number): Promise<SchedulerRunView> {
  const row = await prisma.schedulerJobRun.findUnique({ where: { id }, select: RUN_SELECT });
  if (!row) throw new SchedulerError(SchedulerErrorCode.RUN_NOT_FOUND, 'Run not found', 404);
  return toRunView(row, await usernamesFor([row]));
}
