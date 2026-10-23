/**
 * Rollover history of Season Control: every completed season with the
 * rollover that closed it and the attempts that failed before it.
 *
 * Sources, merged:
 * - `scheduler_job_runs` rows of job `seasonRollover` (every rollover since
 *   Season Control recorded runs, with stage progress);
 * - `admin_audit_logs` rows of type `season_rollover` older than the first such
 *   run (the rollovers before that, which only the audit trail recorded). Newer
 *   audit rows duplicate runs and are ignored.
 *
 * An attempt belongs to the season it tried to close: the season number in its
 * summary when it has one, otherwise the season that was current at the time.
 *
 * @module services/season/seasonRolloverHistoryService
 */

import prisma from '../../lib/prisma';
import { listSeasonsForBrowsing } from './seasonQueryService';
import {
  SEASON_ROLLOVER_JOB_NAME,
  type RolloverRunSummary,
  type RolloverStageName,
  type RolloverStageProgress,
  type SchedulerRunSummary,
} from '../../types/schedulerTypes';

export type RolloverAttemptStatus = 'success' | 'failed' | 'interrupted';

export interface RolloverAttemptView {
  source: 'run' | 'audit';
  id: number;
  /** When the attempt started (run) or was recorded (audit). */
  at: string;
  status: RolloverAttemptStatus;
  /** `manual` (admin) or `cron` (settlement). Audit rows are always admin rollovers. */
  trigger: 'manual' | 'cron';
  triggeredBy: { userId: number; username: string | null } | null;
  durationMs: number | null;
  error: string | null;
  /** The stage a failed run stopped at; null for audit rows and successes. */
  failedStage: RolloverStageName | null;
  /** Stage progress (runs only). */
  stages: RolloverStageProgress[] | null;
  result: RolloverRunSummary['result'];
}

export interface SeasonHistoryEntry {
  seasonNumber: number;
  isLegacy: boolean;
  startedAt: string;
  endedAt: string | null;
  competitiveCycles: number;
  humanStableCount: number;
  generatedStableCount: number;
  /** The rollover that closed this season, when one was recorded. */
  rollover: RolloverAttemptView | null;
  /** Earlier attempts on this season that did not complete, newest first. */
  failedAttempts: RolloverAttemptView[];
}

export interface SeasonRolloverHistory {
  /** Completed seasons, newest first. */
  seasons: SeasonHistoryEntry[];
  /** Attempts on the current season that did not complete, newest first. */
  currentSeasonAttempts: RolloverAttemptView[];
}

interface Attempt {
  view: RolloverAttemptView;
  seasonNumber: number | null;
}

interface AuditSummary {
  completedSeasonNumber?: unknown;
  seasonNumber?: unknown;
  error?: unknown;
  stablesArchived?: unknown;
  robotsArchived?: unknown;
  snapshotRows?: unknown;
  accoladeRows?: unknown;
  generatedStablesDeleted?: unknown;
  totalRowsPurged?: unknown;
  durations?: { archiveMs?: unknown; purgeMs?: unknown; postMs?: unknown; totalMs?: unknown };
}

const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const numOrNull = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function auditResult(summary: AuditSummary): RolloverAttemptView['result'] {
  return {
    stablesArchived: num(summary.stablesArchived),
    robotsArchived: num(summary.robotsArchived),
    snapshotRows: num(summary.snapshotRows),
    accoladeRows: num(summary.accoladeRows),
    generatedStablesDeleted: num(summary.generatedStablesDeleted),
    totalRowsPurged: num(summary.totalRowsPurged),
    durations: {
      archiveMs: num(summary.durations?.archiveMs),
      purgeMs: num(summary.durations?.purgeMs),
      postMs: num(summary.durations?.postMs),
      totalMs: num(summary.durations?.totalMs),
    },
  };
}

function runStatus(status: string): RolloverAttemptStatus | null {
  if (status === 'success' || status === 'failed' || status === 'interrupted') return status;
  return null;
}

