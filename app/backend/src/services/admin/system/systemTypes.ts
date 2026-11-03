/** Response of `GET /api/admin/system/overview` (the admin System page). */
import type { BackupStatus } from '../../monitoring/backupStatus';

export interface SystemDisk {
  usagePercent: number;
  /** Derived from the usage percent and free space; null when unknown. */
  usedMB: number | null;
  totalMB: number | null;
  availableMB: number;
  /** The disk monitor's thresholds: warning from 80%, critical from 90%. */
  status: 'ok' | 'warning' | 'critical';
}

export interface SystemMemory {
  totalMB: number;
  /** Memory the kernel can hand out without swapping (`MemAvailable`), not just free pages. */
  availableMB: number;
  swapTotalMB: number | null;
  swapUsedMB: number | null;
}

export interface SystemTable {
  name: string;
  sizeBytes: number;
  rows: number;
}

export interface SystemBackup {
  status: BackupStatus;
  file: string | null;
  at: string | null;
  sizeBytes: number | null;
  note: string | null;
}

export interface SystemStart {
  at: string;
  /** `deploy`: the first start with a new deploy tag; `restart`: any other start. */
  kind: 'deploy' | 'restart';
  deployTag: string | null;
}

export interface SystemRequestError {
  method: string;
  route: string;
  /** Admin page or API area the route belongs to. */
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
  /** Median of the successful runs. */
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
  backup: SystemBackup;
  backend: { startedAt: string; uptimeSeconds: number; deployTag: string | null; nodeVersion: string };
  starts: SystemStart[];
  requests: {
    windowDays: number;
    /** UTC day keys, oldest first. */
    days: string[];
    /** Server errors in the last 24 hours. */
    failures24h: number;
    errors: SystemRequestError[];
    slow: SystemSlowRequest[];
    /** Oldest recorded hour, or null when nothing was ever recorded. */
    recordingSince: string | null;
  };
  jobs: {
    windowDays: number;
    rows: SystemJob[];
    /** Time the scheduler lock was held per UTC day, oldest first. */
    lockPerDay: Array<{ day: string; ms: number }>;
  };
}
