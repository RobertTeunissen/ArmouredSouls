/**
 * Audit Log Retention Service
 *
 * Nightly job that deletes `audit_logs` rows older than the retention window.
 *
 * Why this exists: `audit_logs` is an append-only event-sourcing table with no
 * pruning of any kind. On ACC it reached 2.8M rows / 1.4GB in four months and
 * grows ~700k rows per month, inflating both the live volume and every nightly
 * pg_dump. It was the second-largest table behind `battles` during the
 * July 2026 ACC disk-full incident.
 *
 * Opt-in by design: audit logs are the event-sourcing record, so deleting them
 * is a deliberate per-environment decision. The job is a no-op unless
 * `AUDIT_LOG_RETENTION_DAYS` is set to a positive integer. ACC sets 30;
 * production leaves it unset until an explicit retention policy is agreed.
 *
 * Runs at 01:45 UTC — after battle_log retention (01:30), before backup (02:00).
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import cron from 'node-cron';

export interface AuditLogRetentionResult {
  /** Rows deleted. 0 when retention is disabled or nothing was stale. */
  rowsDeleted: number;
  /** True when AUDIT_LOG_RETENTION_DAYS is unset or not a positive integer. */
  skipped: boolean;
  durationMs: number;
}

const BATCH_SIZE = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Resolve the configured retention window.
 * Returns null when retention is disabled (unset, non-numeric, or <= 0).
 */
export function getAuditLogRetentionDays(): number | null {
  const raw = process.env.AUDIT_LOG_RETENTION_DAYS;
  if (raw === undefined || raw.trim() === '') return null;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
}

/**
 * Delete audit_logs rows older than the retention window.
 * Batched to keep transactions short and avoid long write locks during the
 * nightly window. Idempotent — safe to re-run.
 */
export async function runAuditLogRetention(): Promise<AuditLogRetentionResult> {
  const startTime = Date.now();
  const retentionDays = getAuditLogRetentionDays();

  if (retentionDays === null) {
    logger.info('[retention] Audit log retention disabled (AUDIT_LOG_RETENTION_DAYS not set)');
    return { rowsDeleted: 0, skipped: true, durationMs: Date.now() - startTime };
  }

  const cutoff = new Date(Date.now() - retentionDays * 86400000);
  let totalDeleted = 0;

  logger.info(`[retention] Starting audit_log retention (cutoff: ${cutoff.toISOString()}, batch: ${BATCH_SIZE})`);

  for (;;) {
    const deleted = await prisma.$executeRaw`
      DELETE FROM audit_logs
      WHERE id IN (
        SELECT id FROM audit_logs
        WHERE event_timestamp < ${cutoff}
        ORDER BY id ASC
        LIMIT ${BATCH_SIZE}
      )
    `;

    if (deleted === 0) break;

    totalDeleted += deleted;
    await sleep(100);
  }

  const durationMs = Date.now() - startTime;
  logger.info(`[retention] Complete: ${totalDeleted} audit_log rows deleted in ${(durationMs / 1000).toFixed(1)}s`);

  return { rowsDeleted: totalDeleted, skipped: false, durationMs };
}

/**
 * Initialize the nightly audit log retention cron job (01:45 UTC).
 */
export function initAuditLogRetention(): void {
  const schedule = '45 1 * * *'; // 01:45 UTC daily

  cron.schedule(schedule, async () => {
    try {
      const result = await runAuditLogRetention();
      if (result.rowsDeleted > 0) {
        logger.info(`[retention] Nightly audit retention: ${result.rowsDeleted} rows deleted in ${(result.durationMs / 1000).toFixed(1)}s`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[retention] Nightly audit retention failed: ${msg}`);
    }
  }, { timezone: 'UTC' });

  const days = getAuditLogRetentionDays();
  logger.info(
    days === null
      ? `[retention] Audit log retention cron scheduled at "${schedule}" (UTC) — currently a no-op, AUDIT_LOG_RETENTION_DAYS not set`
      : `[retention] Audit log retention cron scheduled at "${schedule}" (UTC), window ${days}d`
  );
}
