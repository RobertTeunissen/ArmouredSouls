/**
 * Typed API for the admin dashboard (`/admin/dashboard`).
 *
 * Mirrors the backend contracts in
 * `app/backend/src/services/admin/adminDashboardService.ts` (KPIs),
 * `adminDashboardStatusService.ts` (status) and
 * `adminBattleActivityService.ts` (battle activity).
 */
import { api } from './api';
import type { StableScope } from './adminStableScope';
import type { BattleActivity, DashboardKpis, DashboardStatus } from '@shared/types';

export function getDashboardKpis(filter: StableScope, signal?: AbortSignal): Promise<DashboardKpis> {
  return api.get<DashboardKpis>('/api/admin/dashboard/kpis', { params: { stables: filter }, signal });
}

export function getDashboardStatus(signal?: AbortSignal): Promise<DashboardStatus> {
  return api.get<DashboardStatus>('/api/admin/dashboard/status', { signal });
}

export function getBattleActivity(filter: StableScope, fresh: boolean, signal?: AbortSignal): Promise<BattleActivity> {
  return api.get<BattleActivity>('/api/admin/dashboard/battle-activity', {
    params: { stables: filter, fresh: fresh ? 'true' : 'false' },
    signal,
  });
}
