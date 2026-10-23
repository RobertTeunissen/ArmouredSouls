/**
 * Pure helpers of the admin Practice Arena page: day labels, shares and the
 * "Refused" / "Unavailable" lines. Unit-tested without rendering.
 */
import type { PracticeDayStats, PracticeMatchup } from './adminPracticeArenaApi';
import { formatDuration } from './adminCycleFormat';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "21 Oct" for a "YYYY-MM-DD" key. */
export function shortDate(key: string): string {
  const date = new Date(`${key}T00:00:00.000Z`);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** "Today (so far)", "Yesterday", "21 Oct" relative to `now` (UTC). */
export function dayLabel(key: string, now: Date): string {
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(Date.parse(`${today}T00:00:00.000Z`) - 86_400_000).toISOString().slice(0, 10);
  if (key === today) return 'Today (so far)';
  if (key === yesterday) return 'Yesterday';
  return shortDate(key);
}

/** "48m", "1h 44m", "—" before run history; whole minutes are enough here. */
export function formatUnavailable(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 60_000) return ms === 0 ? '0m' : '<1m';
  return formatDuration(ms).replace(/ 0?(\d+)s$/, '');
}

/** "72%" of `total`, "0%" when there is none. */
export function share(part: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

export const MATCHUP_LABELS: Readonly<Record<PracticeMatchup, string>> = {
  owned_vs_sparring: 'Own vs sparring',
  owned_vs_owned: 'Own vs own',
  sparring_vs_sparring: 'Sparring vs sparring',
};

/** "2 rate limit · 5 during a job" (the strip's refused caption). */
export function refusedCaption(day: Pick<PracticeDayStats, 'rateLimited' | 'cycleBusy'>): string {
  return `${day.rateLimited} rate limit · ${day.cycleBusy} during a job`;
}

/** "1,234". */
export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}
