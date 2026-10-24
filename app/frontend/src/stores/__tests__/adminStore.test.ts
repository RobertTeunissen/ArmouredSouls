/**
 * Unit tests for useAdminStore
 *
 * Tests fetchStats, clearCache, clear, TTL expiry, force refresh. The session
 * log was retired with the Cycle Controls redesign (run history is persistent
 * on the backend), so its CRUD tests went with it.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAdminStore } from '../adminStore';

// ----------------------------------------------------------------
// Mock apiClient
// ----------------------------------------------------------------
vi.mock('../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

import apiClient from '../../utils/apiClient';

const mockedApiGet = vi.mocked(apiClient.get);

// ----------------------------------------------------------------
// In-memory localStorage implementation
// ----------------------------------------------------------------
let storage: Record<string, string> = {};

function setupLocalStorageMock(): void {
  storage = {};
  (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(
    (key: string) => storage[key] ?? null,
  );
  (localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(
    (key: string, value: string) => {
      storage[key] = String(value);
    },
  );
  (localStorage.removeItem as ReturnType<typeof vi.fn>).mockImplementation(
    (key: string) => {
      delete storage[key];
    },
  );
  (localStorage.clear as ReturnType<typeof vi.fn>).mockImplementation(() => {
    storage = {};
  });
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/** Minimal valid SystemStats object for mocking API responses */
function makeSystemStats(seed: number) {
  return {
    robots: { total: seed, byTier: [], battleReady: 0, battleReadyPercentage: 0 },
    matches: { scheduled: 0, completed: 0 },
    battles: { last24Hours: 0, total: 0, draws: 0, drawPercentage: 0, avgDuration: 0, kills: 0, killPercentage: 0 },
    finances: { totalCredits: seed * 100, avgBalance: 0, usersAtRisk: 0, totalUsers: seed },
    facilities: { summary: [], totalPurchases: 0, mostPopular: '' },
    weapons: { totalBought: 0, equipped: 0 },
    stances: [],
    loadouts: [],
    yieldThresholds: { distribution: [], mostCommon: 0, mostCommonCount: 0 },
  };
}

/** Reset the store to a clean initial state */
function resetStore(): void {
  useAdminStore.setState({
    systemStats: null,
    statsLastFetched: null,
    statsLastFilter: null,
    statsLoading: false,
    securitySummary: null,
    securityLastFetched: null,
    ttlMs: 60_000,
  });
}

// ----------------------------------------------------------------
// Setup / Teardown
// ----------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  setupLocalStorageMock();
  resetStore();
});

afterEach(() => {
  vi.useRealTimers();
});

// ----------------------------------------------------------------
// fetchStats
// ----------------------------------------------------------------

describe('fetchStats', () => {
  it('should call API, store result, and set statsLastFetched', async () => {
    const stats = makeSystemStats(10);
    mockedApiGet.mockResolvedValue({ data: stats });

    await useAdminStore.getState().fetchStats();

    const state = useAdminStore.getState();
    expect(mockedApiGet).toHaveBeenCalledWith('/api/admin/stats', {
      params: { filter: 'real' },
    });
    expect(state.systemStats).toEqual(stats);
    expect(state.statsLastFetched).toBeTypeOf('number');
    expect(state.statsLoading).toBe(false);
  });

  it('should set statsLoading to true during fetch', async () => {
    let resolveApi: (value: unknown) => void;
    mockedApiGet.mockImplementation(
      () => new Promise((resolve) => { resolveApi = resolve; }),
    );

    const fetchPromise = useAdminStore.getState().fetchStats();
    expect(useAdminStore.getState().statsLoading).toBe(true);

    resolveApi!({ data: makeSystemStats(1) });
    await fetchPromise;
    expect(useAdminStore.getState().statsLoading).toBe(false);
  });

  it('should return cached data when within TTL', async () => {
    const stats = makeSystemStats(5);
    mockedApiGet.mockResolvedValue({ data: stats });

    // First fetch populates cache
    await useAdminStore.getState().fetchStats();
    expect(mockedApiGet).toHaveBeenCalledTimes(1);

    mockedApiGet.mockClear();

    // Second fetch within TTL should not call API
    await useAdminStore.getState().fetchStats();
    expect(mockedApiGet).not.toHaveBeenCalled();
    expect(useAdminStore.getState().systemStats).toEqual(stats);
  });

  it('should bypass TTL cache when force=true', async () => {
    const stats = makeSystemStats(5);
    const freshStats = makeSystemStats(99);
    mockedApiGet.mockResolvedValue({ data: stats });

    // First fetch populates cache
    await useAdminStore.getState().fetchStats();
    mockedApiGet.mockClear();
    mockedApiGet.mockResolvedValue({ data: freshStats });

    // Force fetch should call API even though cache is valid
    await useAdminStore.getState().fetchStats(undefined, true);
    expect(mockedApiGet).toHaveBeenCalledTimes(1);
    expect(useAdminStore.getState().systemStats).toEqual(freshStats);
  });

  it('should set statsLoading to false and throw on API error', async () => {
    // The api wrapper normalizes thrown errors into ApiError. A bare
    // `new Error('Network failure')` (not an Axios error) becomes an
    // ApiError with code UNKNOWN_ERROR and empty message — callers
    // supply their own fallback copy.
    mockedApiGet.mockRejectedValue(new Error('Network failure'));

    await expect(useAdminStore.getState().fetchStats()).rejects.toMatchObject({
      code: 'UNKNOWN_ERROR',
    });
    expect(useAdminStore.getState().statsLoading).toBe(false);
    expect(useAdminStore.getState().systemStats).toBeNull();
  });

  it('should fetch fresh data after TTL expires', async () => {
    const stats = makeSystemStats(1);
    const freshStats = makeSystemStats(2);
    mockedApiGet.mockResolvedValue({ data: stats });

    // First fetch
    await useAdminStore.getState().fetchStats();
    mockedApiGet.mockClear();

    // Simulate TTL expiry by setting statsLastFetched to past
    useAdminStore.setState({ statsLastFetched: Date.now() - 61_000 });

    mockedApiGet.mockResolvedValue({ data: freshStats });

    // Should make a new API call since TTL expired
    await useAdminStore.getState().fetchStats();
    expect(mockedApiGet).toHaveBeenCalledTimes(1);
    expect(useAdminStore.getState().systemStats).toEqual(freshStats);
  });
});

