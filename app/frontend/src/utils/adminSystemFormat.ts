/**
 * Pure helpers of the admin System page: sizes, error-code labels, the status
 * cards and the scheduler lock summary. Unit-tested without rendering.
 */
import { formatDayTime } from './adminCycleFormat';
import { formatAgo, formatDuration as formatCompactDuration } from './adminDashboardFormat';
import { errorCodeLabel, formatCount } from './adminFormat';
import { shortDate } from './adminPracticeArenaFormat';
import type { SystemJob, SystemOverview } from '@shared/types';

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

/** "15 GB", "5.4 GB", "534 MB", "12 kB", "800 B" (one decimal below 10 GB). */
export function formatSize(bytes: number): string {
  if (bytes >= 10 * GB) return `${Math.round(bytes / GB)} GB`;
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= MB) return `${Math.round(bytes / MB)} MB`;
  if (bytes >= KB) return `${Math.round(bytes / KB)} kB`;
  return `${bytes} B`;
}

/** Megabytes as "940 MB", from 1 GB "1.9 GB", from 10 GB "29 GB". */
export function formatMegabytes(mb: number): string {
  return formatSize(Math.round(mb * MB));
}

/** "3.5M", "214k", "857". */
export function formatRows(rows: number): string {
  if (rows >= 1_000_000) return `${(rows / 1_000_000).toFixed(1)}M`;
  if (rows >= 10_000) return `${Math.round(rows / 1000)}k`;
  return formatCount(rows);
}

export { errorCodeLabel };

