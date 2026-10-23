/**
 * Stored JSON shape of `scheduler_job_runs.summary` and the run vocabulary.
 *
 * Kept small on purpose: one line of result for the Cycle Controls schedule
 * and history ("669 battles", "Round 3/12 · 512 matches", "Cycle 81 closed").
 */

export const SCHEDULER_RUN_STATUSES = ['queued', 'running', 'success', 'failed', 'skipped', 'interrupted'] as const;
export type SchedulerRunStatus = (typeof SCHEDULER_RUN_STATUSES)[number];

export const SCHEDULER_RUN_TRIGGERS = ['cron', 'manual', 'resume', 'bulk'] as const;
export type SchedulerRunTrigger = (typeof SCHEDULER_RUN_TRIGGERS)[number];

/** Job name of an admin bulk-cycle run in `scheduler_job_runs`. */
export const BULK_CYCLES_JOB_NAME = 'bulkCycles';

export interface SchedulerRunSummary {
  /** Battles or matches completed by a battle job. */
  matchesCompleted?: number;
  tournamentName?: string;
  tournamentRound?: number;
  tournamentMaxRounds?: number;
  /** Settlement: the financial cycle it closed. */
  cycleNumber?: number;
  /** A battle job that returned early because the season is preparing. */
  skippedReason?: 'season_preparation';
  /** Bulk runs. */
  bulk?: {
    cyclesRequested: number;
    cyclesCompleted: number;
    totalDurationMs: number;
    averageCycleDurationMs: number;
    generateUsersPerCycle: boolean;
    includeTournaments: boolean;
    includeKoth: boolean;
    includeDailyFinances: boolean;
  };
}