// ----------------------------------------------------------------
// clearCache
// ----------------------------------------------------------------

describe('clearCache', () => {
  it('should reset all cached data and timestamps', async () => {
    const stats = makeSystemStats(10);
    mockedApiGet.mockResolvedValue({ data: stats });

    // Populate cache
    await useAdminStore.getState().fetchStats();
    expect(useAdminStore.getState().systemStats).not.toBeNull();

    // Also set security data
    useAdminStore.setState({
      securitySummary: { totalEvents: 5, bySeverity: { info: 3, warning: 1, critical: 1 }, activeAlerts: 1, flaggedUserIds: [] },
      securityLastFetched: Date.now(),
    });

    useAdminStore.getState().clearCache();

    const state = useAdminStore.getState();
    expect(state.systemStats).toBeNull();
    expect(state.statsLastFetched).toBeNull();
    expect(state.statsLastFilter).toBeNull();
    expect(state.statsLoading).toBe(false);
    expect(state.securitySummary).toBeNull();
    expect(state.securityLastFetched).toBeNull();
  });
});

// ----------------------------------------------------------------
// clear
// ----------------------------------------------------------------

describe('clear', () => {
  it('should reset everything', async () => {
    const stats = makeSystemStats(10);
    mockedApiGet.mockResolvedValue({ data: stats });

    await useAdminStore.getState().fetchStats();
    useAdminStore.setState({
      securitySummary: { totalEvents: 1, bySeverity: { info: 1, warning: 0, critical: 0 }, activeAlerts: 0, flaggedUserIds: [] },
      securityLastFetched: Date.now(),
    });

    useAdminStore.getState().clear();

    const state = useAdminStore.getState();
    expect(state.systemStats).toBeNull();
    expect(state.statsLastFetched).toBeNull();
    expect(state.statsLastFilter).toBeNull();
    expect(state.statsLoading).toBe(false);
    expect(state.securitySummary).toBeNull();
    expect(state.securityLastFetched).toBeNull();
  });

  it('should remove the retired session log from localStorage', () => {
    storage['admin_session_log'] = '[]';

    useAdminStore.getState().clear();

    expect(storage['admin_session_log']).toBeUndefined();
  });
});

// ----------------------------------------------------------------
// TTL expiry — fetchStats makes new API call after TTL
// ----------------------------------------------------------------

describe('TTL expiry', () => {
  it('should make a new API call after TTL expires', async () => {
    const stats = makeSystemStats(1);
    const freshStats = makeSystemStats(2);

    // Use a short TTL for this test
    useAdminStore.setState({ ttlMs: 100 });
    mockedApiGet.mockResolvedValue({ data: stats });

    // First fetch
    await useAdminStore.getState().fetchStats();
    expect(mockedApiGet).toHaveBeenCalledTimes(1);
    expect(useAdminStore.getState().systemStats).toEqual(stats);

    mockedApiGet.mockClear();

    // Simulate time passing beyond TTL
    useAdminStore.setState({ statsLastFetched: Date.now() - 200 });
    mockedApiGet.mockResolvedValue({ data: freshStats });

    // Should fetch fresh data
    await useAdminStore.getState().fetchStats();
    expect(mockedApiGet).toHaveBeenCalledTimes(1);
    expect(useAdminStore.getState().systemStats).toEqual(freshStats);
  });

  it('should not make API call when within TTL', async () => {
    const stats = makeSystemStats(1);

    useAdminStore.setState({ ttlMs: 60_000 });
    mockedApiGet.mockResolvedValue({ data: stats });

    // First fetch
    await useAdminStore.getState().fetchStats();
    mockedApiGet.mockClear();

    // statsLastFetched is just set — well within 60s TTL
    await useAdminStore.getState().fetchStats();
    expect(mockedApiGet).not.toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------
// statsLastFetched tracking (Requirement 4.5)
// ----------------------------------------------------------------

describe('lastFetched timestamps', () => {
  it('should track statsLastFetched after fetchStats', async () => {
    mockedApiGet.mockResolvedValue({ data: makeSystemStats(1) });

    expect(useAdminStore.getState().statsLastFetched).toBeNull();

    const before = Date.now();
    await useAdminStore.getState().fetchStats();
    const after = Date.now();

    const lastFetched = useAdminStore.getState().statsLastFetched;
    expect(lastFetched).not.toBeNull();
    expect(lastFetched).toBeGreaterThanOrEqual(before);
    expect(lastFetched).toBeLessThanOrEqual(after);
  });
});
