/**
 * Pure helpers of Cycle Controls: job labels and descriptions, durations,
 * UTC day labels and the one-line run result. Unit-tested without rendering.
 */
import type { MissedRun, SchedulerJobName, SchedulerRun, SchedulerRunStatus, SchedulerRunTrigger } from './adminCycleApi';
import { BULK_CYCLES_JOB_NAME, SEASON_ROLLOVER_JOB_NAME } from './adminCycleApi';
import { jobLabel as dashboardJobLabel } from './adminDashboardFormat';

/** What a manual run does, for the confirmation dialog. */
export const JOB_DESCRIPTIONS: Readonly<Record<SchedulerJobName, string>> = {
  settlement: 'Closes the current cycle for every stable: passive income, operating costs, snapshot, user generation and Automaton turns, exactly as the 00:00 cron run.',
  league: 'Repair → battles → rebalance → matchmaking for the 1v1 league, as the cron run.',
  team2v2League: 'Repair → battles → rebalance → matchmaking for the 2v2 league, as the cron run.',
  tournament: 'Repair → current round → advance winners → create the next tournament if none is active, as the cron run.',
  tagTeam: 'Repair → battles → rebalance → matchmaking for Tag Team, as the cron run.',
  koth: 'Repair → battles → rebalance → matchmaking for King of the Hill, as the cron run.',
  team3v3League: 'Repair → battles → rebalance → matchmaking for the 3v3 league, as the cron run.',
  team2v2Tournament: 'Repair → current round → advance winners → create the next tournament if none is active, as the cron run.',
  grandMelee: 'Repair → battles → rebalance → matchmaking for Grand Melee, as the cron run.',
  team3v3Tournament: 'Repair → current round → advance winners → create the next tournament if none is active, as the cron run.',
};

/** The dashboard's job labels ("League 1v1"), so every admin page names a job the same way. */
export function jobLabel(jobName: string): string {
  if (jobName === BULK_CYCLES_JOB_NAME) return 'Bulk cycles';
  if (jobName === SEASON_ROLLOVER_JOB_NAME) return 'Season rollover';
  return dashboardJobLabel(jobName);
}

const BATTLE_WORD: Readonly<Partial<Record<string, string>>> = {
  league: 'battles',
  team2v2League: 'battles',
  team3v3League: 'battles',
  tagTeam: 'battles',
  koth: 'matches',
  grandMelee: 'matches',
};

/** "3s", "4m 12s", "1h 50m". Negative or missing durations read "—". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m ${String(totalSeconds % 60).padStart(2, '0')}s`;
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}h ${String(totalMinutes % 60).padStart(2, '0')}m`;
}

/** Time since `iso`, for a running job. */
export function elapsedSince(iso: string | null, now: Date): string {
  if (!iso) return '—';
  return formatDuration(now.getTime() - new Date(iso).getTime());
}

function utcTime(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today 08:00", "Yesterday 09:00", "21 Oct 18:00" (UTC). */
export function formatDayTime(iso: string, now: Date): string {
  const date = new Date(iso);
  const dayStart = (d: Date): number => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const days = Math.round((dayStart(now) - dayStart(date)) / 86_400_000);
  if (days === 0) return `Today ${utcTime(date)}`;
  if (days === 1) return `Yesterday ${utcTime(date)}`;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${utcTime(date)}`;
}

/** "HH:MM" (UTC). */
export function formatClock(iso: string): string {
  return utcTime(new Date(iso));
}

/** "in 55m", "in 1h 10m", "due now". */
export function formatCountdown(iso: string, now: Date): string {
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms <= 0) return 'due now';
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  return `in ${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

export function triggerLabel(run: Pick<SchedulerRun, 'trigger' | 'triggeredBy'>): string {
  const labels: Record<SchedulerRunTrigger, string> = { cron: 'Cron', manual: 'Manual', resume: 'Resumed', bulk: 'Bulk' };
  const base = labels[run.trigger] ?? run.trigger;
  if ((run.trigger === 'manual' || run.trigger === 'bulk') && run.triggeredBy) {
    return `${base} · ${run.triggeredBy.username ?? `#${run.triggeredBy.userId}`}`;
  }
  return base;
}

export const STATUS_LABELS: Readonly<Record<SchedulerRunStatus, string>> = {
  queued: 'Queued',
  running: 'Running',
  success: 'Success',
  failed: 'Failed',
  skipped: 'Skipped',
  interrupted: 'Interrupted',
};

/** The one-line result of a finished run, or null when there is nothing to say. */
export function runResultText(run: Pick<SchedulerRun, 'jobName' | 'status' | 'summary' | 'error'>): string | null {
  if (run.status === 'failed' || run.status === 'interrupted') return run.error;
  const summary = run.summary;
  if (!summary) return null;
  if (summary.skippedReason === 'season_preparation') return 'Skipped: the season is preparing';
  if (summary.rollover) {
    const { seasonNumber, newSeasonNumber } = summary.rollover;
    return newSeasonNumber !== null ? `Season ${seasonNumber} closed · Season ${newSeasonNumber} preparing` : `Season ${seasonNumber}`;
  }
  if (summary.bulk) {
    const { cyclesCompleted, cyclesRequested } = summary.bulk;
    return `${cyclesCompleted} of ${cyclesRequested} cycle${cyclesRequested === 1 ? '' : 's'} completed`;
  }
  if (summary.cycleNumber !== undefined) return `Cycle ${summary.cycleNumber} closed`;
  if (summary.tournamentRound !== undefined && summary.tournamentMaxRounds !== undefined) {
    const matches = summary.matchesCompleted !== undefined ? ` · ${summary.matchesCompleted.toLocaleString('en-US')} matches` : '';
    return `Round ${summary.tournamentRound}/${summary.tournamentMaxRounds}${matches}`;
  }
  if (summary.tournamentName) return `${summary.tournamentName} created`;
  if (summary.matchesCompleted !== undefined) {
    return `${summary.matchesCompleted.toLocaleString('en-US')} ${BATTLE_WORD[run.jobName] ?? 'matches'}`;
  }
  return null;
}

/** "3v3 Tournament on 21 Oct 18:00 · backend down 17:58–18:03". */
export function describeMissed(missed: MissedRun, now: Date): string {
  const base = `${jobLabel(missed.jobName)} on ${formatDayTime(missed.expectedAt, now)}`;
  return missed.downtime ? `${base} · backend down ${formatClock(missed.downtime.from)}–${formatClock(missed.downtime.to)}` : base;
}
