/**
 * Persistent scheduler history: which backend process is running, and every
 * job run it queued, started and finished.
 *
 * The scheduler keeps its working state in memory (the lock, the queue, the
 * per-job last run) and that resets on every restart. This store only records
 * what happened, so Cycle Controls can show runs across deploys and explain a
 * missed or interrupted run with the downtime around it.
 *
 * Every write is non-fatal: a database hiccup is logged and never fails or
 * delays a job. Read helpers live in `schedulerHistoryService.ts`.
 */
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { Prisma } from '../../../generated/prisma';
import type { SchedulerRunStatus, SchedulerRunSummary, SchedulerRunTrigger } from '../../types';

/** How often the running process proves it is alive. */
export const SCHEDULER_HEARTBEAT_INTERVAL_MS = 60_000;

/** Stored errors are trimmed to the column width. */
const MAX_ERROR_LENGTH = 500;

let currentProcessId: number | null = null;
let currentProcessStartedAt: Date | null = null;
let heartbeat: NodeJS.Timeout | null = null;

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The id of this process's `scheduler_processes` row, or null before `startProcess`. */
export function getCurrentProcessId(): number | null {
  return currentProcessId;
}

/** When this process registered itself, or null before `startProcess`. */
export function getCurrentProcessStartedAt(): Date | null {
  return currentProcessStartedAt;
}

/**
 * Register this backend process, close out runs a previous process left
 * `queued` or `running` (it stopped before they finished, typically a deploy),
 * and start the heartbeat. Never throws.
 */
export async function startProcess(options: { schedulerEnabled: boolean; deployTag?: string | null; now?: Date }): Promise<number | null> {
  const now = options.now ?? new Date();
  try {
    const process = await prisma.schedulerProcess.create({
      data: {
        startedAt: now,
        lastHeartbeatAt: now,
        schedulerEnabled: options.schedulerEnabled,
        deployTag: options.deployTag?.slice(0, 80) || null,
      },
    });
    currentProcessId = process.id;
    currentProcessStartedAt = process.startedAt;

    await markInterruptedRuns(process.id);
    startHeartbeat(process.id);
    return process.id;
  } catch (error) {
    logger.error(`[SchedulerRuns] could not register the backend process — ${describe(error)}`);
    return null;
  }
}

/**
 * Runs of earlier processes that never finished were cut off by that process
 * stopping. They end at the process's last heartbeat, the last moment it was
 * known to be alive.
 */
async function markInterruptedRuns(currentId: number): Promise<void> {
  const updated = await prisma.$executeRaw(Prisma.sql`
    UPDATE "scheduler_job_runs" r
    SET "status" = 'interrupted',
        "finished_at" = p."last_heartbeat_at",
        "duration_ms" = CASE
          WHEN r."started_at" IS NULL THEN NULL
          ELSE GREATEST(0, (EXTRACT(EPOCH FROM (p."last_heartbeat_at" - r."started_at")) * 1000)::int)
        END,
        "error" = 'The backend stopped before the run finished'
    FROM "scheduler_processes" p
    WHERE r."process_id" = p."id"
      AND r."process_id" <> ${currentId}
      AND r."status" IN ('queued', 'running')
  `);
  if (updated > 0) logger.warn(`[SchedulerRuns] marked ${updated} run(s) of an earlier process as interrupted`);
}

function startHeartbeat(processId: number): void {
  stopHeartbeat();
  heartbeat = setInterval(() => {
    prisma.schedulerProcess
      .update({ where: { id: processId }, data: { lastHeartbeatAt: new Date() } })
      .catch((error: unknown) => logger.warn(`[SchedulerRuns] heartbeat failed — ${describe(error)}`));
  }, SCHEDULER_HEARTBEAT_INTERVAL_MS);
  heartbeat.unref();
}

/** Stop the heartbeat (graceful shutdown and tests). */
export function stopHeartbeat(): void {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
}

/** Forget the registered process (tests only). */
export function resetRunStore(): void {
  stopHeartbeat();
  currentProcessId = null;
  currentProcessStartedAt = null;
}

/**
 * Record a run entering the queue. Returns its id, or null when the process is
 * not registered or the write failed (the job still runs).
 */
export async function recordQueued(input: {
  jobName: string;
  trigger: SchedulerRunTrigger;
  triggeredByUserId?: number | null;
  queuedAt?: Date;
  /** Known before the run starts (a rollover's target season). */
  summary?: SchedulerRunSummary | null;
}): Promise<number | null> {
  if (currentProcessId === null) return null;
  try {
    const run = await prisma.schedulerJobRun.create({
      data: {
        jobName: input.jobName,
        trigger: input.trigger,
        triggeredByUserId: input.triggeredByUserId ?? null,
        processId: currentProcessId,
        status: 'queued',
        queuedAt: input.queuedAt ?? new Date(),
        ...(input.summary ? { summary: input.summary as unknown as Prisma.InputJsonValue } : {}),
      },
      select: { id: true },
    });
    return run.id;
  } catch (error) {
    logger.error(`[SchedulerRuns] could not record queued run of "${input.jobName}" — ${describe(error)}`);
    return null;
  }
}

/** The run took the scheduler lock. */
export async function markRunning(runId: number | null, startedAt: Date): Promise<void> {
  if (runId === null) return;
  try {
    await prisma.schedulerJobRun.update({ where: { id: runId }, data: { status: 'running', startedAt } });
  } catch (error) {
    logger.error(`[SchedulerRuns] could not mark run ${runId} running — ${describe(error)}`);
  }
}

/**
 * Progress of a running run (season rollover stages). Best-effort: a failed
 * write is logged and the run carries on; `markFinished` writes the final summary.
 */
export async function updateRunSummary(runId: number | null, summary: SchedulerRunSummary): Promise<void> {
  if (runId === null) return;
  try {
    await prisma.schedulerJobRun.update({
      where: { id: runId },
      data: { summary: summary as unknown as Prisma.InputJsonValue },
    });
  } catch (error) {
    logger.error(`[SchedulerRuns] could not record the progress of run ${runId} — ${describe(error)}`);
  }
}

/** The run ended: success, failed or skipped. */
export async function markFinished(
  runId: number | null,
  result: {
    status: Extract<SchedulerRunStatus, 'success' | 'failed' | 'skipped'>;
    startedAt: Date;
    finishedAt: Date;
    summary?: SchedulerRunSummary | null;
    error?: string | null;
  },
): Promise<void> {
  if (runId === null) return;
  try {
    await prisma.schedulerJobRun.update({
      where: { id: runId },
      data: {
        status: result.status,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        durationMs: Math.max(0, result.finishedAt.getTime() - result.startedAt.getTime()),
        summary: result.summary ? (result.summary as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        error: result.error ? result.error.slice(0, MAX_ERROR_LENGTH) : null,
      },
    });
  } catch (error) {
    logger.error(`[SchedulerRuns] could not record the end of run ${runId} — ${describe(error)}`);
  }
}
