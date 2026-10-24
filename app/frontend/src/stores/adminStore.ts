/**
 * useAdminStore — Zustand store for shared admin portal state.
 *
 * Caches system stats and the security summary with TTL-based invalidation.
 * Cycle Controls keeps its own data (persistent run history from the
 * backend), so the scheduler status and the browser-only session log that
 * used to live here are gone.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7
 */
import { create } from 'zustand';
import { api } from '../utils/api';
import type { SystemStats, SecuritySummary } from '../components/admin/types';

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface AdminStoreState {
  // System stats with TTL caching
  systemStats: SystemStats | null;
  statsLastFetched: number | null;
  statsLastFilter: string | null;
  statsLoading: boolean;

  // Security summary with TTL caching
  securitySummary: SecuritySummary | null;
  securityLastFetched: number | null;

  // TTL configuration (default 60 seconds)
  ttlMs: number;

  // Actions
  fetchStats: (filter?: string, force?: boolean) => Promise<void>;
  fetchSecuritySummary: (force?: boolean) => Promise<void>;
  clearCache: () => void;
  clear: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  securitySummary: null as SecuritySummary | null,
  securityLastFetched: null as number | null,
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
      const stats = await api.get<SystemStats>('/api/admin/stats', {
        params: { filter: requestedFilter },
      });
      set({
        systemStats: stats,
        statsLastFetched: Date.now(),
        statsLastFilter: requestedFilter,
        statsLoading: false,
      });
    } catch (err) {
      set({ statsLoading: false });
      throw err;
    }
  },

  fetchSecuritySummary: async (force = false) => {
    const state = get();
    if (!force && isCacheValid(state.securityLastFetched, state.ttlMs)) {
      return;
    }

    try {
      const summary = await api.get<SecuritySummary>('/api/admin/security/summary');
      set({
        securitySummary: summary,
        securityLastFetched: Date.now(),
      });
    } catch {
      // Let error propagate naturally
    }
  },

  clearCache: () => {
    set({
      systemStats: null,
      statsLastFetched: null,
      statsLastFilter: null,
      statsLoading: false,
      securitySummary: null,
      securityLastFetched: null,
    });
  },

  clear: () => {
    set({ ...initialState });
    try {
      // The retired session log may still sit in this browser.
      localStorage.removeItem('admin_session_log');
    } catch {
      // silently ignore
    }
  },
}));
