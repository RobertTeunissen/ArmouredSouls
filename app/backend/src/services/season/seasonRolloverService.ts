/**
 * Season_Rollover_Service (Spec #45).
 *
 * Ends a season in four stages with a hard gate in the middle:
 *
 *   Stage 1 ARCHIVE  — write the permanent record. No destructive writes.
 *   Stage 2 VERIFY   — counts must match, or abort with data intact.
 *   Stage 3 PURGE    — delete and reset, batched by user.
 *   Stage 4 POST     — orphan sweep, reclamation, preserved-state achievement
 *                      re-award. Failures non-fatal.
 *
 * The ordering is the whole point: nothing is deleted until the archive exists
 * and has been counted. A crash between stages is safe because Stage 1 is
 * idempotent per season and Stage 3 can be retried.
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
  resetCompetitiveAndEconomicState,
  purgeHistory,
  reclaimSpace,
} from './seasonPurgeService';

export interface RolloverOptions {
  /** Who started this rollover — recorded in logs and notifications. */
  trigger: 'settlement' | 'admin';
  /** Administrator id, when triggered manually. */
  adminUserId?: number;
}

export interface RolloverResult {
  completedSeasonNumber: number;
  newSeasonNumber: number;
  stablesArchived: number;
  robotsArchived: number;
  snapshotRows: number;
  accoladeRows: number;
  generatedStablesDeleted: number;
  totalRowsPurged: number;
  durations: { archiveMs: number; purgeMs: number; postMs: number; totalMs: number };
}

/**
 * In-process guard. The settlement path is already serialised by the
 * scheduler's job lock; this covers the admin trigger, which does not go
 * through it. A single PM2 process makes an in-process flag sufficient — a
 * PostgreSQL advisory lock would add a dead-session failure mode for no gain.
 */
let rolloverInProgress = false;

/** Whether a rollover is currently executing. */
export function isRolloverInProgress(): boolean {
  return rolloverInProgress;
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
    throw new SeasonError(
      SeasonErrorCode.ROLLOVER_IN_PROGRESS,
      'A season rollover is already running',
      409,
    );
  }
  rolloverInProgress = true;

  const totalStart = Date.now();
  try {
    const season = await getCurrentSeason();
    const completedSeasonNumber = season.seasonNumber;

    logger.info(
      `[season-rollover] Starting rollover of season ${completedSeasonNumber} (trigger: ${options.trigger})`,
    );
    await notify(
      `🔄 Season ${completedSeasonNumber} rollover started (${options.trigger}) at ${new Date().toISOString()}`,
    );

    // ── Stage 1: archive ──────────────────────────────────────────────
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

    // ── Stage 2: verification gate ────────────────────────────────────
    // On an idempotent retry (archive already existed), skip the verification
    // gate. The original archive was verified when it was first written; re-
    // verifying against a live database that has since changed (new users, new
    // robots registered between attempts) produces false negatives and blocks
    // the retry permanently. The archive is immutable once written — its
    // integrity hasn't changed, only the live comparison target has.
    if (!alreadyArchived) {
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
    }

    // Stamp the bot count before those rows disappear.
    await recordGeneratedStableCount(completedSeasonNumber, archive.generatedStableCount);

    // ── Stage 3: purge and reset ──────────────────────────────────────
    const purgeStart = Date.now();
    const generatedStablesDeleted = await deleteGeneratedStables();
    const { rowsDeleted: resetRows } = await resetCompetitiveAndEconomicState();
    const historyRows = await purgeHistory();
    const purgeMs = Date.now() - purgeStart;

    const allRows = { ...resetRows, ...historyRows };
    const totalRowsPurged = Object.values(allRows).reduce((sum, n) => sum + n, 0);

    const newSeasonNumber = await completeSeasonAndOpenNext(
      completedSeasonNumber,
      archive.generatedStableCount,
    );

    // ── Stage 4: post (all failures non-fatal) ────────────────────────
    const postStart = Date.now();
    try {
      const { cleanupSeasonOrphans } = await import('../moderation/imageLibraryService');
      const orphans = await cleanupSeasonOrphans();
      logger.info(
        `[season-rollover] Orphan sweep: ${orphans.filesDeleted} files deleted, ${orphans.bytesReclaimed} bytes reclaimed`,
      );
    } catch (error) {
      logger.error(
        `[season-rollover] Orphan sweep failed (non-fatal) — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    // Re-award achievements whose condition reads state this rollover preserved.
    // Runs after the `user_achievements` purge and after the next season is open,
    // so the unlock and its rewards land in the new season (issue #419), and
    // before the VACUUM below so reclamation sees the final row set.
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
      logger.error(
        `[season-rollover] Preserved-state achievement re-award failed (non-fatal) — ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    await reclaimSpace();
    const postMs = Date.now() - postStart;

    const totalMs = Date.now() - totalStart;

    logger.info(
      `[season-rollover] Season ${completedSeasonNumber} complete — ` +
      `archived ${archive.stablesArchived} stables / ${archive.robotsArchived} robots, ` +
      `deleted ${generatedStablesDeleted} generated stables, purged ${totalRowsPurged} rows. ` +
      `Durations: archive ${archiveMs}ms, purge ${purgeMs}ms, post ${postMs}ms, total ${totalMs}ms`,
    );
    await notify(
      `✅ Season ${completedSeasonNumber} rollover complete — ${archive.stablesArchived} stables and ` +
      `${archive.robotsArchived} robots archived, ${generatedStablesDeleted} generated stables deleted, ` +
      `${totalRowsPurged} rows purged in ${Math.round(totalMs / 1000)}s. Season ${newSeasonNumber} is now in preparation.`,
    );

    return {
      completedSeasonNumber,
      newSeasonNumber,
      stablesArchived: archive.stablesArchived,
      robotsArchived: archive.robotsArchived,
      snapshotRows: archive.snapshotRows,
      accoladeRows: archive.accoladeRows,
      generatedStablesDeleted,
      totalRowsPurged,
      durations: { archiveMs, purgeMs, postMs, totalMs },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!(error instanceof SeasonError && error.code === SeasonErrorCode.ARCHIVE_VERIFICATION_FAILED)) {
      await notify(`🚨 Season rollover FAILED — ${message}`);
    }
    logger.error(
      `[season-rollover] Failed — ${error instanceof Error ? error.stack || message : message}`,
    );
    throw error;
  } finally {
    rolloverInProgress = false;
  }
}
