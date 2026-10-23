/**
 * Typed API for the admin dashboard (`/admin/dashboard`).
 *
 * Mirrors the backend contracts in
 * `app/backend/src/services/admin/adminDashboardService.ts` (KPIs),
 * `adminDashboardStatusService.ts` (status) and
 * `adminBattleActivityService.ts` (battle activity).
 */
import { api } from './api';
import type { UserFilterType } from '../components/admin/shared';

export interface DashboardHumanPlayers {
  total: number;
  active7d: number;
  new7d: number;
  inactive3d: number;
  /** About seven days ago; active/inactive are null until a snapshot exists. */
  previous: { active7d: number | null; new7d: number; inactive3d: number | null };
}

export interface DashboardKpis {
  currentCycle: number;
  lastCycleAt: string | null;
  humanPlayers: DashboardHumanPlayers;
  robots: { total: number; battleReady: number; battleReadyPercentage: number };
  timestamp: string;
}

export interface DashboardSchedulerSummary {
  active: boolean;
  runningJob: string | null;
  queueLength: number;
  jobsTotal: number;
  jobsSucceeded: number;
  jobsFailed: string[];
  jobsNotYetReported: number;
  processStartedAt: string;
}

export interface DashboardCycleHealth {
  settlementOverdue: boolean;
  failedJobs: string[];
  stuckMatches: number;
}

export interface DashboardStatus {
  cycle: { number: number; lastSettlementAt: string | null; nextSettlementAt: string | null };
  season: { number: number; phase: string; seasonCycle: number } | null;
  scheduler: DashboardSchedulerSummary;
  queuedMatches: number | null;
  attention: {
    bankruptcyRisk: { count: number; threshold: number } | null;
    security: { activeAlerts: number; critical: number } | null;
    automatons: { needAttention: number; failed: number } | null;
    cycleHealth: DashboardCycleHealth;
  };
  timestamp: string;
}

export interface BattleActivityRow {
  mode: string;
  lastCycle: number | null;
  season: number;
  walkovers: number;
  queued: number;
  drawRate: number | null;
  killRate: number;
  avgDurationSeconds: number;
}

export interface BattleActivity {
  rows: BattleActivityRow[];
  totals: Omit<BattleActivityRow, 'mode'>;
  lastCycleWindow: { cycleNumber: number; from: string; to: string } | null;
  timestamp: string;
}

export function getDashboardKpis(filter: UserFilterType, signal?: AbortSignal): Promise<DashboardKpis> {
  return api.get<DashboardKpis>('/api/admin/dashboard/kpis', { params: { filter }, signal });
}

export function getDashboardStatus(signal?: AbortSignal): Promise<DashboardStatus> {
  return api.get<DashboardStatus>('/api/admin/dashboard/status', { signal });
}

export function getBattleActivity(filter: UserFilterType, fresh: boolean, signal?: AbortSignal): Promise<BattleActivity> {
  return api.get<BattleActivity>('/api/admin/dashboard/battle-activity', {
    params: { filter, fresh: fresh ? 'true' : 'false' },
    signal,
  });
}
