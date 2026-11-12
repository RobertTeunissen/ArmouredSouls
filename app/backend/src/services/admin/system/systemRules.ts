import type {
  SystemJob,
  SystemJobRun,
  SystemRequestError,
  SystemSlowRequest,
  SystemStart,
} from '../../../shared/types';

/**
 * Pure rules of the admin System page: which backend starts were deploys,
 * job duration statistics, request-metric summaries and the page a route
 * belongs to. Exported for tests.
 */

export interface ProcessRow {
  startedAt: Date;
  deployTag: string | null;
}

/**
 * Newest first. A start is a deploy when it carries a deploy tag the start
 * before it did not have: PM2 keeps the environment of the last deploy, so a
 * crash restart or host reboot repeats the tag and is a plain restart.
 */
export function classifyStarts(rows: readonly ProcessRow[]): SystemStart[] {
  const oldestFirst = [...rows].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const classified = oldestFirst.map((row, index) => {
    const previous = index > 0 ? oldestFirst[index - 1].deployTag : undefined;
    const isDeploy = row.deployTag !== null && row.deployTag !== previous;
    return { at: row.startedAt.toISOString(), kind: isDeploy ? 'deploy' as const : 'restart' as const, deployTag: row.deployTag };
  });
  return classified.reverse();
}

export interface JobRunRow {
  jobName: string;
  status: string;
  startedAt: Date;
  finishedAt: Date;
}

/** Lower median of a sorted copy; null when empty. */
export function medianOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Per job, in `jobOrder`: finished runs oldest first, last run, median of successes, slowest. */
export function summarizeJobs(runs: readonly JobRunRow[], jobOrder: readonly string[]): SystemJob[] {
  const byJob = new Map<string, SystemJobRun[]>();
  for (const run of [...runs].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())) {
    const list = byJob.get(run.jobName) ?? [];
    list.push({ startedAt: run.startedAt.toISOString(), durationMs: Math.max(0, run.finishedAt.getTime() - run.startedAt.getTime()), status: run.status });
    byJob.set(run.jobName, list);
  }
  const names = [...jobOrder, ...[...byJob.keys()].filter((name) => !jobOrder.includes(name))];
  return names.filter((name) => byJob.has(name)).map((jobName) => {
    const list = byJob.get(jobName) ?? [];
    const successes = list.filter((run) => run.status === 'success');
    const slowest = list.reduce<SystemJobRun | null>((max, run) => (max === null || run.durationMs > max.durationMs ? run : max), null);
    return {
      jobName,
      runs: list,
      last: list.at(-1) ?? null,
      medianMs: medianOf(successes.map((run) => run.durationMs)),
      slowest,
      interrupted: list.filter((run) => run.status === 'interrupted').length,
      failed: list.filter((run) => run.status === 'failed').length,
    };
  });
}

export interface MetricRow {
  hour: Date;
  kind: string;
  method: string;
  route: string;
  code: string;
  count: number;
  totalMs: number;
  maxMs: number;
  lastAt: Date;
}

const PAGE_OF_ROUTE: ReadonlyArray<readonly [string, string]> = [
  ['/api/admin/dashboard', 'Dashboard'],
  ['/api/admin/system', 'System'],
  ['/api/admin/scheduler', 'Cycle Controls'],
  ['/api/admin/cycles', 'Cycle Controls'],
  ['/api/admin/seasons', 'Season Control'],
  ['/api/admin/practice-arena', 'Practice Arena'],
  ['/api/admin/battles', 'Battles'],
  ['/api/admin/analysis/attributes', 'Attributes'],
  ['/api/admin/analysis/weapons', 'Weapons'],
  ['/api/admin/meta', 'Meta'],
  ['/api/admin/league-health', 'League Health'],
  ['/api/admin/tournaments', 'Tournaments'],
  ['/api/admin/players', 'Players'],
  ['/api/admin/users', 'Players'],
  ['/api/admin/economy', 'Economy'],
  ['/api/admin/automatons/strategies', 'Automatons · Strategies'],
  ['/api/admin/automatons', 'Automatons'],
  ['/api/admin/security', 'Security'],
  ['/api/admin/images', 'Image Uploads'],
  ['/api/admin/actions', 'Admin actions'],
  ['/api/admin/achievements', 'Achievements'],
  ['/api/admin/search-analytics', 'Search Analytics'],
  ['/api/changelog/admin', 'Changelog'],
];

