/**
 * Labels, URL state and text helpers of the admin Security page.
 */
import { formatAgo, formatCount } from './adminDashboardFormat';
import {
  DEFAULT_SECURITY_WINDOW,
  SECURITY_WINDOWS,
} from './adminSecurityApi';
import type { SecuritySignal, SecurityWindow, SignalCard, SignalSummary } from '@shared/types';

export const WINDOW_LABELS: Readonly<Record<SecurityWindow, string>> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

export const SIGNAL_LABELS: Readonly<Record<SignalCard, string>> = {
  failed_login: 'Failed logins',
  rate_limit: 'Rate-limit hits',
  ownership_violation: 'Ownership violations',
  race_condition_burst: 'Race-condition bursts',
  robot_creation_burst: 'Robot-creation bursts',
  nsfw_block: 'NSFW blocks',
};

export const SIGNAL_HINTS: Readonly<Record<SignalCard, string>> = {
  failed_login: 'wrong password or unknown name',
  rate_limit: 'any limiter, per player or IP',
  ownership_violation: "another stable's items, or an admin page",
  race_condition_burst: '11+ conflicts in a minute',
  robot_creation_burst: '4+ robots in 10 minutes',
  nsfw_block: 'upload refused by the filter',
};

/** Chip labels in the "Stables with signals" table (no NSFW: those live on Image Uploads). */
export const STABLE_SIGNAL_LABELS: Readonly<Record<SecuritySignal, string>> = {
  failed_login: 'Failed logins',
  rate_limit: 'Rate-limit hits',
  ownership_violation: 'Ownership violations',
  race_condition_burst: 'Race-condition bursts',
  robot_creation_burst: 'Robot-creation bursts',
  malformed_request: 'Malformed requests',
};

export function readSecurityWindow(params: URLSearchParams): SecurityWindow {
  const value = params.get('window');
  return (SECURITY_WINDOWS as readonly string[]).includes(value ?? '') ? (value as SecurityWindow) : DEFAULT_SECURITY_WINDOW;
}

export function writeSecurityWindow(params: URLSearchParams, window: SecurityWindow): URLSearchParams {
  const next = new URLSearchParams(params);
  if (window === DEFAULT_SECURITY_WINDOW) next.delete('window');
  else next.set('window', window);
  return next;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Axis label of a bucket: "14:00" (hourly) or "Sun 26" (daily), UTC. */
export function bucketLabel(iso: string, bucket: 'hour' | 'day'): string {
  const date = new Date(iso);
  if (bucket === 'hour') return `${String(date.getUTCHours()).padStart(2, '0')}:00`;
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()}`;
}

/** "Wed 29, 21:14" in UTC. */
export function shortDateTime(iso: string): string {
  const date = new Date(iso);
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()}, ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

/** "3h ago", or "never" when the signal has not fired since recording began. */
export function lastSeenLabel(iso: string | null, now: Date): string {
  return iso ? formatAgo(iso, now) : 'never';
}

/**
 * The status line: which signal types fired in the window.
 * "2 of 6 signal types fired in the last 7 days: failed logins (14) and rate-limit hits (6)."
 */
export function firedSummary(signals: readonly SignalSummary[], window: SecurityWindow): { quiet: boolean; text: string } {
  const fired = signals.filter((s) => s.total > 0);
  const span = WINDOW_LABELS[window].toLowerCase();
  if (fired.length === 0) return { quiet: true, text: `No signals in the ${span}.` };
  const parts = fired.map((s) => `${SIGNAL_LABELS[s.signal].toLowerCase()} (${formatCount(s.total)})`);
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return { quiet: false, text: `${fired.length} of ${signals.length} signal types fired in the ${span}: ${list}.` };
}

export function stableLabel(row: { stableName: string | null; username: string | null; userId: number }): string {
  return row.stableName ?? row.username ?? `Deleted stable #${row.userId}`;
}
