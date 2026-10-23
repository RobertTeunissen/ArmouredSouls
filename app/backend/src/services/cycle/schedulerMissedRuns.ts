/**
 * Missed scheduler runs: a daily slot that should have fired but has no run.
 *
 * Pure. Rules (docs/guides/ADMIN_PANEL_GUIDE.md §Cycle Controls):
 * - Only occurrences after history tracking started count (the first
 *   `scheduler_processes` row); earlier gaps are unknowable, not missed.
 * - An occurrence is expected when the latest backend start before it had the
 *   scheduler enabled. A disabled scheduler (local, paused) never misses.
 * - It is covered by a cron or resume run of that job queued between 1 minute
 *   before and `MISSED_RUN_GRACE_MS` after it. A later manual run is shown as
 *   its own row; it does not hide the miss.
 * - Occurrences younger than the grace period are not judged yet.
 * - An occurrence between one process's last heartbeat and the next start
 *   falls in downtime; the miss carries that window (usually a deploy).
 */

/** How long after its slot a cron run may be queued and still count. */
export const MISSED_RUN_GRACE_MS = 15 * 60_000;
/** Cron rows are queued at the slot; allow a little clock skew before it. */
const EARLY_TOLERANCE_MS = 60_000;
const DAY_MS = 24 * 60 * 60_000;

export interface MissedRunJob {
  jobName: string;
  /** Daily cron, `M H * * *` (the only form the scheduler uses). */
  schedule: string;
}

export interface MissedRunProcess {
  id: number;
  startedAt: Date;
  lastHeartbeatAt: Date;
  schedulerEnabled: boolean;
}

export interface MissedRunEvidence {
  jobName: string;
  trigger: string;
  queuedAt: Date;
}

export interface MissedRun {
  jobName: string;
  expectedAt: Date;
  /** The backend was down at the slot: from its last heartbeat to the next start. */
  downtime: { from: Date; to: Date } | null;
}

/** Hour and minute of a daily cron, or null for anything else. */
export function parseDailyCron(schedule: string): { hour: number; minute: number } | null {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5 || parts[2] !== '*' || parts[3] !== '*' || parts[4] !== '*') return null;
  const minute = Number(parts[0]);
  const hour = Number(parts[1]);
  if (!Number.isInteger(minute) || !Number.isInteger(hour) || minute < 0 || minute > 59 || hour < 0 || hour > 23) return null;
  return { hour, minute };
}

/** Every UTC occurrence of a daily cron in `[from, to]`, oldest first. */
export function dailyOccurrences(schedule: string, from: Date, to: Date): Date[] {
  const time = parseDailyCron(schedule);
  if (!time || to.getTime() < from.getTime()) return [];
  const first = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), time.hour, time.minute);
  const occurrences: Date[] = [];
  for (let at = first; at <= to.getTime(); at += DAY_MS) {
    if (at >= from.getTime()) occurrences.push(new Date(at));
  }
  return occurrences;
}

const COVERING_TRIGGERS: ReadonlySet<string> = new Set(['cron', 'resume']);

/** Missed runs of every job in `[from, now − grace]`, newest first. */
export function findMissedRuns(input: {
  jobs: readonly MissedRunJob[];
  processes: readonly MissedRunProcess[];
  runs: readonly MissedRunEvidence[];
  from: Date;
  now: Date;
  graceMs?: number;
}): MissedRun[] {
  const grace = input.graceMs ?? MISSED_RUN_GRACE_MS;
  const processes = [...input.processes].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  if (processes.length === 0) return [];

  const trackingStart = processes[0].startedAt.getTime();
  const from = new Date(Math.max(input.from.getTime(), trackingStart));
  const until = new Date(input.now.getTime() - grace);

  const covering = new Map<string, number[]>();
  for (const run of input.runs) {
    if (!COVERING_TRIGGERS.has(run.trigger)) continue;
    const times = covering.get(run.jobName) ?? [];
    times.push(run.queuedAt.getTime());
    covering.set(run.jobName, times);
  }

  const missed: MissedRun[] = [];
  for (const job of input.jobs) {
    const times = covering.get(job.jobName) ?? [];
    for (const occurrence of dailyOccurrences(job.schedule, from, until)) {
      const at = occurrence.getTime();
      const index = latestProcessIndexAt(processes, at);
      if (index < 0 || !processes[index].schedulerEnabled) continue;
      const covered = times.some((queuedAt) => queuedAt >= at - EARLY_TOLERANCE_MS && queuedAt <= at + grace);
      if (covered) continue;

      const process = processes[index];
      const next = processes[index + 1];
      const down = next !== undefined && at > process.lastHeartbeatAt.getTime() && at < next.startedAt.getTime();
      missed.push({
        jobName: job.jobName,
        expectedAt: occurrence,
        downtime: down ? { from: process.lastHeartbeatAt, to: next.startedAt } : null,
      });
    }
  }
  return missed.sort((a, b) => b.expectedAt.getTime() - a.expectedAt.getTime() || a.jobName.localeCompare(b.jobName));
}

/** Index of the latest process started at or before `at`, or −1. Processes sorted by start. */
function latestProcessIndexAt(processes: readonly MissedRunProcess[], at: number): number {
  let found = -1;
  for (let i = 0; i < processes.length; i += 1) {
    if (processes[i].startedAt.getTime() <= at) found = i;
    else break;
  }
  return found;
}