/** The admin page a route serves, or the API area ("Robots", "Finances") for player routes. */
export function pageOfRoute(route: string): string {
  const match = PAGE_OF_ROUTE.find(([prefix]) => route === prefix || route.startsWith(`${prefix}/`));
  if (match) return match[1];
  const area = route.split('/')[2];
  if (!area) return 'API';
  const words = area.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Server errors per route and code, most first, with per-day counts over `days` (oldest first). */
export function summarizeErrors(rows: readonly MetricRow[], days: readonly string[]): SystemRequestError[] {
  const groups = new Map<string, SystemRequestError>();
  for (const row of rows) {
    if (row.kind !== 'error') continue;
    const key = `${row.method} ${row.route} ${row.code}`;
    const group = groups.get(key) ?? {
      method: row.method, route: row.route, page: pageOfRoute(row.route), code: row.code, count: 0, lastAt: row.lastAt.toISOString(), perDay: days.map(() => 0),
    };
    group.count += row.count;
    if (row.lastAt.toISOString() > group.lastAt) group.lastAt = row.lastAt.toISOString();
    const dayIndex = days.indexOf(row.hour.toISOString().slice(0, 10));
    if (dayIndex >= 0) group.perDay[dayIndex] += row.count;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt));
}

/** Slow requests per route, most first: count, average and slowest. */
export function summarizeSlow(rows: readonly MetricRow[]): SystemSlowRequest[] {
  const groups = new Map<string, { row: SystemSlowRequest; totalMs: number }>();
  for (const row of rows) {
    if (row.kind !== 'slow') continue;
    const key = `${row.method} ${row.route}`;
    const group = groups.get(key) ?? {
      row: { method: row.method, route: row.route, page: pageOfRoute(row.route), count: 0, avgMs: 0, maxMs: 0, lastAt: row.lastAt.toISOString() },
      totalMs: 0,
    };
    group.row.count += row.count;
    group.totalMs += row.totalMs;
    group.row.maxMs = Math.max(group.row.maxMs, row.maxMs);
    if (row.lastAt.toISOString() > group.row.lastAt) group.row.lastAt = row.lastAt.toISOString();
    groups.set(key, group);
  }
  return [...groups.values()]
    .map(({ row, totalMs }) => ({ ...row, avgMs: row.count > 0 ? Math.round(totalMs / row.count) : 0 }))
    .sort((a, b) => b.count - a.count || b.maxMs - a.maxMs);
}

/**
 * Server errors counted from the hour that contains `since` onwards. Counts
 * are per hour, so "last 24 hours" can include up to an hour more.
 */
export function failuresSince(rows: readonly MetricRow[], since: Date): number {
  const fromHour = new Date(since);
  fromHour.setUTCMinutes(0, 0, 0);
  return rows
    .filter((row) => row.kind === 'error' && row.hour.getTime() >= fromHour.getTime())
    .reduce((total, row) => total + row.count, 0);
}

/** `MemTotal`, `MemAvailable`, `SwapTotal`, `SwapFree` from /proc/meminfo, in MB; null when missing. */
export function parseMemInfo(text: string): { totalMB: number; availableMB: number; swapTotalMB: number; swapUsedMB: number } | null {
  const values = new Map<string, number>();
  for (const line of text.split('\n')) {
    const match = /^(\w+):\s+(\d+)\s*kB/.exec(line);
    if (match) values.set(match[1], Number(match[2]));
  }
  const kb = (name: string): number | null => values.get(name) ?? null;
  const total = kb('MemTotal');
  const available = kb('MemAvailable');
  const swapTotal = kb('SwapTotal');
  const swapFree = kb('SwapFree');
  if (total === null || available === null) return null;
  return {
    totalMB: Math.round(total / 1024),
    availableMB: Math.round(available / 1024),
    swapTotalMB: Math.round((swapTotal ?? 0) / 1024),
    swapUsedMB: Math.round(((swapTotal ?? 0) - (swapFree ?? 0)) / 1024),
  };
}
