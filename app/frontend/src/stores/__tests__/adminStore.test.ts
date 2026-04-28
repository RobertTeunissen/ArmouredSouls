/**
 * Unit tests for useAdminStore
 *
 * Tests fetchStats, clearCache, clear, sessionLog CRUD, TTL expiry, force refresh.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
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
    schedulerStatus: null,
    schedulerLastFetched: null,
    securitySummary: null,
    securityLastFetched: null,
    sessionLog: [],
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
    expect(mockedApiGet).toHaveBeenCalledWith('/api/admin/stats?filter=real');
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
    const error = new Error('Network failure');
    mockedApiGet.mockRejectedValue(error);

    await expect(useAdminStore.getState().fetchStats()).rejects.toThrow('Network failure');
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

    // Also set scheduler and security data
    useAdminStore.setState({
      schedulerStatus: { active: true, runningJob: null, queue: [], jobs: [] },
      schedulerLastFetched: Date.now(),
      securitySummary: { totalEvents: 5, bySeverity: { info: 3, warning: 1, critical: 1 }, activeAlerts: 1, flaggedUserIds: [] },
      securityLastFetched: Date.now(),
    });

    useAdminStore.getState().clearCache();

    const state = useAdminStore.getState();
    expect(state.systemStats).toBeNull();
    expect(state.statsLastFetched).toBeNull();
    expect(state.statsLastFilter).toBeNull();
    expect(state.statsLoading).toBe(false);
    expect(state.schedulerStatus).toBeNull();
    expect(state.schedulerLastFetched).toBeNull();
    expect(state.securitySummary).toBeNull();
    expect(state.securityLastFetched).toBeNull();
  });

  it('should not affect session log', () => {
    useAdminStore.getState().addSessionLog('info', 'test entry');
    expect(useAdminStore.getState().sessionLog).toHaveLength(1);

    useAdminStore.getState().clearCache();

    expect(useAdminStore.getState().sessionLog).toHaveLength(1);
  });
});

// ----------------------------------------------------------------
// clear
// ----------------------------------------------------------------

describe('clear', () => {
  it('should reset everything including session log', async () => {
    const stats = makeSystemStats(10);
    mockedApiGet.mockResolvedValue({ data: stats });

    // Populate cache and session log
    await useAdminStore.getState().fetchStats();
    useAdminStore.getState().addSessionLog('info', 'test entry');
    useAdminStore.setState({
      schedulerStatus: { active: true, runningJob: null, queue: [], jobs: [] },
      schedulerLastFetched: Date.now(),
    });

    useAdminStore.getState().clear();

    const state = useAdminStore.getState();
    expect(state.systemStats).toBeNull();
    expect(state.statsLastFetched).toBeNull();
    expect(state.statsLastFilter).toBeNull();
    expect(state.statsLoading).toBe(false);
    expect(state.schedulerStatus).toBeNull();
    expect(state.schedulerLastFetched).toBeNull();
    expect(state.securitySummary).toBeNull();
    expect(state.securityLastFetched).toBeNull();
    expect(state.sessionLog).toEqual([]);
  });

  it('should remove session log from localStorage', () => {
    useAdminStore.getState().addSessionLog('info', 'test entry');
    expect(storage['admin_session_log']).toBeDefined();

    useAdminStore.getState().clear();

    expect(storage['admin_session_log']).toBeUndefined();
  });
});

// ----------------------------------------------------------------
// addSessionLog
// ----------------------------------------------------------------

describe('addSessionLog', () => {
  it('should add entry to sessionLog array', () => {
    useAdminStore.getState().addSessionLog('success', 'Operation completed');

    const log = useAdminStore.getState().sessionLog;
    expect(log).toHaveLength(1);
    expect(log[0].type).toBe('success');
    expect(log[0].message).toBe('Operation completed');
    expect(log[0].timestamp).toBeTypeOf('string');
  });

  it('should prepend new entries (newest first)', () => {
    useAdminStore.getState().addSessionLog('info', 'First');
    useAdminStore.getState().addSessionLog('warning', 'Second');

    const log = useAdminStore.getState().sessionLog;
    expect(log).toHaveLength(2);
    expect(log[0].message).toBe('Second');
    expect(log[1].message).toBe('First');
  });

  it('should include optional details', () => {
    useAdminStore.getState().addSessionLog('error', 'Failed', { code: 500, reason: 'timeout' });

    const entry = useAdminStore.getState().sessionLog[0];
    expect(entry.details).toEqual({ code: 500, reason: 'timeout' });
  });

  it('should persist to localStorage', () => {
    useAdminStore.getState().addSessionLog('info', 'Persisted entry');

    const stored = localStorage.getItem('admin_session_log');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].message).toBe('Persisted entry');
  });

  it('should cap at MAX_SESSION_LOG_ENTRIES (100)', () => {
    for (let i = 0; i < 105; i++) {
      useAdminStore.getState().addSessionLog('info', `Entry ${i}`);
    }

    expect(useAdminStore.getState().sessionLog).toHaveLength(100);
    // Most recent entry should be the last one added
    expect(useAdminStore.getState().sessionLog[0].message).toBe('Entry 104');
  });
});

// ----------------------------------------------------------------
// clearSessionLog
// ----------------------------------------------------------------

describe('clearSessionLog', () => {
  it('should empty sessionLog array', () => {
    useAdminStore.getState().addSessionLog('info', 'Entry 1');
    useAdminStore.getState().addSessionLog('info', 'Entry 2');
    expect(useAdminStore.getState().sessionLog).toHaveLength(2);

    useAdminStore.getState().clearSessionLog();

    expect(useAdminStore.getState().sessionLog).toEqual([]);
  });

  it('should remove session log from localStorage', () => {
    useAdminStore.getState().addSessionLog('info', 'Entry');
    expect(storage['admin_session_log']).toBeDefined();

    useAdminStore.getState().clearSessionLog();

    expect(storage['admin_session_log']).toBeUndefined();
  });
});

// ----------------------------------------------------------------
// exportSessionLog
// ----------------------------------------------------------------

describe('exportSessionLog', () => {
  it('should create and trigger a download', () => {
    // Mock DOM APIs for download
    const mockClick = vi.fn();
    const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: mockClick,
    } as unknown as HTMLAnchorElement);
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
    const mockRevokeObjectURL = vi.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    useAdminStore.getState().addSessionLog('info', 'Export test');
    useAdminStore.getState().exportSessionLog();

    expect(mockCreateElement).toHaveBeenCalledWith('a');
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');

    mockCreateElement.mockRestore();
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
