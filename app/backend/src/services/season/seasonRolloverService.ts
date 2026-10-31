/**
 * Season_Rollover_Service (Spec #45).
 *
 * Ends a season in five stages with a hard gate in the middle:
 *
 *   Stage 1 ARCHIVE  — write the permanent record. No destructive writes.
 *   Stage 2 VERIFY   — counts must match, or abort with data intact.
 *   Stage 3 PURGE    — delete and reset, batched by user.
 *   Stage 4 POST     — orphan sweep, reclamation, preserved-state achievement
 *                      re-award. Failures non-fatal.
 *   Stage 5 AUTOMATON — the `season_open` Automaton Turn_Step for the new
 *                      season (Spec #55). Non-fatal.
 *
 * The ordering is the whole point: nothing is deleted until the archive exists
 * and has been counted. A crash between stages is safe because Stage 1 is
 * idempotent per season and Stage 3 can be retried.
 *
 * Every rollover is a `seasonRollover` run in `scheduler_job_runs`, with its
 * stage progress in the run's summary (Season Control). Both triggers execute
 * under the scheduler's lock: settlement already holds it, and the admin run
 * service (`adminSeasonRolloverRunService`) takes it before calling this.
 *
 * @module services/season/seasonRolloverService
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { SeasonError, SeasonErrorCode } from '../../errors';
import {
  getCurrentSeason,
  completeSeasonAndOpenNext,
  recordGeneratedStableCount,
} from './seasonService';
import {
  writeSeasonArchive,
  verifyArchive,
  hasCompleteArchive,
} from './seasonArchiveService';
import {
  deleteGeneratedStables,
  deleteDormantHumanStables,
  resetCompetitiveAndEconomicState,
  purgeHistory,
  reclaimSpace,
} from './seasonPurgeService';
import { seasonStartedAt } from './dormantStables';
import { RolloverTracker, pendingRolloverSummary } from './rolloverProgress';
import { markFinished, markRunning, recordQueued, updateRunSummary } from '../cycle/schedulerRunStore';
import { SEASON_ROLLOVER_JOB_NAME, type RolloverRunSummary } from '../../types/schedulerTypes';

export interface RolloverOptions {
  /** Who started this rollover — recorded in logs and notifications. */
  trigger: 'settlement' | 'admin';
  /** Administrator id, when triggered manually. */
  adminUserId?: number;
  /**
   * The `scheduler_job_runs` row the caller already recorded (the admin run
   * service). When omitted, the rollover records its own run: trigger `cron`
   * from settlement, `manual` from an admin.
   */
  runId?: number | null;
  /**
   * Refuse to start unless this is still the current season. A queued admin
   * rollover waits for the scheduler lock; if a settlement rolled the season
   * over meanwhile, it must not close the freshly opened one.
   */
  expectedSeasonNumber?: number;
}

/** The rollover executing right now, for Season Control's running view. */
export interface ActiveRolloverProgress {
  runId: number | null;
  trigger: RolloverOptions['trigger'];
  adminUserId: number | null;
  startedAt: string;
  progress: RolloverRunSummary;
}

export interface RolloverResult {
  completedSeasonNumber: number;
  newSeasonNumber: number;
  stablesArchived: number;
  robotsArchived: number;
  snapshotRows: number;
  accoladeRows: number;
  generatedStablesDeleted: number;
  /** Human stables without a login all season (archived, then deleted). */
  dormantStablesDeleted: number;
  totalRowsPurged: number;
  durations: { archiveMs: number; purgeMs: number; postMs: number; totalMs: number };
}

/**
 * In-process guard against two rollovers at once. Both triggers already run
 * under the scheduler lock; this flag also covers direct callers (tests, the
 * synchronous admin path racing a settlement-triggered one) and is what the
 * admin run service checks for the settlement path, which never takes the
 * lock under the `seasonRollover` name. A single PM2 process makes an
 * in-process flag sufficient.
 */
let rolloverInProgress = false;

interface ActiveRollover {
  runId: number | null;
  trigger: RolloverOptions['trigger'];
  adminUserId: number | null;
  startedAt: Date;
  tracker: RolloverTracker | null;
}

let active: ActiveRollover | null = null;

/** Whether a rollover is currently executing. */
export function isRolloverInProgress(): boolean {
  return rolloverInProgress;
}

