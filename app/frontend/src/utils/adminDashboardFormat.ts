/**
 * Pure formatting and derivation helpers for the admin dashboard.
 *
 * The backend returns facts only; everything a person reads (labels, relative
 * times, trend colours, "Needs attention" severities) is derived here so it can
 * be unit-tested without rendering.
 */
import type { DashboardStatus } from './adminDashboardApi';
import type { UserFilterType } from '../components/admin/shared';

const DASHBOARD_FILTERS: readonly UserFilterType[] = ['real', 'auto', 'automaton', 'all'];

/** The dashboard's default filter: human players. Omitted from the URL. */
export const DEFAULT_DASHBOARD_FILTER: UserFilterType = 'real';

/** The `?filter=` value, falling back to the default for a missing or unknown value. */
export function readDashboardFilter(value: string | null): UserFilterType {
  return DASHBOARD_FILTERS.find((filter) => filter === value) ?? DEFAULT_DASHBOARD_FILTER;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Battle mode labels, keyed by `battles.battle_type` / `MatchType`. */
const MODE_LABELS: Readonly<Record<string, string>> = {
  league_1v1: 'League 1v1',
  league_2v2: 'League 2v2',
  league_3v3: 'League 3v3',
  tag_team: 'Tag Team',
  koth: 'King of the Hill',
  grand_melee: 'Grand Melee',
  tournament_1v1: 'Tournament 1v1',
  tournament_2v2: 'Tournament 2v2',
  tournament_3v3: 'Tournament 3v3',
};

/** Scheduler job labels, keyed by `SchedulerJobName`. */
const JOB_LABELS: Readonly<Record<string, string>> = {
  league: 'League 1v1',
  team2v2League: 'League 2v2',
  team3v3League: 'League 3v3',
  tournament: 'Tournament 1v1',
  team2v2Tournament: 'Tournament 2v2',
  team3v3Tournament: 'Tournament 3v3',
  tagTeam: 'Tag Team',
  koth: 'King of the Hill',
  grandMelee: 'Grand Melee',
  settlement: 'Settlement',
};

function humanize(key: string): string {
  const spaced = key.replace(/_/g, ' ').replace(/([a-z])([A-Z0-9])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function modeLabel(mode: string): string {
  return MODE_LABELS[mode] ?? humanize(mode);
}

export function jobLabel(job: string): string {
  return JOB_LABELS[job] ?? humanize(job);
}

/** Integer with thousands separators ("73,792"). */
export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

/** One decimal ("4.2"). */
export function formatDecimal(value: number): string {
  return value.toFixed(1);
}

/** Wall-clock time in UTC ("02:00 UTC"); with seconds for "Last updated". */
export function formatUtcTime(iso: string, withSeconds = false): string {
  const date = new Date(iso);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return withSeconds ? `${hh}:${mm}:${ss} UTC` : `${hh}:${mm} UTC`;
}

/** Compact duration ("12h", "11h 58m", "3m", "2d 4h"). */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / MINUTE));
  if (total < 1) return 'under a minute';
  const days = Math.floor(total / (24 * 60));
  const hours = Math.floor((total % (24 * 60)) / 60);
  const minutes = total % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

/** "12h ago" / "just now". */
export function formatAgo(iso: string, now: Date): string {
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < MINUTE) return 'just now';
  return `${formatDuration(diff)} ago`;
}

/** "in 11h 58m" / "now". */
export function formatUntil(iso: string, now: Date): string {
  const diff = new Date(iso).getTime() - now.getTime();
  if (diff < MINUTE) return 'now';
  return `in ${formatDuration(diff)}`;
}

/** Whether a rising value is good or bad news. */
export type TrendIntent = 'higher-is-better' | 'lower-is-better';
export type TrendTone = 'good' | 'bad' | 'neutral';

export interface Trend {
  direction: 'up' | 'down' | 'neutral';
  /** Absolute change. */
  delta: number;
  tone: TrendTone;
}

/** Trend from current vs previous; null when there is nothing to compare with. */
export function computeTrend(current: number, previous: number | null, intent: TrendIntent): Trend | null {
  if (previous === null) return null;
  const delta = current - previous;
  if (delta === 0) return { direction: 'neutral', delta: 0, tone: 'neutral' };
  const up = delta > 0;
  const good = intent === 'higher-is-better' ? up : !up;
  return { direction: up ? 'up' : 'down', delta: Math.abs(delta), tone: good ? 'good' : 'bad' };
}

