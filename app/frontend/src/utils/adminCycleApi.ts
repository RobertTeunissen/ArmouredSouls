/**
 * Typed API of Cycle Controls (`/admin/cycles`).
 *
 * Mirrors `app/backend/src/services/cycle/schedulerHistoryService.ts`
 * (overview, history) and the routes in `routes/adminScheduler.ts` and
 * `routes/adminMaintenance.ts` (`POST /cycles/bulk`).
 */
import { api } from './api';
import type {
  SchedulerHistoryPage,
  SchedulerHistoryQuery,
  SchedulerJobName,
  SchedulerOverview,
} from '@shared/types';

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
/** Job name of an admin bulk-cycle run in the history. */
export const BULK_CYCLES_JOB_NAME = 'bulkCycles';
/** Job name of a season rollover in the history (Season Control). */
export const SEASON_ROLLOVER_JOB_NAME = 'seasonRollover';
export type SchedulerHistoryJobName = SchedulerJobName | typeof BULK_CYCLES_JOB_NAME | typeof SEASON_ROLLOVER_JOB_NAME;

export interface QueuedRun {
  id: number | null;
  jobName: string;
  status: 'queued';
  queuedAt: string;
}

export interface BulkCycleRequest {
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
export async function startBulkCycles(options: BulkCycleRequest): Promise<QueuedRun> {
  const response = await api.post<{ run: QueuedRun }>('/api/admin/cycles/bulk', { ...options, background: true });
  return response.run;
}