/** Completed seasons with their rollovers, and the current season's failed attempts. */
export async function getSeasonRolloverHistory(): Promise<SeasonRolloverHistory> {
  const [seasons, current, runs] = await Promise.all([
    listSeasonsForBrowsing(),
    prisma.season.findFirst({ where: { phase: { not: 'completed' } }, orderBy: { seasonNumber: 'desc' }, select: { seasonNumber: true, startedAt: true } }),
    prisma.schedulerJobRun.findMany({
      where: { jobName: SEASON_ROLLOVER_JOB_NAME },
      orderBy: { queuedAt: 'desc' },
      select: { id: true, trigger: true, triggeredByUserId: true, status: true, queuedAt: true, startedAt: true, durationMs: true, summary: true, error: true },
    }),
  ]);

  const firstRunAt = runs.length > 0 ? runs[runs.length - 1].queuedAt : null;
  const audits = await prisma.adminAuditLog.findMany({
    where: { operationType: 'season_rollover', ...(firstRunAt ? { createdAt: { lt: firstRunAt } } : {}) },
    orderBy: { createdAt: 'desc' },
    select: { id: true, adminUserId: true, operationResult: true, resultSummary: true, createdAt: true },
  });

  const userIds = [...new Set([
    ...runs.map((run) => run.triggeredByUserId).filter((id): id is number => id !== null),
    ...audits.map((audit) => audit.adminUserId),
  ])];
  const users = userIds.length === 0 ? [] : await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true } });
  const usernames = new Map(users.map((user) => [user.id, user.username]));
  const who = (userId: number | null): RolloverAttemptView['triggeredBy'] =>
    userId === null ? null : { userId, username: usernames.get(userId) ?? null };

  const attempts: Attempt[] = [];
  for (const run of runs) {
    const status = runStatus(run.status);
    if (!status) continue; // queued / running: shown by the running view, not the history
    const rollover = (run.summary as unknown as SchedulerRunSummary | null)?.rollover ?? null;
    attempts.push({
      seasonNumber: rollover?.seasonNumber ?? null,
      view: {
        source: 'run',
        id: run.id,
        at: (run.startedAt ?? run.queuedAt).toISOString(),
        status,
        trigger: run.trigger === 'manual' ? 'manual' : 'cron',
        triggeredBy: who(run.triggeredByUserId),
        durationMs: run.durationMs,
        error: run.error,
        failedStage: rollover?.stages.find((stage) => stage.status === 'failed')?.stage ?? null,
        stages: rollover?.stages ?? null,
        result: rollover?.result ?? null,
      },
    });
  }
  for (const audit of audits) {
    const summary = (audit.resultSummary ?? {}) as unknown as AuditSummary;
    const success = audit.operationResult === 'success';
    attempts.push({
      seasonNumber: numOrNull(success ? summary.completedSeasonNumber : summary.seasonNumber),
      view: {
        source: 'audit',
        id: audit.id,
        at: audit.createdAt.toISOString(),
        status: success ? 'success' : 'failed',
        trigger: 'manual',
        triggeredBy: who(audit.adminUserId),
        durationMs: success ? numOrNull(summary.durations?.totalMs) : null,
        error: success ? null : (typeof summary.error === 'string' ? summary.error : null),
        failedStage: null,
        stages: null,
        result: success ? auditResult(summary) : null,
      },
    });
  }
  attempts.sort((a, b) => new Date(b.view.at).getTime() - new Date(a.view.at).getTime());

  // The season current at `at`: the newest one that had started by then.
  const timeline = [
    ...seasons.map((season) => ({ seasonNumber: season.seasonNumber, startedAt: season.startedAt })),
    ...(current ? [current] : []),
  ].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  const seasonAt = (at: string): number | null =>
    timeline.find((season) => season.startedAt.getTime() <= new Date(at).getTime())?.seasonNumber ?? null;

  const bySeason = new Map<number, RolloverAttemptView[]>();
  for (const attempt of attempts) {
    const seasonNumber = attempt.seasonNumber ?? seasonAt(attempt.view.at);
    if (seasonNumber === null) continue;
    bySeason.set(seasonNumber, [...(bySeason.get(seasonNumber) ?? []), attempt.view]);
  }

  return {
    seasons: seasons.map((season): SeasonHistoryEntry => {
      const views = bySeason.get(season.seasonNumber) ?? [];
      const rollover = views.find((view) => view.status === 'success') ?? null;
      return {
        seasonNumber: season.seasonNumber,
        isLegacy: season.isLegacy,
        startedAt: season.startedAt.toISOString(),
        endedAt: season.endedAt?.toISOString() ?? null,
        competitiveCycles: season.competitiveCycles,
        humanStableCount: season.humanStableCount,
        generatedStableCount: season.generatedStableCount,
        rollover,
        failedAttempts: views.filter((view) => view !== rollover && view.status !== 'success'),
      };
    }),
    currentSeasonAttempts: current ? (bySeason.get(current.seasonNumber) ?? []).filter((view) => view.status !== 'success') : [],
  };
}
