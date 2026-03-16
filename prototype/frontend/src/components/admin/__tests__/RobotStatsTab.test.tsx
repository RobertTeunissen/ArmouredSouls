import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { RobotStatsTab } from '../RobotStatsTab';
import type { RobotStats } from '../types';

// Mock apiClient — RobotStatsTab fetches from /api/admin/stats/robots
vi.mock('../../../utils/apiClient', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: null }),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

import apiClient from '../../../utils/apiClient';
const mockedApiClient = vi.mocked(apiClient);

/* ------------------------------------------------------------------ */
/*  Mock RobotStats data                                               */
/* ------------------------------------------------------------------ */

const mockRobotStats: RobotStats = {
  summary: {
    totalRobots: 50,
    robotsWithBattles: 40,
    totalBattles: 200,
    overallWinRate: 52.3,
    averageElo: 1150,
  },
  attributeStats: {
    combatPower: {
      mean: 55.2,
      median: 54.0,
      stdDev: 12.3,
      min: 20,
      max: 95,
      q1: 45,
      q3: 65,
      iqr: 20,
      lowerBound: 15,
      upperBound: 95,
    },
  },
  outliers: {
    combatPower: [
      { id: 1, name: 'OutlierBot', value: 99, league: 'gold', elo: 1400, winRate: 85 },
    ],
  },
  statsByLeague: {
    bronze: {
      count: 15,
      averageElo: 900,
      attributes: { combatPower: { mean: 40.5, median: 39.0 } },
    },
    gold: {
      count: 10,
      averageElo: 1200,
      attributes: { combatPower: { mean: 60.1, median: 58.0 } },
    },
  },
  winRateAnalysis: {
    combatPower: [
      { quintile: 1, avgValue: 30.0, avgWinRate: 35.2, sampleSize: 10 },
      { quintile: 5, avgValue: 80.0, avgWinRate: 68.5, sampleSize: 10 },
    ],
  },
  topPerformers: {
    combatPower: [
      { id: 2, name: 'TopBot', value: 95, league: 'diamond', elo: 1500, winRate: 90 },
    ],
  },
  bottomPerformers: {
    combatPower: [
      { id: 3, name: 'WeakBot', value: 20, league: 'bronze', elo: 800, winRate: 15 },
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function renderRobotStatsTab(): ReturnType<typeof render> {
  return render(
    <BrowserRouter>
      <RobotStatsTab />
    </BrowserRouter>,
  );
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('RobotStatsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockedApiClient.get.mockResolvedValue({ data: mockRobotStats });
  });

  it('should render attribute selector dropdown with option groups', async () => {
    renderRobotStatsTab();

    // Wait for auto-load fetch to complete and stats to render
    await waitFor(() => {
      expect(screen.getByText('Select Attribute to Analyze')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    // Verify key attribute options exist
    const options = Array.from((select as HTMLSelectElement).options).map((o) => o.value);
    expect(options).toContain('combatPower');
    expect(options).toContain('armorPlating');
    expect(options).toContain('hullIntegrity');
    expect(options).toContain('combatAlgorithms');
    expect(options).toContain('syncProtocols');

    // Default selection should be combatPower
    expect((select as HTMLSelectElement).value).toBe('combatPower');
  });

  it('should render stats sections with mock data', async () => {
    renderRobotStatsTab();

    await waitFor(() => {
      expect(screen.getByText('Summary')).toBeInTheDocument();
    });

    // Summary stats
    expect(screen.getByText('Total Robots')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('With Battles')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('Total Battles')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();

    // Attribute statistics section
    expect(screen.getByText(/Combat Power - Statistics/)).toBeInTheDocument();

    // Outliers section
    expect(screen.getByText(/Outliers Detected/)).toBeInTheDocument();
    expect(screen.getByText('OutlierBot')).toBeInTheDocument();

    // Win Rate Correlation section
    expect(screen.getByText(/Win Rate Correlation/)).toBeInTheDocument();
    expect(screen.getByText('Bottom 20%')).toBeInTheDocument();
    expect(screen.getByText('Top 20%')).toBeInTheDocument();

    // League Comparison section
    expect(screen.getByText(/League Comparison/)).toBeInTheDocument();

    // Top performers
    expect(screen.getByText(/Top 5 Performers/)).toBeInTheDocument();
    expect(screen.getByText(/TopBot/)).toBeInTheDocument();

    // Bottom performers
    expect(screen.getByText(/Bottom 5 Performers/)).toBeInTheDocument();
    expect(screen.getByText('WeakBot')).toBeInTheDocument();
  });

  it('should render loading state while fetching', async () => {
    // Make the API call hang so we can observe loading state
    mockedApiClient.get.mockReturnValue(new Promise(() => {}));

    renderRobotStatsTab();

    await waitFor(() => {
      expect(screen.getByText('Loading robot statistics...')).toBeInTheDocument();
    });

    // The Load Statistics button should show "Loading..."
    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();
  });

  it('should render empty state when API returns error', async () => {
    mockedApiClient.get.mockRejectedValue({
      response: { data: { error: 'Failed to fetch robot statistics' } },
    });

    renderRobotStatsTab();

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch robot statistics')).toBeInTheDocument();
    });

    // Should show the empty state prompt
    expect(
      screen.getByText(/Click .* to analyze robot attributes and find outliers/),
    ).toBeInTheDocument();
  });
});
