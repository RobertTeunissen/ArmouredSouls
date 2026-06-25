/**
 * Battle Log Retention Service (Spec #39)
 *
 * Nightly job that NULLs battle_log for battles older than the retention window.
 * Runs at 01:30 UTC daily (after settlement, before backup).
 *
 * The summary table preserves all overview data permanently.
 * Only the replay/playback data (events, detailedCombatEvents) is lost.
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import cron from 'node-cron';

interface RetentionResult {
  battlesProcessed: number;
  durationMs: number;
}

const BATCH_SIZE = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Strip battle_log from all battles older than the retention window.
 * Processes in batches to avoid long-running locks.
 * Idempotent — already-NULLed battles are skipped by the WHERE clause.
 */
export async function runBattleLogRetention(): Promise<RetentionResult> {
  const rawDays = parseInt(process.env.BATTLE_LOG_RETENTION_DAYS || '7', 10);
  const retentionDays = Number.isFinite(rawDays) && rawDays >= 1 ? rawDays : 7;
  const cutoff = new Date(Date.now() - retentionDays * 86400000);
  const startTime = Date.now();
  let totalProcessed = 0;

  logger.info(`[retention] Starting battle_log retention (cutoff: ${cutoff.toISOString()}, batch: ${BATCH_SIZE})`);

  while (true) {
    const batch = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM battles
      WHERE created_at < ${cutoff}
        AND battle_log IS NOT NULL
      ORDER BY id ASC
      LIMIT ${BATCH_SIZE}
    `;

    if (batch.length === 0) break;

    const ids = batch.map(b => b.id);
    await prisma.$executeRaw`
      UPDATE battles SET battle_log = NULL WHERE id = ANY(${ids}::int[])
    `;

    totalProcessed += batch.length;
    await sleep(100);
  }

  const durationMs = Date.now() - startTime;
  logger.info(`[retention] Complete: ${totalProcessed} battles stripped in ${(durationMs / 1000).toFixed(1)}s`);

  return { battlesProcessed: totalProcessed, durationMs };
}

/**
 * Initialize the nightly retention cron job.
 * Runs at 01:30 UTC daily — after settlement (00:00) and before backup (02:00).
 */
export function initBattleLogRetention(): void {
  const schedule = '30 1 * * *'; // 01:30 UTC daily

  cron.schedule(schedule, async () => {
    try {
      const result = await runBattleLogRetention();
      if (result.battlesProcessed > 0) {
        logger.info(`[retention] Nightly retention: ${result.battlesProcessed} battles pruned in ${(result.durationMs / 1000).toFixed(1)}s`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[retention] Nightly retention failed: ${msg}`);
    }
  }, { timezone: 'UTC' });

  logger.info(`[retention] Battle log retention cron scheduled at "${schedule}" (UTC)`);
}