/* ------------------------------------------------------------------ */
/*  Needs attention                                                   */
/* ------------------------------------------------------------------ */

export type AttentionSeverity = 'error' | 'warning' | 'unavailable' | 'ok';

export interface AttentionItem {
  key: 'bankruptcy' | 'security' | 'automatons' | 'cycle';
  severity: AttentionSeverity;
  /** Shown in the badge; null for OK and unavailable items. */
  count: number | null;
  title: string;
  detail: string;
  href: string;
  /** Destination page name, used in the accessible link name. */
  destination: string;
}

const SEVERITY_ORDER: Readonly<Record<AttentionSeverity, number>> = { error: 0, warning: 1, unavailable: 2, ok: 3 };

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

function bankruptcyItem(fact: DashboardStatus['attention']['bankruptcyRisk']): AttentionItem {
  const base = { key: 'bankruptcy' as const, href: '/admin/players?tab=at-risk', destination: 'Players' };
  if (fact === null) {
    return { ...base, severity: 'unavailable', count: null, title: 'Bankruptcy risk unavailable', detail: 'Could not be read' };
  }
  const threshold = `₡${formatCount(fact.threshold)}`;
  if (fact.count === 0) {
    return { ...base, severity: 'ok', count: null, title: 'No stables at bankruptcy risk', detail: `Every human stable holds ${threshold} or more` };
  }
  return {
    ...base,
    severity: 'error',
    count: fact.count,
    title: plural(fact.count, 'Stable at bankruptcy risk', 'Stables at bankruptcy risk'),
    detail: `Human stables below ${threshold}`,
  };
}

function securityItem(fact: DashboardStatus['attention']['security']): AttentionItem {
  const base = { key: 'security' as const, href: '/admin/security', destination: 'Security' };
  if (fact === null) {
    return { ...base, severity: 'unavailable', count: null, title: 'Security status unavailable', detail: 'Could not be read' };
  }
  if (fact.activeAlerts === 0) {
    return { ...base, severity: 'ok', count: null, title: 'No active security alerts', detail: 'No recent warning or critical events' };
  }
  const warnings = fact.activeAlerts - fact.critical;
  const parts = [
    fact.critical > 0 ? `${fact.critical} critical` : null,
    warnings > 0 ? `${warnings} ${plural(warnings, 'warning', 'warnings')}` : null,
  ].filter((part): part is string => part !== null);
  return {
    ...base,
    severity: fact.critical > 0 ? 'error' : 'warning',
    count: fact.activeAlerts,
    title: plural(fact.activeAlerts, 'Active security alert', 'Active security alerts'),
    detail: parts.join(' · '),
  };
}

function automatonItem(fact: DashboardStatus['attention']['automatons']): AttentionItem {
  const base = { key: 'automatons' as const, href: '/admin/automatons?tab=stables&filter=attention', destination: 'Automatons' };
  if (fact === null) {
    return { ...base, severity: 'unavailable', count: null, title: 'Automaton status unavailable', detail: 'Could not be read' };
  }
  if (fact.needAttention === 0) {
    return { ...base, severity: 'ok', count: null, title: 'No Automatons need attention', detail: 'Every active Automaton is spending normally' };
  }
  return {
    ...base,
    severity: fact.failed > 0 ? 'error' : 'warning',
    count: fact.needAttention,
    title: plural(fact.needAttention, 'Automaton needs attention', 'Automatons need attention'),
    detail: fact.failed > 0
      ? `${fact.failed} with a failed turn`
      : 'Negative balance or nothing bought for 14 cycles',
  };
}

function cycleItem(status: DashboardStatus): AttentionItem {
  const base = { key: 'cycle' as const, href: '/admin/cycles', destination: 'Cycle Controls' };
  const { cycleHealth } = status.attention;
  const { scheduler } = status;
  const problems: string[] = [];
  if (cycleHealth.settlementOverdue) problems.push('Settlement overdue');
  if (cycleHealth.failedJobs.length > 0) {
    problems.push(`${plural(cycleHealth.failedJobs.length, 'Job', 'Jobs')} failed: ${cycleHealth.failedJobs.map(jobLabel).join(', ')}`);
  }
  if (cycleHealth.stuckMatches > 0) {
    problems.push(`${formatCount(cycleHealth.stuckMatches)} ${plural(cycleHealth.stuckMatches, 'match', 'matches')} left behind`);
  }
  if (problems.length > 0) {
    return {
      ...base,
      severity: 'error',
      count: problems.length,
      title: plural(problems.length, 'Cycle problem', 'Cycle problems'),
      detail: problems.join(' · '),
    };
  }

  let jobs: string;
  if (!scheduler.active) {
    jobs = 'Scheduler disabled';
  } else if (scheduler.jobsNotYetReported > 0) {
    const reported = scheduler.jobsTotal - scheduler.jobsNotYetReported;
    jobs = `${reported}/${scheduler.jobsTotal} jobs reported since restart at ${formatUtcTime(scheduler.processStartedAt)}`;
  } else {
    jobs = `${scheduler.jobsSucceeded}/${scheduler.jobsTotal} jobs succeeded`;
  }
  return { ...base, severity: 'ok', count: null, title: 'Last cycle healthy', detail: `${jobs} · 0 matches left behind` };
}

