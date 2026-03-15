import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardTab } from '../DashboardTab';
import type { SystemStats } from '../types';

// Mock apiClient — DashboardTab fetches system health data from /api/analytics/*
vi.mock('../../../utils/apiClient', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

import apiClient from '../../../utils/apiClient';
const mockedApiClient = vi.mocked(apiClient);

/* ------------------------------------------------------------------ */
/*  Mock SystemStats                                                   */
/* ------------------------------------------------------------------ */

const mockStats: SystemStats = {
  robots: {
    total: 42,
    byTier: [
      { league: 'Bronze', count: 15 },
      { league: 'Silver', count: 12 },
      { league: 'Gold', count: 10 },
      { league: 'Platinum', count: 5 },
    ],
    battleReady: 35,
    battleReadyPercentage: 83.3,
  },
  matches: {
    scheduled: 20,
    completed: 18,
  },
  battles: {
    last24Hours: 8,
    total: 150,
    draws: 12,
    drawPercentage: 8,
    avgDuration: 45,
    kills: 30,
    killPercentage: 20,
  },
  finances: {
    totalCredits: 5000000,
    avgBalance: 119047,
    usersAtRisk: 3,
    totalUsers: 42,
  },
  facilities: {
    summary: [
      { type: 'training_center', purchaseCount: 25, avgLevel: 3 },
      { type: 'repair_bay', purchaseCount: 18, avgLevel: 2 },
      { type: 'weapon_forge', purchaseCount: 10, avgLevel: 1 },
    ],
    totalPurchases: 53,
    mostPopular: 'training_center',
  },
  weapons: {
    totalBought: 80,
    equipped: 60,
  },
  stances: [
    { stance: 'aggressive', count: 20 },
    { stance: 'defensive', count: 15 },
    { stance: 'balanced', count: 7 },
  ],
  loadouts: [
    { type: 'heavy_armor', count: 12 },
    { type: 'light_speed', count: 8 },
  ],
  yieldThresholds: {
    distribution: [
      { threshold: 20, count: 10 },
      { threshold: 30, count: 15 },
      { threshold: 50, count: 8 },
    ],
    mostCommon: 30,
    mostCommonCount: 15,
  },
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('DashboardTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApiClient.get.mockResolvedValue({ data: [] });
  });

  it('should render loading state when loading is true', () => {
    render(<DashboardTab stats={null} loading={true} />);

    expect(screen.getByText('Loading dashboard statistics...')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-tab')).toBeInTheDocument();
  });

  it('should render stats grid with mock data', () => {
    render(<DashboardTab stats={mockStats} loading={false} />);

    // Robots section
    expect(screen.getByText('Robots')).toBeInTheDocument();
    expect(screen.getByText(/Total: 42/)).toBeInTheDocument();
    expect(screen.getByText(/Battle Ready: 35/)).toBeInTheDocument();

    // Matches section
    expect(screen.getByText('Matches')).toBeInTheDocument();
    expect(screen.getByText(/Scheduled: 20/)).toBeInTheDocument();
    expect(screen.getByText(/Completed: 18/)).toBeInTheDocument();

    // Battles section
    expect(screen.getByText('Battles')).toBeInTheDocument();
    expect(screen.getByText(/Total: 150/)).toBeInTheDocument();
    expect(screen.getByText(/Last 24 Hours: 8/)).toBeInTheDocument();

    // Finances section
    expect(screen.getByText('Finances')).toBeInTheDocument();
    expect(screen.getByText(/Total Credits:/)).toBeInTheDocument();
    expect(screen.getByText(/Total Users: 42/)).toBeInTheDocument();

    // Facilities section
    expect(screen.getByText('Facilities')).toBeInTheDocument();
    expect(screen.getByText(/Total Purchases: 53/)).toBeInTheDocument();

    // Weapons section
    expect(screen.getByText('Weapons')).toBeInTheDocument();
    expect(screen.getByText(/Total Bought: 80/)).toBeInTheDocument();
    expect(screen.getByText(/Equipped: 60/)).toBeInTheDocument();
  });

  it('should render empty state when stats is null', () => {
    render(<DashboardTab stats={null} loading={false} />);

    // Should not show loading text (loading is false)
    expect(screen.queryByText('Loading dashboard statistics...')).not.toBeInTheDocument();
    // Should still render the dashboard-tab container and System Health section
    expect(screen.getByTestId('dashboard-tab')).toBeInTheDocument();
    expect(screen.getByTestId('system-health-section')).toBeInTheDocument();
    // Stats grid should not be present
    expect(screen.queryByText('Robots')).not.toBeInTheDocument();
  });

  it('should render System Health collapsible section', () => {
    render(<DashboardTab stats={mockStats} loading={false} />);

    const details = screen.getByTestId('system-health-section');
    expect(details).toBeInTheDocument();
    expect(details.tagName).toBe('DETAILS');

    // Summary text should be visible
    expect(screen.getByText(/System Health/)).toBeInTheDocument();
  });

  it('should expand System Health section on click and fetch data', async () => {
    const user = userEvent.setup();

    // Return appropriate mock data for each analytics endpoint
    mockedApiClient.get.mockImplementation((url: string) => {
      if (url.includes('/api/analytics/performance')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/api/analytics/integrity')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/api/analytics/logs/summary')) {
        return Promise.resolve({
          data: { totalEvents: 100, eventsByType: {}, uniqueUsers: 5, uniqueRobots: 10 },
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DashboardTab stats={mockStats} loading={false} />);

    const summary = screen.getByText(/System Health/);

    // Click to expand
    await user.click(summary);

    // After expanding, the component should fetch system health data
    await waitFor(() => {
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/analytics/performance'),
      );
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/analytics/integrity'),
      );
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/analytics/logs/summary'),
      );
    });

    // Data integrity section should appear inside the expanded details
    expect(screen.getByText('Data Integrity Status')).toBeInTheDocument();
    expect(screen.getByText('Cycle Performance')).toBeInTheDocument();
  });
});
