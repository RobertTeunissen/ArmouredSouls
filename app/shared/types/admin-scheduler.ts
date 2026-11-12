/**
 * Wire contracts for the admin Cycle Controls page (`/api/admin/scheduler/*`;
 * backend `services/cycle/schedulerHistoryService.ts`). `SchedulerRunSummary`
 * is also the stored JSON of `scheduler_job_runs.summary` (backend
 * `types/schedulerTypes.ts`); Season Control reads rollover runs from it.
 */

export type SchedulerRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'skipped' | 'interrupted';

export type SchedulerRunTrigger = 'cron' | 'manual' | 'resume' | 'bulk';

export type RolloverStageName = 'archive' | 'verify' | 'purge' | 'post' | 'automaton';

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
    /** Human stables without a login all season, deleted. Absent on older rows. */
    dormantStablesDeleted?: number;
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
    /** Cycles that ran through (a cycle that threw is not completed). */
    cyclesCompleted: number;
    /** Cycles that threw; their errors are in the run's `error`. Absent on older rows. */
    cyclesFailed?: number;
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

export type SchedulerJobName = 'league' | 'tournament' | 'tagTeam' | 'settlement' | 'koth' | 'team2v2League' | 'team3v3League' | 'team2v2Tournament' | 'team3v3Tournament' | 'grandMelee';

export interface SchedulerRunView {
  id: number;
  jobName: string;
  trigger: SchedulerRunTrigger;
  triggeredBy: { userId: number; username: string | null } | null;
  status: SchedulerRunStatus;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  summary: SchedulerRunSummary | null;
  error: string | null;
}

export interface MissedRunView {
  jobName: string;
  expectedAt: string;
  downtime: { from: string; to: string } | null;
}

export interface SchedulerSlotView {
  jobName: SchedulerJobName;
  schedule: string;
  /** "HH:MM" in UTC, or null for a non-daily schedule. */
  time: string | null;
  nextRunAt: string | null;
  lastRun: SchedulerRunView | null;
  /** A queued or running run of this job in this process. */
  activeRun: SchedulerRunView | null;
}

export interface SchedulerOverview {
  scheduler: {
    active: boolean;
    process: { id: number; startedAt: string; deployTag: string | null } | null;
  };
  season: { number: number; phase: string; seasonCycle: number } | null;
  cycle: { number: number };
  running: SchedulerRunView | null;
  queue: SchedulerRunView[];
  next: { jobName: SchedulerJobName; at: string } | null;
  slots: SchedulerSlotView[];
  missed: { windowDays: number; runs: MissedRunView[] };
  timestamp: string;
}

export type SchedulerHistoryEntry =
  | { kind: 'run'; at: string; run: SchedulerRunView }
  | { kind: 'restart'; at: string; restart: { processId: number; deployTag: string | null; schedulerEnabled: boolean; downSince: string | null } }
  | { kind: 'missed'; at: string; missed: MissedRunView };

export interface SchedulerHistoryPage {
  entries: SchedulerHistoryEntry[];
  page: number;
  limit: number;
  total: number;
  windowDays: number;
}

export interface SchedulerHistoryQuery {
  jobName?: string;
  problemsOnly?: boolean;
  days?: number;
  page?: number;
  limit?: number;
}
