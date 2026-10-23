/**
 * Property-Based Tests for useAdminStore
 * Feature: admin-portal-redesign
 *
 * Property 3: TTL cache correctness
 * (Property 4, session log round-trip, was retired with the session log in
 * the Cycle Controls redesign.)
 *
 * Uses fast-check with minimum 100 iterations per property.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
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
// The global setupTests.ts replaces localStorage with vi.fn() stubs.
// We need a real storage implementation for these tests since the store
// relies on actual localStorage read/write round-trips.

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

// ----------------------------------------------------------------
// Setup / Teardown
// ----------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  setupLocalStorageMock();
  // Reset the store to clean state
  useAdminStore.setState({
    systemStats: null,
    statsLastFetched: null,
    statsLastFilter: null,
    statsLoading: false,
    securitySummary: null,
    securityLastFetched: null,
    ttlMs: 60_000,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

// ----------------------------------------------------------------
// Property 3: TTL cache correctness
// ----------------------------------------------------------------

describe('Property 3: TTL cache correctness', () => {
  /**
   * **Validates: Requirements 4.1, 4.2, 4.3**
   *
   * For any TTL value T > 0 and for any elapsed time E since the last fetch,
   * calling fetchStats() SHALL return cached data without an API call if and
   * only if E < T. When E >= T, a new API call SHALL be made and the cache
   * SHALL be updated.
   */
  it('returns cached data iff elapsed < TTL, fetches fresh data otherwise', async () => {
    await fc.assert(
      fc.asyncProperty(
        // TTL between 1ms and 300_000ms (5 minutes)
        fc.integer({ min: 1, max: 300_000 }),
        // Elapsed time between 0ms and 600_000ms (10 minutes)
        fc.integer({ min: 0, max: 600_000 }),
        async (ttlMs, elapsedMs) => {
          vi.clearAllMocks();
          vi.useFakeTimers();

          const now = Date.now();

          const stats = makeSystemStats(ttlMs);

          // Mock the API to return stats
          mockedApiGet.mockResolvedValue({ data: stats });

          // Reset store with the given TTL
          useAdminStore.setState({
            systemStats: null,
            statsLastFetched: null,
            statsLastFilter: null,
            statsLoading: false,
            ttlMs,
          });

          // First fetch — should always call the API since cache is empty
          await useAdminStore.getState().fetchStats();
          expect(mockedApiGet).toHaveBeenCalledTimes(1);
          expect(useAdminStore.getState().systemStats).toEqual(stats);

          // Clear mock call count for the second fetch
          mockedApiGet.mockClear();

          // Simulate elapsed time by manipulating statsLastFetched
          // With fake timers, Date.now() is frozen so there's no drift
          const simulatedLastFetched = now - elapsedMs;
          useAdminStore.setState({ statsLastFetched: simulatedLastFetched });

          // Prepare fresh stats for potential re-fetch
          const freshStats = makeSystemStats(ttlMs + 1);
          mockedApiGet.mockResolvedValue({ data: freshStats });

          // Second fetch — should use cache if elapsed < TTL
          await useAdminStore.getState().fetchStats();

          if (elapsedMs < ttlMs) {
            // Cache is still valid — no API call should be made
            expect(mockedApiGet).not.toHaveBeenCalled();
            // Store should still have the original stats
            expect(useAdminStore.getState().systemStats).toEqual(stats);
          } else {
            // Cache expired — API should be called
            expect(mockedApiGet).toHaveBeenCalledTimes(1);
            // Store should have the fresh stats
            expect(useAdminStore.getState().systemStats).toEqual(freshStats);
          }

          vi.useRealTimers();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Additional sub-property: force=true always bypasses cache regardless of TTL.
   *
   * **Validates: Requirements 4.3**
   */
  it('force=true always triggers an API call regardless of TTL', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 300_000 }),
        async (ttlMs) => {
          vi.clearAllMocks();

          const stats = makeSystemStats(ttlMs);
          mockedApiGet.mockResolvedValue({ data: stats });

          // Set up store with a very recent fetch (0ms elapsed — well within TTL)
          useAdminStore.setState({
            systemStats: makeSystemStats(0),
            statsLastFetched: Date.now(),
            statsLastFilter: 'real',
            statsLoading: false,
            ttlMs,
          });

          // Force fetch should always call the API
          await useAdminStore.getState().fetchStats(undefined, true);
          expect(mockedApiGet).toHaveBeenCalledTimes(1);
          expect(useAdminStore.getState().systemStats).toEqual(stats);
        },
      ),
      { numRuns: 100 },
    );
  });
});
