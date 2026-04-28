/**
 * useAdminStore — Zustand store for shared admin portal state.
 *
 * Caches system stats, scheduler status, and security summary with
 * TTL-based invalidation. Manages the session log in memory with
 * localStorage persistence as a fallback.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */
import { create } from 'zustand';
import apiClient from '../utils/apiClient';
import type { SystemStats, SessionLogEntry, SecuritySummary } from '../components/admin/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SchedulerJobState {
  name: string;
  schedule: string;
  lastRunAt: string | null;
  lastRunDurationMs: number | null;
  lastRunStatus: 'success' | 'failed' | null;
  lastError: string | null;
  nextRunAt: string | null;
}

export interface SchedulerState {
  active: boolean;
  runningJob: string | null;
  queue: string[];
  jobs: SchedulerJobState[];
}

const SESSION_LOG_KEY = 'admin_session_log';
const MAX_SESSION_LOG_ENTRIES = 100;

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface AdminStoreState {
  // System stats with TTL caching
  systemStats: SystemStats | null;
  statsLastFetched: number | null;
  statsLastFilter: string | null;
  statsLoading: boolean;

  // Scheduler status with TTL caching
  schedulerStatus: SchedulerState | null;
  schedulerLastFetched: number | null;

  // Security summary with TTL caching
  securitySummary: SecuritySummary | null;
  securityLastFetched: number | null;

  // Session log (in-memory + localStorage fallback)
  sessionLog: SessionLogEntry[];

  // TTL configuration (default 60 seconds)
  ttlMs: number;

  // Actions
  fetchStats: (filter?: string, force?: boolean) => Promise<void>;
  fetchSchedulerStatus: (force?: boolean) => Promise<void>;
  fetchSecuritySummary: (force?: boolean) => Promise<void>;
  addSessionLog: (type: SessionLogEntry['type'], message: string, details?: unknown) => void;
  clearSessionLog: () => void;
  exportSessionLog: () => void;
  clearCache: () => void;
  clear: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadSessionLogFromStorage(): SessionLogEntry[] {
  try {
    const saved = localStorage.getItem(SESSION_LOG_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry: unknown) =>
        entry &&
        typeof (entry as SessionLogEntry).timestamp === 'string' &&
        typeof (entry as SessionLogEntry).type === 'string' &&
        typeof (entry as SessionLogEntry).message === 'string',
    );
  } catch {
    return [];
  }
}

function persistSessionLog(log: SessionLogEntry[]): void {
  try {
    localStorage.setItem(SESSION_LOG_KEY, JSON.stringify(log));
  } catch {
    // localStorage may be full or unavailable — silently ignore
  }
}

function isCacheValid(lastFetched: number | null, ttlMs: number): boolean {
  if (lastFetched === null) return false;
  return Date.now() - lastFetched < ttlMs;
}

// ---------------------------------------------------------------------------
// Initial state (extracted for clear/reset)
// ---------------------------------------------------------------------------

const initialState = {
  systemStats: null as SystemStats | null,
  statsLastFetched: null as number | null,
  statsLastFilter: null as string | null,
  statsLoading: false,
  schedulerStatus: null as SchedulerState | null,
  schedulerLastFetched: null as number | null,
  securitySummary: null as SecuritySummary | null,
  securityLastFetched: null as number | null,
  sessionLog: loadSessionLogFromStorage(),
  ttlMs: 60_000,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAdminStore = create<AdminStoreState>((set, get) => ({
  ...initialState,

  fetchStats: async (filter?: string, force = false) => {
    const state = get();
    const requestedFilter = filter || 'real';
    const filterChanged = state.statsLastFilter !== requestedFilter;
    if (!force && !filterChanged && isCacheValid(state.statsLastFetched, state.ttlMs)) {
      return;
    }

    set({ statsLoading: true });
    try {
      const response = await apiClient.get<SystemStats>(`/api/admin/stats?filter=${requestedFilter}`);
      set({
        systemStats: response.data,
        statsLastFetched: Date.now(),
        statsLastFilter: requestedFilter,
        statsLoading: false,
      });
    } catch (err) {
      set({ statsLoading: false });
      throw err;
    }
  },

  fetchSchedulerStatus: async (force = false) => {
    const state = get();
    if (!force && isCacheValid(state.schedulerLastFetched, state.ttlMs)) {
      return;
    }

    try {
      const response = await apiClient.get<SchedulerState>('/api/admin/scheduler/status');
      set({
        schedulerStatus: response.data,
        schedulerLastFetched: Date.now(),
      });
    } catch {
      // Let error propagate naturally
    }
  },

  fetchSecuritySummary: async (force = false) => {
    const state = get();
    if (!force && isCacheValid(state.securityLastFetched, state.ttlMs)) {
      return;
    }

    try {
      const response = await apiClient.get<SecuritySummary>('/api/admin/security/summary');
      set({
        securitySummary: response.data,
        securityLastFetched: Date.now(),
      });
    } catch {
      // Let error propagate naturally
    }
  },

  addSessionLog: (type, message, details) => {
    const entry: SessionLogEntry = {
      timestamp: new Date().toISOString(),
      type,
      message,
      details,
    };
    set((state) => {
      const newLog = [entry, ...state.sessionLog].slice(0, MAX_SESSION_LOG_ENTRIES);
      persistSessionLog(newLog);
      return { sessionLog: newLog };
    });
  },

  clearSessionLog: () => {
    set({ sessionLog: [] });
    try {
      localStorage.removeItem(SESSION_LOG_KEY);
    } catch {
      // silently ignore
    }
  },

  exportSessionLog: () => {
    const { sessionLog } = get();
    const dataStr = JSON.stringify(sessionLog, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-session-log-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  },

  clearCache: () => {
    set({
      systemStats: null,
      statsLastFetched: null,
      statsLastFilter: null,
      statsLoading: false,
      schedulerStatus: null,
      schedulerLastFetched: null,
      securitySummary: null,
      securityLastFetched: null,
    });
  },

  clear: () => {
    set({
      ...initialState,
      sessionLog: [], // Don't reload from localStorage on full reset
    });
    try {
      localStorage.removeItem(SESSION_LOG_KEY);
    } catch {
      // silently ignore
    }
  },
}));