/** Stage progress of the executing rollover, or null. */
export function getActiveRolloverProgress(): ActiveRolloverProgress | null {
  if (!active?.tracker) return null;
  return {
    runId: active.runId,
    trigger: active.trigger,
    adminUserId: active.adminUserId,
    startedAt: active.startedAt.toISOString(),
    progress: active.tracker.snapshot(),
  };
}

const count = (value: number): string => value.toLocaleString('en-US');

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Dispatch an operational notification. Reuses the existing monitoring webhook
 * helper, which never throws — a notification failure must never affect a
 * rollover that has already moved data.
 */
async function notify(message: string): Promise<void> {
  const { sendMonitoringAlert } = await import('../../utils/monitoringWebhook');
  await sendMonitoringAlert(message);
}

/** Execute a full Season_Rollover. */
export async function executeSeasonRollover(options: RolloverOptions): Promise<RolloverResult> {
  if (rolloverInProgress) {
    const message = 'A season rollover is already running';
    // A run the caller recorded must not stay queued forever.
    if (options.runId !== undefined && options.runId !== null) {
      const at = new Date();
      await markFinished(options.runId, {
        status: 'failed',
        startedAt: at,
        finishedAt: at,
        summary: options.expectedSeasonNumber !== undefined ? { rollover: pendingRolloverSummary(options.expectedSeasonNumber) } : null,
        error: message,
      });
    }
    throw new SeasonError(SeasonErrorCode.ROLLOVER_IN_PROGRESS, message, 409);
  }
  rolloverInProgress = true;

  const startedAt = new Date();
  const totalStart = startedAt.getTime();
  const runId = options.runId !== undefined
    ? options.runId
    : await recordQueued({
      jobName: SEASON_ROLLOVER_JOB_NAME,
      trigger: options.trigger === 'admin' ? 'manual' : 'cron',
      triggeredByUserId: options.adminUserId ?? null,
      queuedAt: startedAt,
    });
  await markRunning(runId, startedAt);
  active = { runId, trigger: options.trigger, adminUserId: options.adminUserId ?? null, startedAt, tracker: null };

  let tracker: RolloverTracker | null = null;
  try {
    const season = await getCurrentSeason();
    const completedSeasonNumber = season.seasonNumber;
    if (options.expectedSeasonNumber !== undefined && options.expectedSeasonNumber !== completedSeasonNumber) {
      throw new SeasonError(
        SeasonErrorCode.SEASON_NUMBER_MISMATCH,
        `Season ${options.expectedSeasonNumber} is no longer current (the current season is ${completedSeasonNumber}); nothing was changed`,
        409,
      );
    }

    tracker = new RolloverTracker(completedSeasonNumber, (summary) => updateRunSummary(runId, { rollover: summary }));
    active.tracker = tracker;

    logger.info(
      `[season-rollover] Starting rollover of season ${completedSeasonNumber} (trigger: ${options.trigger})`,
    );
    await notify(
      `🔄 Season ${completedSeasonNumber} rollover started (${options.trigger}) at ${new Date().toISOString()}`,
    );

    // ── Stage 1: archive ──────────────────────────────────────────────
    await tracker.start('archive');
    const archiveStart = Date.now();
    const alreadyArchived = await hasCompleteArchive(completedSeasonNumber);

    let archive;
    if (alreadyArchived) {
      logger.info(
        `[season-rollover] Season ${completedSeasonNumber} already has a complete archive — skipping to purge (idempotent retry)`,
      );
      const verification = await verifyArchive(completedSeasonNumber);
      const generatedStableCount = await prisma.user.count({ where: { isGenerated: true } });
      archive = {
        stablesArchived: verification.actualStables,
        robotsArchived: verification.actualRobots,
        snapshotRows: await prisma.seasonStandingSnapshot.count({
          where: { seasonNumber: completedSeasonNumber },
        }),
        accoladeRows: await prisma.seasonAccolade.count({
          where: { seasonNumber: completedSeasonNumber },
        }),
        generatedStableCount,
      };
    } else {
      archive = await writeSeasonArchive(
        completedSeasonNumber,
        season.isLegacy ? season.seasonCycle : season.seasonLengthCycles,
      );
    }
    const archiveMs = Date.now() - archiveStart;
    const archived = `${count(archive.stablesArchived)} stables, ${count(archive.robotsArchived)} robots`;
    await tracker.finish('archive', alreadyArchived ? `Already archived (retry): ${archived}` : `${archived} archived`);

    // ── Stage 2: verification gate ────────────────────────────────────
    // On an idempotent retry (archive already existed), skip the verification
    // gate. The original archive was verified when it was first written; re-
    // verifying against a live database that has since changed (new users, new
    // robots registered between attempts) produces false negatives and blocks
    // the retry permanently. The archive is immutable once written — its
    // integrity hasn't changed, only the live comparison target has.
    if (alreadyArchived) {
      await tracker.skip('verify', 'Verified when the archive was written');
    } else {
      await tracker.start('verify');
      const verification = await verifyArchive(completedSeasonNumber);
      if (!verification.ok) {
        const detail =
          `expected ${verification.expectedStables} stables / ${verification.expectedRobots} robots, ` +
          `found ${verification.actualStables} / ${verification.actualRobots}`;
        logger.error(`[season-rollover] Archive verification FAILED — ${detail}. Aborting; no data deleted.`);
        await notify(`🚨 Season ${completedSeasonNumber} rollover ABORTED at archive verification — ${detail}. No data was deleted.`);
        throw new SeasonError(
          SeasonErrorCode.ARCHIVE_VERIFICATION_FAILED,
          `Archive verification failed: ${detail}`,
          500,
          verification,
        );
      }
      logger.info(
        `[season-rollover] Archive verified — ${verification.actualStables} stables, ${verification.actualRobots} robots`,
      );
      await tracker.finish('verify', 'Counts match');
    }

    // Stamp the bot count before those rows disappear.
    await recordGeneratedStableCount(completedSeasonNumber, archive.generatedStableCount);

    // ── Stage 3: purge and reset ──────────────────────────────────────
    await tracker.start('purge', 'Deleting generated stables');
    const purgeStart = Date.now();
    const generatedStablesDeleted = await deleteGeneratedStables((deleted, total) => tracker?.generatedProgress(deleted, total));
    // Human stables with no login since this season started. They are in the
    // archive written above; the accounts go so they stop counting as players.
    const startedAtOfSeason = await seasonStartedAt(completedSeasonNumber);
    const dormantStablesDeleted = startedAtOfSeason
      ? await deleteDormantHumanStables(startedAtOfSeason, (deleted, total) => tracker?.dormantProgress(deleted, total))
      : 0;
    tracker.setDetail('purge', 'Resetting stables');
    const { rowsDeleted: resetRows } = await resetCompetitiveAndEconomicState();
    tracker.setDetail('purge', 'Purging history');
    const historyRows = await purgeHistory();
    const purgeMs = Date.now() - purgeStart;

    const allRows = { ...resetRows, ...historyRows };
    const totalRowsPurged = Object.values(allRows).reduce((sum, n) => sum + n, 0);

    const newSeasonNumber = await completeSeasonAndOpenNext(
      completedSeasonNumber,
      archive.generatedStableCount,
    );
    tracker.setNewSeason(newSeasonNumber);
    await tracker.finish(
      'purge',
      `${count(generatedStablesDeleted)} generated and ${count(dormantStablesDeleted)} dormant human stables deleted, ${count(totalRowsPurged)} rows purged`,
    );

    // ── Stage 4: post (all failures non-fatal) ────────────────────────
    await tracker.start('post', 'Orphan sweep');
    const postStart = Date.now();
    const postProblems: string[] = [];
    try {
      const { cleanupSeasonOrphans } = await import('../moderation/imageLibraryService');
      const orphans = await cleanupSeasonOrphans();
      logger.info(
        `[season-rollover] Orphan sweep: ${orphans.filesDeleted} files deleted, ${orphans.bytesReclaimed} bytes reclaimed`,
      );
    } catch (error) {
      postProblems.push('orphan sweep failed');
      logger.error(
        `[season-rollover] Orphan sweep failed (non-fatal) — ${describeError(error)}`,
      );
    }
    // Re-award achievements whose condition reads state this rollover preserved.
    // Runs after the `user_achievements` purge and after the next season is open,
    // so the unlock and its rewards land in the new season (issue #419), and
    // before the VACUUM below so reclamation sees the final row set.
    tracker.setDetail('post', 'Re-awarding achievements');
    try {
      const { reawardPreservedStateAchievements } = await import(
        '../achievement/preservedStateAchievements'
      );
      const reawarded = await reawardPreservedStateAchievements();
      logger.info(
        `[season-rollover] Preserved-state achievements: ${reawarded.achievementsAwarded} awarded ` +
        `across ${reawarded.stablesChecked} stables`,
      );
    } catch (error) {
      postProblems.push('achievement re-award failed');
      logger.error(
        `[season-rollover] Preserved-state achievement re-award failed (non-fatal) — ${describeError(error)}`,
      );
    }

    tracker.setDetail('post', 'Reclaiming space');
    if (!(await reclaimSpace())) postProblems.push('space reclamation failed');
    await tracker.finish(
      'post',
      postProblems.length === 0 ? 'Orphans swept, achievements re-awarded, space reclaimed' : `Done with warnings: ${postProblems.join(', ')}`,
    );

    // ── Stage 5: Automaton `season_open` turn (Spec #55 R7.2; non-fatal) ──
    // Every Active_Automaton rebuilds from its reset balance in the new
    // season, for every rollover trigger. The turn runner records and alerts
    // its own failures; this guard also covers the module load.
    await tracker.start('automaton');
    let automatonProblem = false;
    try {
      const { runTurnStepNonFatal } = await import('../automaton');
      await runTurnStepNonFatal({
        trigger: 'season_open',
        seasonNumber: newSeasonNumber,
        slot: 0,
        source: 'rollover',
      });
    } catch (error) {
      automatonProblem = true;
      logger.error(
        `[season-rollover] Automaton season_open turn failed (non-fatal) — ${describeError(error)}`,
      );
    }
    const postMs = Date.now() - postStart;
    await tracker.finish('automaton', automatonProblem ? 'Done with warnings: the turn could not start' : `Season ${newSeasonNumber} opening turn`);

    const totalMs = Date.now() - totalStart;

    logger.info(
      `[season-rollover] Season ${completedSeasonNumber} complete — ` +
      `archived ${archive.stablesArchived} stables / ${archive.robotsArchived} robots, ` +
      `deleted ${generatedStablesDeleted} generated and ${dormantStablesDeleted} dormant human stables, purged ${totalRowsPurged} rows. ` +
      `Durations: archive ${archiveMs}ms, purge ${purgeMs}ms, post ${postMs}ms, total ${totalMs}ms`,
    );
    await notify(
      `✅ Season ${completedSeasonNumber} rollover complete — ${archive.stablesArchived} stables and ` +
      `${archive.robotsArchived} robots archived, ${generatedStablesDeleted} generated and ${dormantStablesDeleted} dormant human stables deleted, ` +
      `${totalRowsPurged} rows purged in ${Math.round(totalMs / 1000)}s. Season ${newSeasonNumber} is now in preparation.`,
    );

    const result: RolloverResult = {
      completedSeasonNumber,
      newSeasonNumber,
      stablesArchived: archive.stablesArchived,
      robotsArchived: archive.robotsArchived,
      snapshotRows: archive.snapshotRows,
      accoladeRows: archive.accoladeRows,
      generatedStablesDeleted,
      dormantStablesDeleted,
      totalRowsPurged,
      durations: { archiveMs, purgeMs, postMs, totalMs },
    };
    tracker.setResult({
      stablesArchived: result.stablesArchived,
      robotsArchived: result.robotsArchived,
      snapshotRows: result.snapshotRows,
      accoladeRows: result.accoladeRows,
      generatedStablesDeleted: result.generatedStablesDeleted,
      dormantStablesDeleted: result.dormantStablesDeleted,
      totalRowsPurged: result.totalRowsPurged,
      durations: result.durations,
    });
    await markFinished(runId, { status: 'success', startedAt, finishedAt: new Date(), summary: { rollover: tracker.snapshot() } });
    return result;
  } catch (error) {
    const message = describeError(error);
    tracker?.fail(message);
    // Refused before the first stage (e.g. the season changed while queued):
    // keep the season it targeted, with no stage marked, for the history.
    const summary = tracker
      ? { rollover: tracker.snapshot() }
      : options.expectedSeasonNumber !== undefined
        ? { rollover: pendingRolloverSummary(options.expectedSeasonNumber) }
        : null;
    await markFinished(runId, { status: 'failed', startedAt, finishedAt: new Date(), summary, error: message });
    const mismatch = error instanceof SeasonError && error.code === SeasonErrorCode.SEASON_NUMBER_MISMATCH;
    if (!(error instanceof SeasonError && error.code === SeasonErrorCode.ARCHIVE_VERIFICATION_FAILED) && !mismatch) {
      await notify(`🚨 Season rollover FAILED — ${message}`);
    }
    logger.error(
      `[season-rollover] Failed — ${error instanceof Error ? error.stack || message : message}`,
    );
    throw error;
  } finally {
    rolloverInProgress = false;
    active = null;
  }
}
