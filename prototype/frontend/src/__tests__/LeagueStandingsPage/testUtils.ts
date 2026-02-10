import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { ReactElement } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { LeagueRobot, LeagueInstance, PaginatedResponse } from '../../utils/matchmakingApi';

// Mock User Type
export interface MockUser {
  id: number;
  username: string;
  role: string;
  currency: number;
  prestige: number;
}

// Default mock user
export const mockUser: MockUser = {
  id: 1,
  username: 'testuser',
  role: 'user',
  currency: 100000,
  prestige: 500,
};

// Mock AuthContext value
export const mockAuthContext = {
  user: mockUser,
  token: 'mock-token',
  login: vi.fn(),
  logout: vi.fn(),
  loading: false,
  refreshUser: vi.fn(),
};

// Helper to create mock robot data
export function createMockRobot(overrides?: Partial<LeagueRobot>): LeagueRobot {
  return {
    id: 1,
    name: 'TestBot',
    elo: 1500,
    leaguePoints: 250,
    wins: 10,
    draws: 2,
    losses: 3,
    totalBattles: 15,
    currentHP: 100,
    maxHP: 100,
    fame: 500,
    userId: 2,
    user: { username: 'otheruser' },
    ...overrides,
  };
}

// Helper to create mock instance data
export function createMockInstance(overrides?: Partial<LeagueInstance>): LeagueInstance {
  return {
    leagueId: 'bronze_1',
    leagueTier: 'bronze',
    currentRobots: 50,
    maxRobots: 100,
    ...overrides,
  };
}

// Helper to create mock paginated response
export function createMockPaginatedResponse<T>(
  data: T[],
  page: number = 1,
  pageSize: number = 50
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page,
      pageSize,
      total: data.length,
      totalPages: Math.ceil(data.length / pageSize),
    },
  };
}

// Helper to render component with mocked AuthContext
export function renderWithAuthContext(
  ui: ReactElement,
  contextValue = mockAuthContext
) {
  return render(
    <AuthContext.Provider value={contextValue}>
      {ui}
    </AuthContext.Provider>
  );
}

// Helper to create multiple mock robots
export function createMockRobots(count: number, baseOverrides?: Partial<LeagueRobot>): LeagueRobot[] {
  return Array.from({ length: count }, (_, index) =>
    createMockRobot({
      id: index + 1,
      name: `Robot${index + 1}`,
      elo: 1500 + index * 10,
      leaguePoints: 250 + index * 5,
      wins: 10 + index,
      draws: 2,
      losses: 3,
      totalBattles: 15 + index,
      userId: index + 2,
      user: { username: `user${index + 1}` },
      ...baseOverrides,
    })
  );
}

// Helper to create multiple mock instances
export function createMockInstances(tier: string, count: number): LeagueInstance[] {
  return Array.from({ length: count }, (_, index) =>
    createMockInstance({
      leagueId: `${tier}_${index + 1}`,
      leagueTier: tier,
      currentRobots: 50 + index * 10,
      maxRobots: 100,
    })
  );
}