/** "1.2 s", "31 s", "2m 05s". */
export function formatRequestMs(ms: number): string {
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

export type SystemTone = 'ok' | 'warning' | 'error' | 'info' | 'muted';

export interface SystemCard {
  key: 'disk' | 'database' | 'memory' | 'backup' | 'backend' | 'requests';
  label: string;
  value: string;
  caption: string;
  tone: SystemTone;
}

/** Below this share of memory available the Memory card turns amber. */
export const MEMORY_LOW_SHARE = 0.15;

function diskCard(disk: SystemOverview['disk']): SystemCard {
  const base = { key: 'disk' as const, label: 'Disk' };
  if (!disk) return { ...base, value: '—', caption: 'Could not be read', tone: 'muted' };
  const tone: SystemTone = disk.status === 'critical' ? 'error' : disk.status === 'warning' ? 'warning' : 'ok';
  const caption = disk.usedMB !== null && disk.totalMB !== null
    ? `${formatMegabytes(disk.usedMB)} of ${formatMegabytes(disk.totalMB)} used`
    : `${formatMegabytes(disk.availableMB)} free`;
  return { ...base, value: `${disk.usagePercent}%`, caption, tone };
}

function databaseCard(database: SystemOverview['database']): SystemCard {
  const base = { key: 'database' as const, label: 'Database' };
  if (!database) return { ...base, value: '—', caption: 'Sizes could not be read', tone: 'muted' };
  const [largest] = database.tables;
  return {
    ...base,
    value: formatSize(database.sizeBytes),
    caption: largest ? `largest: ${largest.name} ${formatSize(largest.sizeBytes)}` : 'no tables',
    tone: 'info',
  };
}

function memoryCard(memory: SystemOverview['memory']): SystemCard {
  const low = memory.totalMB > 0 && memory.availableMB / memory.totalMB < MEMORY_LOW_SHARE;
  const swap = memory.swapUsedMB !== null && memory.swapUsedMB > 0 ? ` · swap ${formatMegabytes(memory.swapUsedMB)} in use` : '';
  return {
    key: 'memory',
    label: 'Memory',
    value: `${formatMegabytes(memory.availableMB)} free`,
    caption: `of ${formatMegabytes(memory.totalMB)}${swap}`,
    tone: low ? 'warning' : 'ok',
  };
}

function backupCard(backup: SystemOverview['backup'], now: Date): SystemCard {
  const base = { key: 'backup' as const, label: 'Last backup' };
  if (backup.status === 'not_applicable') return { ...base, value: '—', caption: backup.note ?? 'Not applicable', tone: 'muted' };
  if (backup.status === 'missing' || !backup.at) return { ...base, value: 'None', caption: backup.note ?? 'No backup found', tone: 'error' };
  const size = backup.sizeBytes !== null ? `${formatSize(backup.sizeBytes)} · ` : '';
  return {
    ...base,
    value: formatDayTime(backup.at, now),
    caption: `${size}${formatAgo(backup.at, now)}${backup.status === 'stale' ? ' · older than a day' : ''}`,
    tone: backup.status === 'stale' ? 'warning' : 'ok',
  };
}

function backendCard(backend: SystemOverview['backend'], now: Date): SystemCard {
  return {
    key: 'backend',
    label: 'Backend',
    value: backend.uptimeSeconds < 60 ? 'just started' : `up ${formatCompactDuration(backend.uptimeSeconds * 1000)}`,
    caption: `since ${formatDayTime(backend.startedAt, now)} UTC`,
    tone: 'info',
  };
}

function requestsCard(requests: SystemOverview['requests']): SystemCard {
  const base = { key: 'requests' as const, label: 'Failing requests', value: formatCount(requests.failures24h) };
  if (requests.recordingSince === null) return { ...base, caption: 'Nothing recorded yet', tone: 'muted' };
  if (requests.failures24h === 0) return { ...base, caption: 'none in the last 24 h', tone: 'ok' };
  const [top] = requests.errors;
  return { ...base, caption: top ? `in 24 h · ${top.page} (${errorCodeLabel(top.code)})` : 'in the last 24 h', tone: 'error' };
}

/** The six status cards, in page order. */
export function deriveSystemCards(overview: SystemOverview, now: Date): SystemCard[] {
  return [
    diskCard(overview.disk),
    databaseCard(overview.database),
    memoryCard(overview.memory),
    backupCard(overview.backup, now),
    backendCard(overview.backend, now),
    requestsCard(overview.requests),
  ];
}

/** A slowest run this much longer than the median is highlighted. */
export const SLOW_RUN_FACTOR = 1.5;

export function isSlowOutlier(job: Pick<SystemJob, 'slowest' | 'medianMs'>): boolean {
  return job.slowest !== null && job.medianMs !== null && job.medianMs > 0 && job.slowest.durationMs > job.medianMs * SLOW_RUN_FACTOR;
}

/** "31 Oct · 1 interrupted · 2 failed" next to the slowest run. */
export function jobNote(job: SystemJob): string {
  const parts: string[] = [];
  if (job.slowest) parts.push(shortDate(job.slowest.startedAt.slice(0, 10)));
  if (job.interrupted > 0) parts.push(`${job.interrupted} interrupted`);
  if (job.failed > 0) parts.push(`${job.failed} failed`);
  return parts.join(' · ');
}

export interface LockSummary {
  minMs: number;
  maxMs: number;
  medianMs: number;
  /** "26 Oct – 2 Nov". */
  range: string;
}

/** Range and median of the lock time per day; null without days. */
export function summarizeLock(days: ReadonlyArray<{ day: string; ms: number }>): LockSummary | null {
  if (days.length === 0) return null;
  const values = days.map((d) => d.ms).sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  const medianMs = values.length % 2 === 1 ? values[mid] : Math.round((values[mid - 1] + values[mid]) / 2);
  return {
    minMs: values[0],
    maxMs: values[values.length - 1],
    medianMs,
    range: `${shortDate(days[0].day)} – ${shortDate(days[days.length - 1].day)}`,
  };
}

/** Bar heights as a share (0–1) of the largest value; all zero when every value is zero. */
export function barShares(values: readonly number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((value) => (max > 0 ? value / max : 0));
}
