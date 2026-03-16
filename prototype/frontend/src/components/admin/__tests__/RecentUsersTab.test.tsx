import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { RecentUsersTab } from '../RecentUsersTab';
import type { RecentUsersResponse } from '../types';

// Mock apiClient — RecentUsersTab fetches from /api/admin/users/recent
vi.mock('../../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

import apiClient from '../../../utils/apiClient';
const mockedApiClient = vi.mocked(apiClient);

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const mockRecentUsersResponse: RecentUsersResponse = {
  currentCycle: 30,
  cyclesBack: 10,
  cutoffDate: '2025-01-05T00:00:00Z',
  totalUsers: 2,
  usersWithIssues: 1,
  timestamp: '2025-01-15T12:00:00Z',
  users: [
    {
      userId: 1,
      username: 'new_player',
      stableName: 'Iron Wolves',
      currency: 15000,
      role: 'user',
      createdAt: '2025-01-10T08:00:00Z',
      onboarding: { completed: true, skipped: false, currentStep: 9, strategy: 'balanced' },
      robots: [
        {
          id: 101,
          name: 'Wolfbot',
          currentHP: 80,
          maxHP: 100,
          hpPercent: 80,
          elo: 1200,
          league: 'bronze',
          totalBattles: 5,
          wins: 3,
          losses: 1,
          draws: 1,
          winRate: 60,
          battleReady: true,
          hasWeapon: true,
          loadout: 'heavy_arms',
          stance: 'aggressive',
          createdAt: '2025-01-10T09:00:00Z',
        },
      ],
      summary: {
        totalRobots: 1,
        battleReadyRobots: 1,
        robotsWithBattles: 1,
        totalBattles: 5,
        totalWins: 3,
        winRate: 60,
        facilitiesPurchased: 2,
      },
      issues: [],
    },
    {
      userId: 2,
      username: 'struggling_user',
      stableName: null,
      currency: 500,
      role: 'user',
      createdAt: '2025-01-12T10:00:00Z',
      onboarding: { completed: false, skipped: true, currentStep: 3, strategy: null },
      robots: [],
      summary: {
        totalRobots: 0,
        battleReadyRobots: 0,
        robotsWithBattles: 0,
        totalBattles: 0,
        totalWins: 0,
        winRate: 0,
        facilitiesPurchased: 0,
      },
      issues: ['No robots created'],
    },
    {
      userId: 3,
      username: 'mid_onboard',
      stableName: 'Steel Forge',
      currency: 10000,
      role: 'user',
      createdAt: '2025-01-14T06:00:00Z',
      onboarding: { completed: false, skipped: false, currentStep: 5, strategy: 'aggressive' },
      robots: [],
      summary: {
        totalRobots: 0,
        battleReadyRobots: 0,
        robotsWithBattles: 0,
        totalBattles: 0,
        totalWins: 0,
        winRate: 0,
        facilitiesPurchased: 0,
      },
      issues: [],
    },
  ],
};

const mockEmptyResponse: RecentUsersResponse = {
  currentCycle: 30,
  cyclesBack: 10,
  cutoffDate: '2025-01-05T00:00:00Z',
  totalUsers: 0,
  usersWithIssues: 0,
  users: [],
  timestamp: '2025-01-15T12:00:00Z',
};

/* ------------------------------------------------------------------ */
/*  Helper                                                             */
/* ------------------------------------------------------------------ */

function renderWithRouter() {
  return render(
    <BrowserRouter>
      <RecentUsersTab />
    </BrowserRouter>,
  );
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('RecentUsersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state while fetching', () => {
    // Never resolve — keeps the component in loading state
    mockedApiClient.get.mockReturnValue(new Promise(() => {}));

    renderWithRouter();

    expect(screen.getByTestId('recent-users-tab')).toBeInTheDocument();
    expect(screen.getByText(/Loading recent users/)).toBeInTheDocument();
  });

  it('should render user list with mock data', async () => {
    mockedApiClient.get.mockResolvedValue({ data: mockRecentUsersResponse });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Iron Wolves')).toBeInTheDocument();
    });

    // Verify usernames
    expect(screen.getByText('@new_player')).toBeInTheDocument();
    expect(screen.getByText('struggling_user')).toBeInTheDocument();
    expect(screen.getByText('Steel Forge')).toBeInTheDocument();

    // Verify summary cards
    expect(screen.getByText('Total Real Users')).toBeInTheDocument();

    // Verify the API was called with cycles param
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/admin/users/recent?cycles=10');
  });

  it('should render onboarding status badges', async () => {
    mockedApiClient.get.mockResolvedValue({ data: mockRecentUsersResponse });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Iron Wolves')).toBeInTheDocument();
    });

    // Completed badge for user 1
    expect(screen.getByText(/Onboarding complete/)).toBeInTheDocument();

    // Skipped badge for user 2
    expect(screen.getByText(/Onboarding skipped/)).toBeInTheDocument();

    // In-progress badge for user 3 (step 5/9)
    expect(screen.getByText(/Onboarding step 5\/9/)).toBeInTheDocument();
  });

  it('should render cycle range control', () => {
    mockedApiClient.get.mockReturnValue(new Promise(() => {}));

    renderWithRouter();

    // Verify the cycle range input exists
    const cycleInput = screen.getByRole('spinbutton');
    expect(cycleInput).toBeInTheDocument();
    expect(cycleInput).toHaveValue(10);

    // Verify the label text wrapping the input
    expect(screen.getByText((_content, el) =>
      el?.tagName === 'LABEL' && /Last.*cycles/.test(el.textContent ?? ''),
    )).toBeInTheDocument();
  });

  it('should render empty state when no users', async () => {
    mockedApiClient.get.mockResolvedValue({ data: mockEmptyResponse });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/No real users registered/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Try increasing the cycle range/)).toBeInTheDocument();
  });
});
