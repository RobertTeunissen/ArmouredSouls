/**
 * The admin System page (`GET /api/admin/system/overview`): is the server
 * healthy, and is anything failing? Disk, memory, database and table sizes,
 * the newest backup, backend starts (deploys and restarts), failed and slow
 * requests, and how long each scheduler job held the lock.
 *
 * Status only: alerts stay with their single emitters (disk-monitor.sh,
 * backup.sh, the daily health report). Read-only.
 *
 * @module services/admin/system/systemOverviewService
 */
import fs from 'fs';
import os from 'os';
import prisma from '../../../lib/prisma';
import logger from '../../../config/logger';
import { getConfig } from '../../../config/env';
import { getDiskUsage } from '../../../utils/systemHealth';
import { getLatestBackup } from '../../monitoring/backupStatus';
import { SCHEDULER_JOB_NAMES } from '../../cycle/schedulerJobNames';
import { lastUtcDays, unavailableByDay } from '../../practice-arena/practiceArenaUsageService';
import { classifyStarts, failuresSince, parseMemInfo, summarizeErrors, summarizeJobs, summarizeSlow, type MetricRow } from './systemRules';
import type { SystemDisk, SystemMemory, SystemOverview, SystemTable } from '../../../shared/types';

export const REQUEST_WINDOW_DAYS = 7;
export const JOB_WINDOW_DAYS = 8;
export const START_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_TABLES = 6;

function readDisk(): SystemDisk | null {
  const disk = getDiskUsage();
  if (disk.usagePercent < 0) return null;
  const totalMB = disk.usagePercent < 100 ? Math.round(disk.availableMB / (1 - disk.usagePercent / 100)) : null;
  return {
    usagePercent: disk.usagePercent,
    totalMB,
    usedMB: totalMB === null ? null : totalMB - disk.availableMB,
    availableMB: disk.availableMB,
    status: disk.status,
  };
}

function readMemory(): SystemMemory {
  try {
    const parsed = parseMemInfo(fs.readFileSync('/proc/meminfo', 'utf-8'));
    if (parsed) return parsed;
  } catch {
    // Not Linux (local macOS): fall back to the OS figures, without swap.
  }
  return {
    totalMB: Math.round(os.totalmem() / (1024 * 1024)),
    availableMB: Math.round(os.freemem() / (1024 * 1024)),
    swapTotalMB: null,
    swapUsedMB: null,
  };
}

async function readDatabase(): Promise<SystemOverview['database']> {
  try {
    const [[size], tables] = await Promise.all([
      prisma.$queryRaw<Array<{ size: bigint }>>`SELECT pg_database_size(current_database())::bigint AS size`,
      prisma.$queryRaw<Array<{ name: string; size: bigint; rows: bigint }>>`
        SELECT relname AS name, pg_total_relation_size(relid)::bigint AS size, n_live_tup::bigint AS rows
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT ${TOP_TABLES}`,
    ]);
    return {
      sizeBytes: Number(size?.size ?? 0),
      tables: tables.map((t): SystemTable => ({ name: t.name, sizeBytes: Number(t.size), rows: Number(t.rows) })),
    };
  } catch (error) {
    logger.warn('[System] Database sizes unavailable', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

export async function getSystemOverview(now: Date = new Date()): Promise<SystemOverview> {
  const requestDays = lastUtcDays(now, REQUEST_WINDOW_DAYS).reverse();
  const jobDays = lastUtcDays(now, JOB_WINDOW_DAYS).reverse();
  const requestFrom = new Date(Date.parse(`${requestDays[0]}T00:00:00.000Z`));
  const jobFrom = new Date(Date.parse(`${jobDays[0]}T00:00:00.000Z`));

  const [database, metrics, firstMetric, processes, runs] = await Promise.all([
    readDatabase(),
    prisma.requestMetric.findMany({ where: { hour: { gte: requestFrom } } }),
    prisma.requestMetric.findFirst({ orderBy: { hour: 'asc' }, select: { hour: true } }),
    prisma.schedulerProcess.findMany({
      where: { startedAt: { gte: new Date(now.getTime() - START_WINDOW_DAYS * DAY_MS) } },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true, deployTag: true },
    }),
    prisma.schedulerJobRun.findMany({
      where: { startedAt: { gte: jobFrom }, finishedAt: { not: null } },
      select: { jobName: true, status: true, startedAt: true, finishedAt: true },
    }),
  ]);
  // The start just before the window, so the oldest start in it can be told apart (deploy or restart).
  const before = processes.length > 0
    ? await prisma.schedulerProcess.findFirst({
      where: { startedAt: { lt: processes[processes.length - 1].startedAt } },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true, deployTag: true },
    })
    : null;

  const metricRows: MetricRow[] = metrics.map((m) => ({ ...m, totalMs: Number(m.totalMs) }));
  const finished = runs.flatMap((run) => (run.startedAt && run.finishedAt
    ? [{ jobName: run.jobName, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt }]
    : []));
  const lock = unavailableByDay(finished.map((run) => ({ start: run.startedAt, end: run.finishedAt })), jobDays, now);
  const starts = classifyStarts(before ? [...processes, before] : processes).slice(0, processes.length);
  const uptimeSeconds = Math.round(process.uptime());
  const backup = getLatestBackup(now);

  return {
    generatedAt: now.toISOString(),
    disk: readDisk(),
    memory: readMemory(),
    database,
    backup: { status: backup.status, file: backup.file, at: backup.at?.toISOString() ?? null, sizeBytes: backup.sizeBytes, note: backup.note },
    backend: {
      startedAt: new Date(now.getTime() - uptimeSeconds * 1000).toISOString(),
      uptimeSeconds,
      deployTag: getConfig().deployTag ?? null,
      nodeVersion: process.version,
    },
    starts,
    requests: {
      windowDays: REQUEST_WINDOW_DAYS,
      days: requestDays,
      failures24h: failuresSince(metricRows, new Date(now.getTime() - DAY_MS)),
      errors: summarizeErrors(metricRows, requestDays),
      slow: summarizeSlow(metricRows),
      recordingSince: firstMetric?.hour.toISOString() ?? null,
    },
    jobs: {
      windowDays: JOB_WINDOW_DAYS,
      rows: summarizeJobs(finished, SCHEDULER_JOB_NAMES),
      lockPerDay: jobDays.map((day) => ({ day, ms: lock.get(day) ?? 0 })),
    },
  };
}

/** Server errors of the last 24 hours and the route with the most, for the Dashboard. */
export async function getRequestFailures(now: Date = new Date()): Promise<{ failures24h: number; topRoute: string | null; topCode: string | null }> {
  const since = new Date(now.getTime() - DAY_MS);
  since.setUTCMinutes(0, 0, 0);
  const rows = await prisma.requestMetric.findMany({ where: { kind: 'error', hour: { gte: since } } });
  const metricRows: MetricRow[] = rows.map((m) => ({ ...m, totalMs: Number(m.totalMs) }));
  const [top] = summarizeErrors(metricRows, []);
  return { failures24h: failuresSince(metricRows, new Date(now.getTime() - DAY_MS)), topRoute: top ? `${top.method} ${top.route}` : null, topCode: top?.code ?? null };
}
