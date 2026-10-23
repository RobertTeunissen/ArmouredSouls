/**
 * Typed API of the admin Meta page (`/admin/meta`).
 *
 * The page reads the choice distributions of `GET /api/admin/stats`
 * (`app/backend/src/services/admin/adminSystemStatsService.ts`). It does not
 * use the shared `adminStore.fetchStats()` slot: that commits every response,
 * so a slow response for an old filter could overwrite a newer one.
 */
import { api } from './api';
import type { UserFilterType } from '../components/admin/shared';
import type { SystemStats } from '../components/admin/types';

export function getMetaStats(filter: UserFilterType, signal?: AbortSignal): Promise<SystemStats> {
  return api.get<SystemStats>('/api/admin/stats', { params: { filter }, signal });
}
