import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, render } from '@testing-library/react';
import RobotPerformanceAnalytics from '../RobotPerformanceAnalytics';
import apiClient from '../../utils/apiClient';
import * as kothApi from '../../utils/kothApi';

// Mock apiClient (used by the component for league analytics)
vi.mock('../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

// Mock kothApi
vi.mock('../../utils/kothApi', async () => {
  const actual = await vi.importActual('../../utils/kothApi');
  return {
    ...actual,
    getKothRobotPerformance: vi.fn(),
  };
});

const mockedApiClient = vi.mocked(apiClient);
const mockedGetKothRobotPerformance = vi.mocked(kothApi.getKothRobotPerformance);

// Default mock data for the league analytics calls so the component renders
const mockCurrentCycle = { cycleNumber: 10 };
const mockSummary = {
  robotId: 1,
  cycleRange: [1, 10],
  battlesParticipated: 25,
  wins: 15,
  losses: 8,
  draws: 2,
  winRate: 60.0,
  damageDealt: 5000,
  damageReceived: 3000,
  totalCreditsEarned: 10000,
  totalFameEarned: 500,
  totalRepairCosts: 200,
  kills: 3,
  destructions: 1,
  eloChange: 50,
  eloStart: 1000,
  eloEnd: 1050,
};
const mockEmptyProgression = {
  robotId: 1,
  metric: 'elo',
  cycleRange: [1, 10],
  dataPoints: [],
  startValue: 1000,
  endValue: 1000,
  totalChange: 0,
  averageChange: 0,
  movingAverage: [],
};

function setupLeagueMocks(): void {
  mockedApiClient.get.mockImplementation((url: string) => {
    if (url.includes('/api/analytics/cycle/current')) {
      return Promise.resolve({ data: mockCurrentCycle });
    }
    if (url.includes('/performance')) {
      return Promise.resolve({ data: mockSummary });
    }
    // All metric endpoints return empty progression
    return Promise.resolve({ data: mockEmptyProgression });
  });
}

describe('KotH Robot Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');
    setupLeagueMocks();
  });

  it('should hide KotH section when kothMatches is 0', async () => {
    mockedGetKothRobotPerformance.mockResolvedValue({
      kothMatches: 0,
      kothWins: 0,
      kothTotalZoneScore: 0,
      kothTotalZoneTime: 0,
      kothKills: 0,
      kothBestPlacement: null,
      kothCurrentWinStreak: 0,
      kothBestWinStreak: 0,
      podiumRate: 0,
      avgZoneScore: 0,
    });

    render(<RobotPerformanceAnalytics robotId={1} lastNCycles={10} />);

    await waitFor(() => {
      expect(screen.getByText('Performance Summary (Last 10 Cycles)')).toBeInTheDocument();
    });

    expect(screen.queryByText('👑 King of the Hill Performance')).not.toBeInTheDocument();
  });

  it('should display KotH metrics with orange accent when kothMatches > 0', async () => {
    mockedGetKothRobotPerformance.mockResolvedValue({
      kothMatches: 10,
      kothWins: 5,
      kothTotalZoneScore: 450,
      kothTotalZoneTime: 320.5,
      kothKills: 12,
      kothBestPlacement: 1,
      kothCurrentWinStreak: 3,
      kothBestWinStreak: 4,
      podiumRate: 70.0,
      avgZoneScore: 45.0,
    });

    render(<RobotPerformanceAnalytics robotId={1} lastNCycles={10} />);

    await waitFor(() => {
      expect(screen.getByText('👑 King of the Hill Performance')).toBeInTheDocument();
    });

    // Scope assertions to the KotH section container
    const kothHeading = screen.getByText('👑 King of the Hill Performance');
    const kothSection = kothHeading.closest('.bg-surface-elevated')!;

    // Verify key metric labels are displayed
    expect(screen.getByText('1st Place Finishes')).toBeInTheDocument();
    expect(screen.getByText('Podium Rate')).toBeInTheDocument();
    expect(screen.getByText('Avg Zone Score')).toBeInTheDocument();
    expect(screen.getByText('KotH Kills')).toBeInTheDocument();
    expect(screen.getByText('Best Placement')).toBeInTheDocument();
    expect(screen.getByText('Current Win Streak')).toBeInTheDocument();
    expect(screen.getByText('Total Zone Time')).toBeInTheDocument();
    expect(screen.getByText('KotH Matches')).toBeInTheDocument();

    // Verify metric values within the KotH section
    expect(screen.getByText('70.0%')).toBeInTheDocument();
    expect(screen.getByText('45.0')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();

    // Verify orange accent color on all 8 metric values
    const orangeElements = kothSection.querySelectorAll('.text-orange-500');
    expect(orangeElements.length).toBe(8);
  });

  it('should hide KotH section when getKothRobotPerformance fails', async () => {
    mockedGetKothRobotPerformance.mockRejectedValue(new Error('Network error'));

    render(<RobotPerformanceAnalytics robotId={1} lastNCycles={10} />);

    await waitFor(() => {
      expect(screen.getByText('Performance Summary (Last 10 Cycles)')).toBeInTheDocument();
    });

    expect(screen.queryByText('👑 King of the Hill Performance')).not.toBeInTheDocument();
  });
});
