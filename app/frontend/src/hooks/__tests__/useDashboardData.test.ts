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

import { useDashboardData } from '../useDashboardData';

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
