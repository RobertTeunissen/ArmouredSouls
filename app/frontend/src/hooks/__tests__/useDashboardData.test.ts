/**
 * Tests for useDashboardData.
 *
 * Focuses on the logic the hook owns rather than the plumbing: the 48-hour
 * champion window, "was this my win", and the roster-wide tuning request that
 * replaced the per-robot fan-out.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockGetTutorialState = vi.fn();
vi.mock('../../utils/onboardingApi', () => ({
  getTutorialState: () => mockGetTutorialState(),
}));

const mockApiGet = vi.fn();
vi.mock('../../utils/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args) },
}));

const mockGetMyTeamBattles = vi.fn();
vi.mock('../../utils/teamBattleApi', () => ({
  getMyTeamBattles: () => mockGetMyTeamBattles(),
}));

const mockFetchTuningAllocationSummaries = vi.fn();
vi.mock('../../utils/robotApi', () => ({
  fetchTuningAllocationSummaries: () => mockFetchTuningAllocationSummaries(),
}));

const mockFetchRobots = vi.fn();
const mockFetchStableData = vi.fn();
const mockFetchOverview = vi.fn();
let mockRobots: { id: number }[] = [];

vi.mock('../../stores', () => ({
  useRobotStore: (selector: (s: unknown) => unknown) =>
    selector({ robots: mockRobots, fetchRobots: mockFetchRobots }),
  useStableStore: (selector: (s: unknown) => unknown) =>
    selector({ fetchStableData: mockFetchStableData }),
}));

vi.mock('../../stores/subscriptionStore', () => ({
  useSubscriptionStore: (selector: (s: unknown) => unknown) =>
    selector({ fetchOverview: mockFetchOverview }),
}));

const mockFetchCycleProgressSummary = vi.fn();
vi.mock('../../utils/dashboardApi', () => ({
  fetchCycleProgressSummary: () => mockFetchCycleProgressSummary(),
}));

import { useDashboardData } from '../useDashboardData';

const CYCLE_PROGRESS = {
  window: { start: '2026-08-26T00:00:00.000Z', end: '2026-08-26T12:00:00.000Z', cycleNumber: 61 },
  battlesFought: 3,
  matchesScheduled: 5,
  winLossBattles: 2,
  placementBattles: 1,
  winLossDraw: { wins: 2, losses: 1, draws: 0 },
  bestPlacement: null,
  remainingSlotsUtc: ['15:00'],
  nextSettlementAt: '2026-08-27T00:00:00.000Z',
  prestigeEarned: 40,
  battleEarnings: 51000,
  repairSpend: { manual: 0, automatic: 0 },
  comparison: null,
};

const TUTORIAL_STATE = {
  currentStep: 9,
  hasCompletedOnboarding: true,
  onboardingSkipped: false,
  strategy: null,
  choices: {},
  startedAt: null,
  completedAt: '2026-01-01T00:00:00Z',
};

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function tournament(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Spring Cup',
    participantType: 'robot',
    completedAt: hoursAgo(1),
    winner: { id: 10, name: 'Bot', user: { id: 1, username: 'me', stableName: 'Mine' } },
    ...overrides,
  };
}

describe('useDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRobots = [];
    mockGetTutorialState.mockResolvedValue(TUTORIAL_STATE);
    mockGetMyTeamBattles.mockResolvedValue([]);
    mockFetchTuningAllocationSummaries.mockResolvedValue([]);
    mockFetchCycleProgressSummary.mockResolvedValue(CYCLE_PROGRESS);
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/leagues/tier-changes/unseen') return Promise.resolve({ changes: [] });
      if (url === '/api/tournaments') return Promise.resolve({ tournaments: [] });
      return Promise.resolve({});
    });
  });

  it('should return empty collections before anything resolves', async () => {
    const { result } = renderHook(() => useDashboardData(1));

    expect(result.current.tierChanges).toEqual([]);
    expect(result.current.recentChampions).toEqual([]);
    expect(result.current.teams).toEqual([]);
    expect(result.current.tuningSummaries).toEqual([]);
    expect(result.current.onboardingState).toBeNull();

    // Let the in-flight requests settle so their state updates land inside act.
    await waitFor(() => expect(result.current.onboardingState).not.toBeNull());
  });

  it('should not fetch anything without a signed-in user', () => {
    renderHook(() => useDashboardData(undefined));

    expect(mockApiGet).not.toHaveBeenCalled();
    expect(mockGetTutorialState).not.toHaveBeenCalled();
    expect(mockFetchRobots).not.toHaveBeenCalled();
  });

  it('should trigger the shared stores once a user is present', async () => {
    const { result } = renderHook(() => useDashboardData(1));

    expect(mockFetchRobots).toHaveBeenCalledTimes(1);
    expect(mockFetchStableData).toHaveBeenCalledTimes(1);
    expect(mockFetchOverview).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(result.current.onboardingState).not.toBeNull());
  });

  it('should expose the tutorial state once loaded', async () => {
    const { result } = renderHook(() => useDashboardData(1));

    await waitFor(() => expect(result.current.onboardingState).toEqual(TUTORIAL_STATE));
  });

  it('should fall back to a null tutorial state when the request fails', async () => {
    mockGetTutorialState.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useDashboardData(1));

    await waitFor(() => expect(mockGetTutorialState).toHaveBeenCalled());
    await waitFor(() => expect(result.current.teams).toEqual([]));
    expect(result.current.onboardingState).toBeNull();
  });

  it('should keep the rest of the data when one request fails', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/leagues/tier-changes/unseen') return Promise.reject(new Error('boom'));
      return Promise.resolve({ tournaments: [tournament()] });
    });

    const { result } = renderHook(() => useDashboardData(1));

    await waitFor(() => expect(result.current.recentChampions).toHaveLength(1));
    expect(result.current.tierChanges).toEqual([]);
  });

  describe('recent champions', () => {
    it('should include a win from within the last 48 hours', async () => {
      mockApiGet.mockImplementation((url: string) =>
        url === '/api/tournaments'
          ? Promise.resolve({ tournaments: [tournament({ completedAt: hoursAgo(47) })] })
          : Promise.resolve({ changes: [] }),
      );

      const { result } = renderHook(() => useDashboardData(1));

      await waitFor(() => expect(result.current.recentChampions).toHaveLength(1));
    });

    it('should exclude a win older than 48 hours', async () => {
      mockApiGet.mockImplementation((url: string) =>
        url === '/api/tournaments'
          ? Promise.resolve({ tournaments: [tournament({ completedAt: hoursAgo(49) })] })
          : Promise.resolve({ changes: [] }),
      );

      const { result } = renderHook(() => useDashboardData(1));

      await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/api/tournaments', expect.anything()));
      expect(result.current.recentChampions).toEqual([]);
    });

    it('should exclude a tournament with no winner recorded', async () => {
      mockApiGet.mockImplementation((url: string) =>
        url === '/api/tournaments'
          ? Promise.resolve({ tournaments: [tournament({ winner: null })] })
          : Promise.resolve({ changes: [] }),
      );

      const { result } = renderHook(() => useDashboardData(1));

      await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/api/tournaments', expect.anything()));
      expect(result.current.recentChampions).toEqual([]);
    });

    it('should mark a win as mine when the winning stable is the current user', async () => {
      mockApiGet.mockImplementation((url: string) =>
        url === '/api/tournaments'
          ? Promise.resolve({ tournaments: [tournament()] })
          : Promise.resolve({ changes: [] }),
      );

      const { result } = renderHook(() => useDashboardData(1));

      await waitFor(() => expect(result.current.recentChampions[0]?.isMyWin).toBe(true));
    });

    it('should not mark another stable\'s win as mine', async () => {
      mockApiGet.mockImplementation((url: string) =>
        url === '/api/tournaments'
          ? Promise.resolve({
              tournaments: [
                tournament({
                  winner: { id: 20, name: 'Rival', user: { id: 99, username: 'them', stableName: 'Theirs' } },
                }),
              ],
            })
          : Promise.resolve({ changes: [] }),
      );

      const { result } = renderHook(() => useDashboardData(1));

      await waitFor(() => expect(result.current.recentChampions).toHaveLength(1));
      expect(result.current.recentChampions[0].isMyWin).toBe(false);
    });

    it('should tolerate a response with no tournaments field', async () => {
      mockApiGet.mockImplementation(() => Promise.resolve({}));

      const { result } = renderHook(() => useDashboardData(1));

      await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
      expect(result.current.recentChampions).toEqual([]);
    });
  });

  describe('tuning summaries', () => {
    it('should not request tuning budgets for an empty roster', async () => {
      mockRobots = [];

      renderHook(() => useDashboardData(1));

      await waitFor(() => expect(mockFetchRobots).toHaveBeenCalled());
      expect(mockFetchTuningAllocationSummaries).not.toHaveBeenCalled();
    });

    it('should make exactly one request for a whole roster', async () => {
      // The point of the endpoint: five robots, one call, not five.
      mockRobots = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
      mockFetchTuningAllocationSummaries.mockResolvedValue([
        { robotId: 1, poolSize: 10, allocated: 0, remaining: 10 },
      ]);

      const { result } = renderHook(() => useDashboardData(1));

      await waitFor(() => expect(result.current.tuningSummaries).toHaveLength(1));
      expect(mockFetchTuningAllocationSummaries).toHaveBeenCalledTimes(1);
    });

    it('should not re-request when the roster size is unchanged', async () => {
      mockRobots = [{ id: 1 }];

      const { rerender } = renderHook(() => useDashboardData(1));
      await waitFor(() => expect(mockFetchTuningAllocationSummaries).toHaveBeenCalledTimes(1));

      rerender();

      expect(mockFetchTuningAllocationSummaries).toHaveBeenCalledTimes(1);
    });

    it('should re-request when a robot is added to the roster', async () => {
      mockRobots = [{ id: 1 }];

      const { rerender } = renderHook(() => useDashboardData(1));
      await waitFor(() => expect(mockFetchTuningAllocationSummaries).toHaveBeenCalledTimes(1));

      mockRobots = [{ id: 1 }, { id: 2 }];
      rerender();

      await waitFor(() => expect(mockFetchTuningAllocationSummaries).toHaveBeenCalledTimes(2));
    });

    it('should clear summaries when the roster empties', async () => {
      mockRobots = [{ id: 1 }];
      mockFetchTuningAllocationSummaries.mockResolvedValue([
        { robotId: 1, poolSize: 10, allocated: 2, remaining: 8 },
      ]);

      const { result, rerender } = renderHook(() => useDashboardData(1));
      await waitFor(() => expect(result.current.tuningSummaries).toHaveLength(1));

      mockRobots = [];
      rerender();

      await waitFor(() => expect(result.current.tuningSummaries).toEqual([]));
    });
  });

  it('should expose fetched teams', async () => {
    mockGetMyTeamBattles.mockResolvedValue([{ id: 1, teamSize: 2, teamName: 'Duo', members: [] }]);

    const { result } = renderHook(() => useDashboardData(1));

    await waitFor(() => expect(result.current.teams).toHaveLength(1));
  });

  it('should expose unseen tier changes', async () => {
    const change = {
      id: 5,
      entityType: 'robot',
      entityId: 1,
      entityName: 'Bot',
      changeType: 'promotion' as const,
      sourceTier: 'bronze',
      destinationTier: 'silver',
    };
    mockApiGet.mockImplementation((url: string) =>
      url === '/api/leagues/tier-changes/unseen'
        ? Promise.resolve({ changes: [change] })
        : Promise.resolve({ tournaments: [] }),
    );

    const { result } = renderHook(() => useDashboardData(1));

    await waitFor(() => expect(result.current.tierChanges).toEqual([change]));
  });
});

// ─── Spec #48 ───────────────────────────────────────────────────────────────

describe('useDashboardData — Cycle_Progress_Summary (Spec #48)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRobots = [];
    mockGetTutorialState.mockResolvedValue(TUTORIAL_STATE);
    mockGetMyTeamBattles.mockResolvedValue([]);
    mockFetchTuningAllocationSummaries.mockResolvedValue([]);
    mockFetchCycleProgressSummary.mockResolvedValue(CYCLE_PROGRESS);
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/leagues/tier-changes/unseen') return Promise.resolve({ changes: [] });
      if (url === '/api/tournaments') return Promise.resolve({ tournaments: [] });
      return Promise.resolve({});
    });
  });

  it('exposes the summary once it resolves and clears the loading flag', async () => {
    const { result } = renderHook(() => useDashboardData(1));

    expect(result.current.cycleProgressLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.cycleProgress).toEqual(CYCLE_PROGRESS);
    });
    expect(result.current.cycleProgressLoading).toBe(false);
    expect(result.current.cycleProgressError).toBeNull();
  });

  it('surfaces an error rather than failing silently, because three tiles depend on it', async () => {
    // Unlike the five optional reads, this one gets an explicit error.
    mockFetchCycleProgressSummary.mockRejectedValue(new Error('endpoint down'));

    const { result } = renderHook(() => useDashboardData(1));

    await waitFor(() => {
      expect(result.current.cycleProgressError).not.toBeNull();
    });
    expect(result.current.cycleProgress).toBeNull();
    expect(result.current.cycleProgressLoading).toBe(false);
  });

  it('leaves the five optional reads failing silently when they reject', async () => {
    mockGetTutorialState.mockRejectedValue(new Error('nope'));
    mockGetMyTeamBattles.mockRejectedValue(new Error('nope'));
    mockApiGet.mockRejectedValue(new Error('nope'));

    const { result } = renderHook(() => useDashboardData(1));

    await waitFor(() => {
      expect(result.current.cycleProgress).toEqual(CYCLE_PROGRESS);
    });
    // An alert that cannot be computed is simply not shown.
    expect(result.current.tierChanges).toEqual([]);
    expect(result.current.recentChampions).toEqual([]);
    expect(result.current.teams).toEqual([]);
    expect(result.current.onboardingState).toBeNull();
    // …and it does not take the cycle figures down with it.
    expect(result.current.cycleProgressError).toBeNull();
  });

  it('calls refreshUser exactly once, so the balance and totals match the cycle figures', async () => {
    // Requirement 3 criterion 10 / Requirement 6 criterion 12: AuthContext refreshes
    // only at app mount, so without this the balance could be hours stale beside a
    // current Current_Cycle figure.
    const refreshUser = vi.fn().mockResolvedValue(undefined);

    renderHook(() => useDashboardData(1, refreshUser));

    await waitFor(() => {
      expect(refreshUser).toHaveBeenCalledTimes(1);
    });
  });

  it('still renders the row when refreshUser rejects — a stale total beats an empty tile', async () => {
    // Requirement 3 criterion 11 / Requirement 6 criterion 13.
    const refreshUser = vi.fn().mockRejectedValue(new Error('refresh failed'));

    const { result } = renderHook(() => useDashboardData(1, refreshUser));

    await waitFor(() => {
      expect(result.current.cycleProgress).toEqual(CYCLE_PROGRESS);
    });
    expect(result.current.cycleProgressError).toBeNull();
  });

  it('does not call refreshUser or fetch the summary without a signed-in user', () => {
    const refreshUser = vi.fn();

    renderHook(() => useDashboardData(undefined, refreshUser));

    expect(refreshUser).not.toHaveBeenCalled();
    expect(mockFetchCycleProgressSummary).not.toHaveBeenCalled();
  });

  it('issues exactly one summary request per user, not one per tile', () => {
    renderHook(() => useDashboardData(1));
    expect(mockFetchCycleProgressSummary).toHaveBeenCalledTimes(1);
  });
});
