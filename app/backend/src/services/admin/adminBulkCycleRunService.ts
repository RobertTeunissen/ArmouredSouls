/**
 * The admin bulk-cycle runner as a scheduler run (Cycle Controls → Testing tools).
 *
 * Every bulk run takes the scheduler's lock, so it never overlaps a cron or
 * manual job, and is recorded in `scheduler_job_runs` (job `bulkCycles`,
 * trigger `bulk`). Two entry points share that:
 * - `runBulkCycles` waits for the result (the original synchronous API, used by
 *   the E2E helpers and Heavy tests);
 * - `startBulkCycles` returns the queued run at once and runs in the background,
 *   because one cycle on a full environment takes far longer than the proxy's
 *   response timeout.
 */
import logger from '../../config/logger';
import { executeBulkCycles, type BulkCycleOptions, type BulkCycleResult } from './adminCycleService';
import { getActiveJobNames, runExclusive } from '../cycle/cycleScheduler';
import { markFinished, markRunning, recordQueued } from '../cycle/schedulerRunStore';
import { SchedulerError, SchedulerErrorCode } from '../../errors/schedulerErrors';
import { BULK_CYCLES_JOB_NAME, type SchedulerRunSummary } from '../../types/schedulerTypes';

/** A bulk start that has not reached the lock yet (closes the double-click gap). */
let pendingStart = false;

/** Cycles whose whole cycle threw (`results[].error`); block-level errors inside a cycle do not count. */
function failedCycles(result: BulkCycleResult): Array<{ cycle: number; error: string }> {
  return result.results
    .filter((entry): entry is typeof entry & { error: string } => typeof entry.error === 'string')
    .map((entry) => ({ cycle: entry.cycle, error: entry.error }));
}

function summarize(options: Required<BulkCycleOptions>, result: BulkCycleResult): SchedulerRunSummary {
  const failed = failedCycles(result);
  return {
    bulk: {
      cyclesRequested: options.cycles,
      // `executeBulkCycles` reports the requested count; only cycles that ran through count here.
      cyclesCompleted: Math.max(0, result.results.length - failed.length),
      cyclesFailed: failed.length,
      totalDurationMs: result.totalDuration,
      averageCycleDurationMs: result.averageCycleDuration,
      generateUsersPerCycle: options.generateUsersPerCycle,
      includeTournaments: options.includeTournaments,
      includeKoth: options.includeKoth,
      includeDailyFinances: options.includeDailyFinances,
    },
  };
}

/** "2 of 5 cycles failed — cycle 82: …; cycle 83: …" (trimmed by the run store). */
function failureText(failed: ReadonlyArray<{ cycle: number; error: string }>, requested: number): string {
  return `${failed.length} of ${requested} cycle${requested === 1 ? '' : 's'} failed — ${failed.map((entry) => `cycle ${entry.cycle}: ${entry.error}`).join('; ')}`;
}

function withDefaults(options: BulkCycleOptions): Required<BulkCycleOptions> {
  return {
    cycles: options.cycles ?? 1,
    generateUsersPerCycle: options.generateUsersPerCycle ?? false,
    includeTournaments: options.includeTournaments ?? true,
    includeKoth: options.includeKoth ?? true,
    includeDailyFinances: options.includeDailyFinances ?? true,
  };
}

async function execute(runId: number | null, options: Required<BulkCycleOptions>): Promise<BulkCycleResult> {
  return runExclusive(BULK_CYCLES_JOB_NAME, async () => {
    const startedAt = new Date();
    await markRunning(runId, startedAt);
    try {
      const result = await executeBulkCycles(options);
      const failed = failedCycles(result);
      await markFinished(runId, {
        status: failed.length === 0 ? 'success' : 'failed',
        startedAt,
        finishedAt: new Date(),
        summary: summarize(options, result),
        error: failed.length === 0 ? null : failureText(failed, options.cycles),
      });
      return result;
    } catch (error) {
      await markFinished(runId, {
        status: 'failed',
        startedAt,
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });
}

function assertNotActive(): void {
  if (pendingStart || getActiveJobNames().includes(BULK_CYCLES_JOB_NAME)) {
    throw new SchedulerError(SchedulerErrorCode.JOB_ALREADY_ACTIVE, 'A bulk run is already queued or running', 409);
  }
}

/** Run bulk cycles under the scheduler lock and wait for the result. */
export async function runBulkCycles(options: BulkCycleOptions, triggeredByUserId: number): Promise<BulkCycleResult> {
  assertNotActive();
  pendingStart = true;
  let runId: number | null;
  try {
    runId = await recordQueued({ jobName: BULK_CYCLES_JOB_NAME, trigger: 'bulk', triggeredByUserId });
  } finally {
    pendingStart = false;
  }
  return execute(runId, withDefaults(options));
}

/** Queue bulk cycles in the background; returns the queued run at once. */
export async function startBulkCycles(
  options: BulkCycleOptions,
  triggeredByUserId: number,
): Promise<{ runId: number | null; jobName: string; queuedAt: Date }> {
  assertNotActive();
  pendingStart = true;
  const queuedAt = new Date();
  try {
    const runId = await recordQueued({ jobName: BULK_CYCLES_JOB_NAME, trigger: 'bulk', triggeredByUserId, queuedAt });
    execute(runId, withDefaults(options)).catch((error: unknown) => {
      logger.error(`[Admin] Background bulk cycles failed — ${error instanceof Error ? error.message : String(error)}`);
    });
    return { runId, jobName: BULK_CYCLES_JOB_NAME, queuedAt };
  } finally {
    pendingStart = false;
  }
}
