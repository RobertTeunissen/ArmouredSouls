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

/** Job name of a season rollover in `scheduler_job_runs` (admin or settlement-triggered). */
export const SEASON_ROLLOVER_JOB_NAME = 'seasonRollover';

/** The five stages of a rollover, in order (Spec #45). */
export const ROLLOVER_STAGES = ['archive', 'verify', 'purge', 'post', 'automaton'] as const;
export type RolloverStageName = (typeof ROLLOVER_STAGES)[number];

export type RolloverStageStatus = 'pending' | 'running' | 'done' | 'skipped' | 'failed';

export interface RolloverStageProgress {
  stage: RolloverStageName;
  status: RolloverStageStatus;
  startedAt: string | null;
  finishedAt: string | null;
  /** One line: "Generated stables 1,250 of 3,483", "Already archived (retry)". */
  detail: string | null;
}

/** Stage progress and, once finished, the result of a rollover run. */
export interface RolloverRunSummary {
  /** The season being closed. */
  seasonNumber: number;
  /** Set once the next season is open. */
  newSeasonNumber: number | null;
  stages: RolloverStageProgress[];
  /** Generated stables deleted so far during the purge stage. */
  generatedStables: { deleted: number; total: number } | null;
  result: {
    stablesArchived: number;
    robotsArchived: number;
    snapshotRows: number;
    accoladeRows: number;
    generatedStablesDeleted: number;
    totalRowsPurged: number;
    durations: { archiveMs: number; purgeMs: number; postMs: number; totalMs: number };
  } | null;
}

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
  /** Season rollovers. */
  rollover?: RolloverRunSummary;
}
