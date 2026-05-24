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
  try {
    const state = getSchedulerState();
    const successfulJobs = state.jobs
      .filter(j => j.lastRunStatus === 'success' && j.lastRunAt)
      .sort((a, b) => (b.lastRunAt!.getTime() - a.lastRunAt!.getTime()));
    if (successfulJobs.length > 0) {
      lastJob = `${successfulJobs[0].name} at ${successfulJobs[0].lastRunAt!.toISOString().replace('T', ' ').slice(0, 19)} UTC`;
    }
  } catch {
    lastJob = 'unavailable';
  }

  // Determine overall health
  const isDegraded =
    disk.status !== 'ok' ||
    !dbConnected ||
    modules.status !== 'ok' ||
    logging.status === 'stale';

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
    cycleLine,
  ].join('\n');

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
