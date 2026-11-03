/**
 * Admin System API (`/admin/system`): server health and what is failing.
 * Mirrors `SystemOverview` in `app/backend/src/services/admin/system/systemTypes.ts`.
 */
import { api } from './api';

export type BackupStatus = 'ok' | 'stale' | 'missing' | 'not_applicable';

export interface SystemDisk {
  usagePercent: number;
  usedMB: number | null;
  totalMB: number | null;
  availableMB: number;
  /** Warning from 80%, critical from 90% (the disk monitor's thresholds). */
  status: 'ok' | 'warning' | 'critical';
}

export interface SystemMemory {
  totalMB: number;
  /** Memory the kernel can hand out without swapping. */
  availableMB: number;
  swapTotalMB: number | null;
  swapUsedMB: number | null;
}

export interface SystemTable {
  name: string;
  sizeBytes: number;
  rows: number;
}

export interface SystemStart {
  at: string;
  kind: 'deploy' | 'restart';
  deployTag: string | null;
}

export interface SystemRequestError {
  method: string;
  route: string;
  page: string;
  code: string;
  count: number;
  lastAt: string;
  /** Errors per UTC day, oldest first (same days as `requests.days`). */
  perDay: number[];
}

export interface SystemSlowRequest {
  method: string;
  route: string;
  page: string;
  count: number;
  avgMs: number;
  maxMs: number;
  lastAt: string;
}

export interface SystemJobRun {
  startedAt: string;
  durationMs: number;
  status: string;
}

export interface SystemJob {
  jobName: string;
  /** Finished runs in the window, oldest first. */
  runs: SystemJobRun[];
  last: SystemJobRun | null;
  medianMs: number | null;
  slowest: SystemJobRun | null;
  interrupted: number;
  failed: number;
}

export interface SystemOverview {
  generatedAt: string;
  disk: SystemDisk | null;
  memory: SystemMemory;
  database: { sizeBytes: number; tables: SystemTable[] } | null;
  backup: { status: BackupStatus; file: string | null; at: string | null; sizeBytes: number | null; note: string | null };
  backend: { startedAt: string; uptimeSeconds: number; deployTag: string | null; nodeVersion: string };
  starts: SystemStart[];
  requests: {
    windowDays: number;
    days: string[];
    failures24h: number;
    errors: SystemRequestError[];
    slow: SystemSlowRequest[];
    recordingSince: string | null;
  };
  jobs: {
    windowDays: number;
    rows: SystemJob[];
    lockPerDay: Array<{ day: string; ms: number }>;
  };
}

export function getSystemOverview(signal?: AbortSignal): Promise<SystemOverview> {
  return api.get<SystemOverview>('/api/admin/system/overview', { signal });
}
