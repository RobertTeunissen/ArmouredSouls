/**
 * Typed API of Cycle Controls (`/admin/cycles`).
 *
 * Mirrors `app/backend/src/services/cycle/schedulerHistoryService.ts`
 * (overview, history) and the routes in `routes/adminScheduler.ts` and
 * `routes/adminMaintenance.ts` (`POST /cycles/bulk`).
 */
import { api } from './api';

/** The ten scheduler jobs, in the backend's tuple order. */
export const SCHEDULER_JOB_NAMES = [
  'league',
  'tournament',
  'tagTeam',
  'settlement',
  'koth',
  'team2v2League',
  'team3v3League',
  'team2v2Tournament',
  'team3v3Tournament',
  'grandMelee',
] as const;
export type SchedulerJobName = (typeof SCHEDULER_JOB_NAMES)[number];

/** Job name of an admin bulk-cycle run in the history. */
export const BULK_CYCLES_JOB_NAME = 'bulkCycles';
export type SchedulerHistoryJobName = SchedulerJobName | typeof BULK_CYCLES_JOB_NAME;

export type SchedulerRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'skipped' | 'interrupted';
export type SchedulerRunTrigger = 'cron' | 'manual' | 'resume' | 'bulk';

export interface SchedulerRunSummary {
  matchesCompleted?: number;
  tournamentName?: string;
  tournamentRound?: number;
  tournamentMaxRounds?: number;
  cycleNumber?: number;
  skippedReason?: 'season_preparation';
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

export interface SchedulerRun {
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

export interface MissedRun {
  jobName: string;
  expectedAt: string;
  downtime: { from: string; to: string } | null;
}

export interface SchedulerSlot {
  jobName: SchedulerJobName;
  schedule: string;
  time: string | null;
  nextRunAt: string | null;
  lastRun: SchedulerRun | null;
  activeRun: SchedulerRun | null;
}

export interface SchedulerOverview {
  scheduler: {
    active: boolean;
    process: { id: number; startedAt: string; deployTag: string | null } | null;
  };
  season: { number: number; phase: string; seasonCycle: number } | null;
  cycle: { number: number };
  running: SchedulerRun | null;
  queue: SchedulerRun[];
  next: { jobName: SchedulerJobName; at: string } | null;
  slots: SchedulerSlot[];
  missed: { windowDays: number; runs: MissedRun[] };
  timestamp: string;
}

export type SchedulerHistoryEntry =
  | { kind: 'run'; at: string; run: SchedulerRun }
  | { kind: 'restart'; at: string; restart: { processId: number; deployTag: string | null; schedulerEnabled: boolean; downSince: string | null } }
  | { kind: 'missed'; at: string; missed: MissedRun };

export interface SchedulerHistoryPage {
  entries: SchedulerHistoryEntry[];
  page: number;
  limit: number;
  total: number;
  windowDays: number;
}

export interface SchedulerHistoryQuery {
  jobName?: SchedulerHistoryJobName;
  problemsOnly?: boolean;
  days?: number;
  page?: number;
  limit?: number;
}

export interface QueuedRun {
  id: number | null;
  jobName: string;
  status: 'queued';
  queuedAt: string;
}

export interface BulkCycleOptions {
  cycles: number;
  generateUsersPerCycle: boolean;
  includeTournaments: boolean;
  includeKoth: boolean;
  includeDailyFinances: boolean;
}

export function getSchedulerOverview(signal?: AbortSignal): Promise<SchedulerOverview> {
  return api.get<SchedulerOverview>('/api/admin/scheduler/overview', { signal });
}

export function buildSchedulerHistoryParams(query: SchedulerHistoryQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (query.jobName) params.jobName = query.jobName;
  if (query.problemsOnly) params.problemsOnly = 'true';
  if (query.days !== undefined) params.days = query.days;
  if (query.page !== undefined) params.page = query.page;
  if (query.limit !== undefined) params.limit = query.limit;
  return params;
}

export function getSchedulerHistory(query: SchedulerHistoryQuery, signal?: AbortSignal): Promise<SchedulerHistoryPage> {
  return api.get<SchedulerHistoryPage>('/api/admin/scheduler/runs', { params: buildSchedulerHistoryParams(query), signal });
}

/** Start a job in the background (202). */
export async function startSchedulerRun(jobName: SchedulerJobName): Promise<QueuedRun> {
  const response = await api.post<{ run: QueuedRun }>('/api/admin/scheduler/runs', { jobName });
  return response.run;
}

/** Start bulk cycles in the background (202). */
export async function startBulkCycles(options: BulkCycleOptions): Promise<QueuedRun> {
  const response = await api.post<{ run: QueuedRun }>('/api/admin/cycles/bulk', { ...options, background: true });
  return response.run;
}
