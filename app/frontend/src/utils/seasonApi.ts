/**
 * Season API client (Spec #45).
 *
 * Every displayed cycle value comes from these endpoints — nothing is computed
 * client-side from timestamps or a cycle counter, so a clock difference between
 * browser and server can never shift what a player reads.
 */

import { api } from './api';
import type {
  AdminSeasonState,
  QueuedRolloverRun,
  RolloverPreview,
  SeasonDetail,
  SeasonListEntry,
  SeasonRolloverHistory,
  SeasonState,
  SeasonSummary,
  StableSeasonDetail,
  StableSeasonSummary,
} from '@shared/types';

export const getCurrentSeason = (): Promise<SeasonState> =>
  api.get<SeasonState>('/api/seasons/current');

export const listSeasons = (): Promise<SeasonListEntry[]> =>
  api.get<SeasonListEntry[]>('/api/seasons');

export const getSeasonDetail = (seasonNumber: number): Promise<SeasonDetail> =>
  api.get<SeasonDetail>(`/api/seasons/${seasonNumber}`);

export const getStableSeasonHistory = (userId: number): Promise<StableSeasonSummary[]> =>
  api.get<StableSeasonSummary[]>(`/api/seasons/stables/${userId}`);

export const getStableSeasonDetail = (
  userId: number,
  seasonNumber: number,
): Promise<StableSeasonDetail> =>
  api.get<StableSeasonDetail>(`/api/seasons/stables/${userId}/${seasonNumber}`);

export const getSeasonSummary = (): Promise<SeasonSummary | null> =>
  api.get<SeasonSummary | null>('/api/seasons/summary');

export const markSeasonSummarySeen = (seasonNumber: number): Promise<void> =>
  api.post<void>('/api/seasons/summary-seen', { seasonNumber });

// ─── Admin season management (Spec #45) ──────────────────────────────
//
// These endpoints are admin-only. They power the Admin_Season_Portal page,
// which is the only in-app way to close Season_Zero and to nudge the current
// season's phase for testing.

/** The five stages of a rollover, in order. */
export const getAdminSeasonState = (signal?: AbortSignal): Promise<AdminSeasonState> =>
  api.get<AdminSeasonState>('/api/admin/seasons/state', { signal });

export const getRolloverPreview = (signal?: AbortSignal): Promise<RolloverPreview> =>
  api.get<RolloverPreview>('/api/admin/seasons/rollover-preview', { signal });

export const getSeasonRolloverHistory = (signal?: AbortSignal): Promise<SeasonRolloverHistory> =>
  api.get<SeasonRolloverHistory>('/api/admin/seasons/history', { signal });

/**
 * Start a rollover in the background (202): it waits for the scheduler lock
 * and reports its stages through `GET /state` while it runs. The confirmation
 * phrase and season number are server-side guards: a season number that is
 * no longer current is rejected with a 400.
 */
export const startRollover = async (seasonNumber: number): Promise<QueuedRolloverRun> =>
  (await api.post<{ run: QueuedRolloverRun }>('/api/admin/seasons/rollover', {
    confirm: 'CONFIRM_ROLLOVER',
    seasonNumber,
    background: true,
  })).run;

export const extendSeason = (additionalCycles: number): Promise<SeasonState> =>
  api.post<SeasonState>('/api/admin/seasons/extend', { additionalCycles });

export const setPreparationCycles = (remainingCycles: number): Promise<SeasonState> =>
  api.post<SeasonState>('/api/admin/seasons/preparation-cycles', { remainingCycles });
