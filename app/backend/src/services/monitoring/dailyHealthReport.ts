/**
 * Daily Health Report
 *
 * Sends a daily system health summary to the monitoring Discord channel.
 * Confirms the system is operational — if you don't receive the daily report,
 * that itself is the signal something is wrong.
 *
 * Uses node-cron (already a dependency via cycle scheduler).
 */

import cron from 'node-cron';
import fs from 'fs';
import logger from '../../config/logger';
import { getConfig } from '../../config/env';
import prisma from '../../lib/prisma';
import { getDiskUsage, getMemoryUsage, checkCriticalModules } from '../../utils/systemHealth';
import { sendMonitoringAlert } from '../../utils/monitoringWebhook';
import { getSchedulerState } from '../cycle/cycleScheduler';

const DEFAULT_SCHEDULE = '0 8 * * *'; // 08:00 UTC daily
const PM2_LOG_PATH = '/var/log/armouredsouls/backend-out.log';
const LOG_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Format uptime from seconds into a human-readable string.
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

/**
 * Format a duration in milliseconds into a human-readable string (e.g., "10m 11s").
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

/**
 * Check if logging is functional by verifying the PM2 log file was recently modified.
 */
function checkLoggingHealth(): { status: 'active' | 'stale' | 'unknown'; lastWriteAgo: string } {
  try {
    const stat = fs.statSync(PM2_LOG_PATH);
    const ageMs = Date.now() - stat.mtime.getTime();

    if (ageMs > LOG_STALE_THRESHOLD_MS) {
      const hoursAgo = Math.round(ageMs / (60 * 60 * 1000));
      return { status: 'stale', lastWriteAgo: `${hoursAgo}h ago` };
    }

    const minutesAgo = Math.round(ageMs / (60 * 1000));
    return { status: 'active', lastWriteAgo: `${minutesAgo}m ago` };
  } catch {
    // File doesn't exist (dev environment) — skip gracefully
    return { status: 'unknown', lastWriteAgo: 'N/A (dev)' };
  }
}

/**
 * Check the most recent database backup file.
 * Returns age and status.
 */
function checkBackupHealth(): { status: 'ok' | 'stale' | 'missing'; lastBackupAgo: string } {
  const BACKUP_DIR = '/opt/armouredsouls/backups/daily';
  const STALE_THRESHOLD_MS = 26 * 60 * 60 * 1000; // 26 hours (daily backup with margin)

  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.dump') || f.endsWith('.sql.gz'))
      .map(f => ({ name: f, mtime: fs.statSync(`${BACKUP_DIR}/${f}`).mtime.getTime() }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) {
      return { status: 'missing', lastBackupAgo: 'none found' };
    }

    const ageMs = Date.now() - files[0].mtime;
    const hoursAgo = Math.round(ageMs / (60 * 60 * 1000));

    if (ageMs > STALE_THRESHOLD_MS) {
      return { status: 'stale', lastBackupAgo: `${hoursAgo}h ago` };
    }

    return { status: 'ok', lastBackupAgo: `${hoursAgo}h ago` };
  } catch {
    // Directory doesn't exist (dev environment)
    return { status: 'missing', lastBackupAgo: 'N/A (dev)' };
  }
}

/**
 * Generate and send the daily health report.
 */
