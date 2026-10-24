/**
 * The admin-triggered Season_Rollover as a scheduler run (Season Control).
 *
 * The rollover takes the scheduler's lock (`runExclusive`), so it never
 * overlaps a cron or manual job, and is recorded in `scheduler_job_runs` (job
 * `seasonRollover`, trigger `manual`). Two entry points share that:
 * - `startAdminRollover` returns the queued run at once and runs in the
 *   background, because a rollover on a full environment can take longer than
 *   the proxy's response timeout;
 * - `runAdminRollover` waits for the result (the original synchronous API).
 *
 * The settlement-triggered rollover does not come through here: settlement
 * already holds the lock, and taking it again would deadlock.
 *
 * @module services/season/adminSeasonRolloverRunService
 */

import logger from '../../config/logger';
import { SeasonError, SeasonErrorCode } from '../../errors';
import { recordAction } from '../admin/adminAuditLogService';
import { getActiveJobNames, runExclusive } from '../cycle/cycleScheduler';
import { recordQueued } from '../cycle/schedulerRunStore';
import { SEASON_ROLLOVER_JOB_NAME } from '../../types/schedulerTypes';
import { executeSeasonRollover, isRolloverInProgress, type RolloverResult } from './seasonRolloverService';
import { pendingRolloverSummary } from './rolloverProgress';

/** A queued admin rollover, until it starts executing. */
export interface QueuedAdminRollover {
  runId: number | null;
  adminUserId: number;
  seasonNumber: number;
  queuedAt: Date;
}

/** Between the 409 check and the lock (closes the double-click gap). */
let pendingStart = false;
let queued: QueuedAdminRollover | null = null;

/** The admin rollover waiting for the scheduler lock, if any. */
export function getQueuedAdminRollover(): QueuedAdminRollover | null {
  return queued ? { ...queued } : null;
}

/** Whether a rollover is pending, queued or executing (either trigger). */
export function isRolloverActive(): boolean {
  return pendingStart || queued !== null || isRolloverInProgress() || getActiveJobNames().includes(SEASON_ROLLOVER_JOB_NAME);
}

function assertNotActive(): void {
  if (isRolloverActive()) {
    throw new SeasonError(SeasonErrorCode.ROLLOVER_IN_PROGRESS, 'A season rollover is already queued or running', 409);
  }
}

async function execute(entry: QueuedAdminRollover): Promise<RolloverResult> {
  try {
    const result = await runExclusive(SEASON_ROLLOVER_JOB_NAME, () => {
      queued = null;
      return executeSeasonRollover({
        trigger: 'admin',
        adminUserId: entry.adminUserId,
        runId: entry.runId,
        expectedSeasonNumber: entry.seasonNumber,
      });
    });
    recordAction(entry.adminUserId, 'season_rollover', 'success', { ...result });
    return result;
  } catch (error) {
    recordAction(entry.adminUserId, 'season_rollover', 'failure', {
      seasonNumber: entry.seasonNumber,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    if (queued === entry) queued = null;
  }
}

async function enqueue(adminUserId: number, seasonNumber: number): Promise<QueuedAdminRollover> {
  assertNotActive();
  pendingStart = true;
  try {
    const queuedAt = new Date();
    // The target season goes on the queued row, so the history attributes the
    // attempt to it even if it never starts (refused as stale, or interrupted).
    const runId = await recordQueued({
      jobName: SEASON_ROLLOVER_JOB_NAME,
      trigger: 'manual',
      triggeredByUserId: adminUserId,
      queuedAt,
      summary: { rollover: pendingRolloverSummary(seasonNumber) },
    });
    const entry: QueuedAdminRollover = { runId, adminUserId, seasonNumber, queuedAt };
    queued = entry;
    return entry;
  } finally {
    pendingStart = false;
  }
}

/** Queue a rollover of `seasonNumber` in the background; returns the queued run at once. */
export async function startAdminRollover(
  adminUserId: number,
  seasonNumber: number,
): Promise<{ runId: number | null; jobName: string; queuedAt: Date }> {
  const entry = await enqueue(adminUserId, seasonNumber);
  execute(entry).catch((error: unknown) => {
    logger.error(`[Admin] Background season rollover failed — ${error instanceof Error ? error.message : String(error)}`);
  });
  return { runId: entry.runId, jobName: SEASON_ROLLOVER_JOB_NAME, queuedAt: entry.queuedAt };
}

/** Roll `seasonNumber` over under the scheduler lock and wait for the result. */
export async function runAdminRollover(adminUserId: number, seasonNumber: number): Promise<RolloverResult> {
  return execute(await enqueue(adminUserId, seasonNumber));
}
