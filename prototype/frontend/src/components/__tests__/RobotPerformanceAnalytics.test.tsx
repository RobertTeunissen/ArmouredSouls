import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import RobotPerformanceAnalytics from '../RobotPerformanceAnalytics';

vi.mock('axios');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedAxios = axios as any;

describe('RobotPerformanceAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');
  });

  it('renders loading state initially', () => {
    mockedAxios.get.mockImplementation(() => new Promise(() => {}));
    
    render(<RobotPerformanceAnalytics robotId={1} lastNCycles={10} />);
    
    expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
  });

  it('renders error state when API fails', async () => {
    mockedAxios.get.mockRejectedValue({
      response: { data: { message: 'Failed to fetch data' } },
    });

    render(<RobotPerformanceAnalytics robotId={1} lastNCycles={10} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch data')).toBeInTheDocument();
    });
  });

  it('renders performance summary when data is loaded', async () => {
    const mockCurrentCycle = { cycleNumber: 10 };
    const mockSummary = {
      robotId: 1,
      cycleRange: [1, 10],
      battlesParticipated: 25,
      wins: 15,
      losses: 8,
      draws: 2,
      winRate: 0.6,
      damageDealt: 5000,
      damageReceived: 3000,
      totalCreditsEarned: 10000,
      totalFameEarned: 500,
      eloChange: 50,
      eloStart: 1000,
      eloEnd: 1050,
    };
    const mockEloProgression = {
      robotId: 1,
      metric: 'elo',
      cycleRange: [1, 10],
      dataPoints: [
        { cycleNumber: 1, value: 1000, change: 0 },
        { cycleNumber: 2, value: 1020, change: 20 },
        { cycleNumber: 3, value: 1050, change: 30 },
      ],
      startValue: 1000,
      endValue: 1050,
      totalChange: 50,
      averageChange: 16.67,
      movingAverage: [1000, 1020, 1023.33],
    };
    const mockDamageProgression = {
      robotId: 1,
      metric: 'damageDealt',
      cycleRange: [1, 10],
      dataPoints: [
        { cycleNumber: 1, value: 1000, change: 1000 },
        { cycleNumber: 2, value: 2500, change: 1500 },
        { cycleNumber: 3, value: 5000, change: 2500 },
      ],
      startValue: 0,
      endValue: 5000,
      totalChange: 5000,
      averageChange: 1666.67,
      movingAverage: [],
    };
    const mockCreditsProgression = {
      robotId: 1,
      metric: 'creditsEarned',
      cycleRange: [1, 10],
      dataPoints: [
        { cycleNumber: 1, value: 2000, change: 2000 },
        { cycleNumber: 2, value: 5000, change: 3000 },
        { cycleNumber: 3, value: 10000, change: 5000 },
      ],
      startValue: 0,
      endValue: 10000,
      totalChange: 10000,
      averageChange: 3333.33,
      movingAverage: [],
    };

    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/api/analytics/cycle/current')) {
        return Promise.resolve({ data: mockCurrentCycle });
      }
      if (url.includes('/performance')) {
        return Promise.resolve({ data: mockSummary });
      }
      if (url.includes('/metric/elo')) {
        return Promise.resolve({ data: mockEloProgression });
      }
      if (url.includes('/metric/damageDealt')) {
        return Promise.resolve({ data: mockDamageProgression });
      }
      if (url.includes('/metric/creditsEarned')) {
        return Promise.resolve({ data: mockCreditsProgression });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<RobotPerformanceAnalytics robotId={1} lastNCycles={10} />);

    await waitFor(() => {
      expect(screen.getByText('Performance Summary (Last 10 Cycles)')).toBeInTheDocument();
    });

    // Check summary stats
    expect(screen.getByText('25')).toBeInTheDocument(); // Battles
    expect(screen.getByText('60.0%')).toBeInTheDocument(); // Win rate
    expect(screen.getByText('15W - 8L - 2D')).toBeInTheDocument(); // Record
    expect(screen.getByText('+50')).toBeInTheDocument(); // ELO change

    // Check charts are rendered
    expect(screen.getByText('ELO Progression')).toBeInTheDocument();
    expect(screen.getByText('Damage Dealt Per Cycle')).toBeInTheDocument();
    expect(screen.getByText('Credits Earned Per Cycle')).toBeInTheDocument();
  });

  it('handles empty data gracefully', async () => {
    const mockCurrentCycle = { cycleNumber: 1 };
    const mockSummary = {
      robotId: 1,
      cycleRange: [1, 1],
      battlesParticipated: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      damageDealt: 0,
      damageReceived: 0,
      totalCreditsEarned: 0,
      totalFameEarned: 0,
      eloChange: 0,
      eloStart: 1000,
      eloEnd: 1000,
    };
    const mockEmptyProgression = {
      robotId: 1,
      metric: 'elo',
      cycleRange: [1, 1],
      dataPoints: [],
      startValue: 1000,
      endValue: 1000,
      totalChange: 0,
      averageChange: 0,
      movingAverage: [],
    };

    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/api/analytics/cycle/current')) {
        return Promise.resolve({ data: mockCurrentCycle });
      }
      if (url.includes('/performance')) {
        return Promise.resolve({ data: mockSummary });
      }
      return Promise.resolve({ data: mockEmptyProgression });
    });

    render(<RobotPerformanceAnalytics robotId={1} lastNCycles={10} />);

    await waitFor(() => {
      expect(screen.getByText('Performance Summary (Last 10 Cycles)')).toBeInTheDocument();
    });

    // Should show zero values
    expect(screen.getByText('0.0%')).toBeInTheDocument(); // Win rate
  });
});
