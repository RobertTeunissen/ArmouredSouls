import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BankruptcyMonitorTab } from '../BankruptcyMonitorTab';
import type { AtRiskUsersResponse } from '../types';

// Mock apiClient — BankruptcyMonitorTab fetches from /api/admin/users/at-risk
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

const mockAtRiskResponse: AtRiskUsersResponse = {
  threshold: 10000,
  currentCycle: 25,
  totalAtRisk: 2,
  timestamp: '2025-01-15T12:00:00Z',
  users: [
    {
      userId: 1,
      username: 'player_one',
      stableName: 'Iron Forge',
      currentBalance: 3500,
      totalRepairCost: 2000,
      netBalance: 1500,
      cyclesAtRisk: 3,
      firstAtRiskCycle: 22,
      daysOfRunway: 2,
      robotCount: 4,
      damagedRobots: 2,
      balanceHistory: [
        { cycle: 23, timestamp: '2025-01-13T00:00:00Z', balance: 5000, dailyCost: 800, dailyIncome: 200 },
        { cycle: 24, timestamp: '2025-01-14T00:00:00Z', balance: 4200, dailyCost: 700, dailyIncome: 0 },
      ],
      createdAt: '2024-12-01T00:00:00Z',
    },
    {
      userId: 2,
      username: 'player_two',
      stableName: 'Steel Legion',
      currentBalance: 800,
      totalRepairCost: 5000,
      netBalance: -4200,
      cyclesAtRisk: 5,
      firstAtRiskCycle: 20,
      daysOfRunway: 0,
      robotCount: 3,
      damagedRobots: 3,
      balanceHistory: [],
      createdAt: '2024-11-15T00:00:00Z',
    },
  ],
};

const mockZeroRiskResponse: AtRiskUsersResponse = {
  threshold: 10000,
  currentCycle: 25,
  totalAtRisk: 0,
  users: [],
  timestamp: '2025-01-15T12:00:00Z',
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('BankruptcyMonitorTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state while fetching', () => {
    // Never resolve — keeps the component in loading state
    mockedApiClient.get.mockReturnValue(new Promise(() => {}));

    render(<BankruptcyMonitorTab />);

    expect(screen.getByTestId('bankruptcy-monitor-tab')).toBeInTheDocument();
    expect(screen.getByText('Bankruptcy Monitor')).toBeInTheDocument();
    expect(screen.getByText(/Loading at-risk user data/)).toBeInTheDocument();
  });

  it('should render at-risk users with mock data', async () => {
    mockedApiClient.get.mockResolvedValue({ data: mockAtRiskResponse });

    render(<BankruptcyMonitorTab />);

    await waitFor(() => {
      expect(screen.getByText('Iron Forge')).toBeInTheDocument();
    });

    // Verify both users appear
    expect(screen.getByText('@player_one')).toBeInTheDocument();
    expect(screen.getByText('Steel Legion')).toBeInTheDocument();
    expect(screen.getByText('@player_two')).toBeInTheDocument();

    // Verify at-risk summary heading
    expect(screen.getByText(/Users At Risk of Bankruptcy/)).toBeInTheDocument();

    // Verify damaged robots info for player_one
    expect(screen.getByText('2 damaged')).toBeInTheDocument();
    expect(screen.getByText('3 damaged')).toBeInTheDocument();

    // Verify the API was called correctly
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/admin/users/at-risk');
  });

  it('should render zero-state when no users at risk', async () => {
    mockedApiClient.get.mockResolvedValue({ data: mockZeroRiskResponse });

    render(<BankruptcyMonitorTab />);

    await waitFor(() => {
      expect(screen.getByTestId('no-risk-message')).toBeInTheDocument();
    });

    expect(screen.getByText('No users at risk of bankruptcy')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('should display threshold information', async () => {
    mockedApiClient.get.mockResolvedValue({ data: mockZeroRiskResponse });

    render(<BankruptcyMonitorTab />);

    await waitFor(() => {
      expect(screen.getByTestId('no-risk-message')).toBeInTheDocument();
    });

    // Zero-state shows threshold and cycle info
    expect(screen.getByText(/Threshold: ₡10,000/)).toBeInTheDocument();
    expect(screen.getByText(/Cycle 25/)).toBeInTheDocument();
  });
});