export async function generateHealthReport(): Promise<string> {
  // Write a test log entry FIRST to verify logging is functional
  logger.info('[health-report] logging verification');

  const disk = getDiskUsage();
  const memory = getMemoryUsage();
  const modules = checkCriticalModules();
  // Check logging AFTER the write so the mtime reflects the verification entry
  const logging = checkLoggingHealth();
  const backup = checkBackupHealth();
  const uptime = formatUptime(process.uptime());

  // Check database connectivity
  let dbConnected = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbConnected = false;
  }

  // Get cycle info
  let cycleInfo = 'unknown';
  try {
    const metadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    if (metadata) {
      cycleInfo = `cycle #${metadata.totalCycles}`;
      if (metadata.lastCycleAt) {
        cycleInfo += ` at ${metadata.lastCycleAt.toISOString().replace('T', ' ').slice(0, 19)} UTC`;
      }
    }
  } catch {
    cycleInfo = 'unavailable';
  }

  // Get last successful job from scheduler
  let lastJob = '';
  let eventDurationsSection = '';
  try {
    const state = getSchedulerState();
    const successfulJobs = state.jobs
      .filter(j => j.lastRunStatus === 'success' && j.lastRunAt)
      .sort((a, b) => (b.lastRunAt!.getTime() - a.lastRunAt!.getTime()));
    if (successfulJobs.length > 0) {
      lastJob = `${successfulJobs[0].name} at ${successfulJobs[0].lastRunAt!.toISOString().replace('T', ' ').slice(0, 19)} UTC`;
    }

    // Per-event durations and match counts for the just-closed cycle (R7.3)
    const jobsWithRuns = state.jobs.filter(j => j.lastRunAt !== null);
    if (jobsWithRuns.length > 0) {
      const lines = jobsWithRuns.map(j => {
        const duration = j.lastRunDurationMs != null ? formatDuration(j.lastRunDurationMs) : 'N/A';
        const status = j.lastRunStatus === 'success' ? '✓' : j.lastRunStatus === 'failed' ? '✗' : '?';
        return `  ${status} ${j.name}: ${duration}`;
      });
      eventDurationsSection = `\n📋 Per-Event Durations (last cycle)\n${lines.join('\n')}`;
    }
  } catch {
    lastJob = 'unavailable';
  }

  // Determine overall health
  const isDegraded =
    disk.status !== 'ok' ||
    !dbConnected ||
    modules.status !== 'ok' ||
    logging.status === 'stale' ||
    backup.status === 'stale';

  const now = new Date().toUTCString().slice(17, 22); // HH:MM
  const header = isDegraded
    ? '⚠️ Daily Health Report — Degraded'
    : '✅ Daily Health Report — All systems operational';

  const diskLine = disk.status === 'ok'
    ? `• Disk: ${disk.usagePercent}% used (${disk.availableMB}MB free) — OK`
    : `• Disk: ${disk.usagePercent}% used (${disk.availableMB}MB free) — ⚠️ ${disk.status.toUpperCase()}`;

  const memLine = `• Memory: ${memory.usagePercent}% (${memory.usedMB}MB / ${memory.totalMB}MB) — OK`;
  const dbLine = dbConnected ? '• Database: Connected' : '• Database: ⚠️ DISCONNECTED';
  const moduleLine = modules.status === 'ok'
    ? '• Modules: All verified'
    : `• Modules: ⚠️ DEGRADED (missing: ${modules.missing.join(', ')})`;

  const logLine = logging.status === 'active'
    ? `• Logging: Active (last write ${logging.lastWriteAgo})`
    : logging.status === 'stale'
      ? `• Logging: ⚠️ STALE (last write ${logging.lastWriteAgo})`
      : `• Logging: ${logging.lastWriteAgo}`;

  const cycleLine = lastJob
    ? `• Last cycle job: ${lastJob} (${cycleInfo})`
    : `• Cycle: ${cycleInfo}`;

  const backupLine = backup.status === 'ok'
    ? `• Backups: OK (last ${backup.lastBackupAgo})`
    : backup.status === 'stale'
      ? `• Backups: ⚠️ STALE (last ${backup.lastBackupAgo})`
      : `• Backups: ${backup.lastBackupAgo}`;

  const message = [
    header,
    '',
    `📊 System Status (${now} UTC)`,
    `• Uptime: ${uptime}`,
    diskLine,
    memLine,
    dbLine,
    moduleLine,
    logLine,
    backupLine,
    cycleLine,
    eventDurationsSection,
  ].filter(Boolean).join('\n');

  return message;
}

/**
 * Initializes the daily health report cron job.
 * Called during application bootstrap (after scheduler init).
 */
export function initDailyHealthReport(): void {
  const configuredSchedule = getConfig().dailyReportSchedule;
  const schedule = cron.validate(configuredSchedule) ? configuredSchedule : DEFAULT_SCHEDULE;

  if (configuredSchedule !== schedule) {
    logger.error(`[daily-health-report] Invalid cron schedule: "${configuredSchedule}" — falling back to default "${DEFAULT_SCHEDULE}"`);
  }

  cron.schedule(schedule, async () => {
    try {
      const message = await generateHealthReport();
      const sent = await sendMonitoringAlert(message);

      if (!sent) {
        // Webhook not configured or failed — log the report instead
        logger.info(`[daily-health-report]\n${message}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[daily-health-report] Failed to generate/send report: ${errorMessage}`);
    }
  }, {
    timezone: 'UTC',
  });

  logger.info(`[daily-health-report] Scheduled at "${schedule}" (UTC)`);
}