/** The "Needs attention" items, open ones first (errors, then warnings). */
export function deriveAttentionItems(status: DashboardStatus): AttentionItem[] {
  const items = [
    bankruptcyItem(status.attention.bankruptcyRisk),
    securityItem(status.attention.security),
    automatonItem(status.attention.automatons),
    cycleItem(status),
  ];
  // Array.prototype.sort is stable, so equal severities keep the order above.
  return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export function countOpenItems(items: readonly AttentionItem[]): number {
  return items.filter((item) => item.severity === 'error' || item.severity === 'warning').length;
}

/* ------------------------------------------------------------------ */
/*  Status strip                                                      */
/* ------------------------------------------------------------------ */

export type StatusTone = 'ok' | 'error' | 'info' | 'muted';

export interface StatusCell {
  key: 'cycle' | 'last' | 'next' | 'scheduler' | 'queued';
  label: string;
  value: string;
  /** Shows a coloured dot before the value; null for none. */
  tone: StatusTone | null;
}

export function deriveStatusCells(status: DashboardStatus, now: Date): StatusCell[] {
  const { cycle, season, scheduler, attention } = status;

  const seasonText = season
    ? `Season ${season.number}${season.phase === 'preparation' ? ' (preparation)' : ''}`
    : 'Season unavailable';

  const last: StatusCell = cycle.lastSettlementAt
    ? {
        key: 'last',
        label: 'Last cycle',
        value: `${formatUtcTime(cycle.lastSettlementAt)} · ${formatAgo(cycle.lastSettlementAt, now)}`,
        tone: attention.cycleHealth.settlementOverdue ? 'error' : 'ok',
      }
    : { key: 'last', label: 'Last cycle', value: 'No settlement yet', tone: attention.cycleHealth.settlementOverdue ? 'error' : 'muted' };

  let next: StatusCell;
  if (!scheduler.active) next = { key: 'next', label: 'Next cycle', value: 'Scheduler disabled', tone: 'muted' };
  else if (cycle.nextSettlementAt) {
    next = { key: 'next', label: 'Next cycle', value: `${formatUtcTime(cycle.nextSettlementAt)} · ${formatUntil(cycle.nextSettlementAt, now)}`, tone: null };
  } else next = { key: 'next', label: 'Next cycle', value: 'Not scheduled', tone: 'muted' };

  let schedulerCell: StatusCell;
  if (!scheduler.active) schedulerCell = { key: 'scheduler', label: 'Scheduler', value: 'Disabled', tone: 'muted' };
  else if (scheduler.jobsFailed.length > 0) {
    schedulerCell = { key: 'scheduler', label: 'Scheduler', value: `${scheduler.jobsFailed.length} of ${scheduler.jobsTotal} jobs failed`, tone: 'error' };
  } else if (scheduler.runningJob) {
    schedulerCell = { key: 'scheduler', label: 'Scheduler', value: `Running ${jobLabel(scheduler.runningJob)}`, tone: 'info' };
  } else {
    schedulerCell = { key: 'scheduler', label: 'Scheduler', value: `Healthy · ${scheduler.jobsTotal} jobs`, tone: 'ok' };
  }

  return [
    { key: 'cycle', label: 'Cycle', value: `${formatCount(cycle.number)} · ${seasonText}`, tone: null },
    last,
    next,
    schedulerCell,
    {
      key: 'queued',
      label: 'Queued matches',
      value: status.queuedMatches === null ? 'Unavailable' : formatCount(status.queuedMatches),
      tone: null,
    },
  ];
}

/** Elapsed-time constants, exported for tests. */
export const TIME = { MINUTE, HOUR, DAY } as const;
