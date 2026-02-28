import { vi } from 'vitest';
import { LeagueRobot, LeagueInstance, PaginatedResponse } from '../../utils/matchmakingApi';

// Mock API responses
export const mockGetLeagueStandings = vi.fn<
  [string, number, number, string?],
  Promise<PaginatedResponse<LeagueRobot>>
>();

export const mockGetLeagueInstances = vi.fn<
  [string],
  Promise<LeagueInstance[]>
>();

export const mockFetch = vi.fn();

// Setup default mock implementations
export function setupDefaultApiMocks() {
  // Default implementation for getLeagueStandings
  mockGetLeagueStandings.mockResolvedValue({
    data: [],
    pagination: {
      page: 1,
      pageSize: 50,
      total: 0,
      totalPages: 0,
    },
  });

  // Default implementation for getLeagueInstances
  mockGetLeagueInstances.mockResolvedValue([]);

  // Default implementation for fetch (user robots endpoint)
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => [],
  });
}

// Reset all mocks
export function resetApiMocks() {
  mockGetLeagueStandings.mockReset();
  mockGetLeagueInstances.mockReset();
  mockFetch.mockReset();
  setupDefaultApiMocks();
}

// Mock the matchmaking API module
export function mockMatchmakingApi() {
  vi.mock('../../utils/matchmakingApi', async () => {
    const actual = await vi.importActual('../../utils/matchmakingApi');
    return {
      ...actual,
      getLeagueStandings: mockGetLeagueStandings,
      getLeagueInstances: mockGetLeagueInstances,
    };
  });
}

// Mock global fetch
export function mockGlobalFetch() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.fetch = mockFetch as unknown as typeof fetch;
}
