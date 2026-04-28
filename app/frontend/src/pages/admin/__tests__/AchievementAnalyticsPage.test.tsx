/**
 * Unit Tests for AchievementAnalyticsPage
 *
 * Tests unlock rates display, difficulty flags render, rarity accuracy shows,
 * user filter works.
 *
 * _Requirements: 17.2, 17.3, 17.4, 17.5_
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AchievementAnalyticsPage from '../AchievementAnalyticsPage';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockGet = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

const mockAchievementData = {
  achievements: [
    {
      achievementId: 'C1',
      unlockCount: 15,
      unlockRate: 75,
    },
    {
      achievementId: 'C2',
      unlockCount: 19,
      unlockRate: 95,
    },
    {
      achievementId: 'L1',
      unlockCount: 0,
      unlockRate: 0,
    },
  ],
  totalUnlocks: 34,
  uniquePlayersWithAchievements: 15,
  totalUsers: 20,
  participationRate: 75,
  timestamp: '2026-04-20T12:00:00Z',
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('AchievementAnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: mockAchievementData });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <AchievementAnalyticsPage />
      </MemoryRouter>,
    );

  it('should render the page header', () => {
    renderPage();
    expect(screen.getByText('Achievement Analytics')).toBeInTheDocument();
  });

  it('should display summary stat cards', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Total Unlocks')).toBeInTheDocument();
      expect(screen.getByText('Participation')).toBeInTheDocument();
      expect(screen.getByText('Never Unlocked')).toBeInTheDocument();
      expect(screen.getByText('High Unlock (>90%)')).toBeInTheDocument();
    });
  });

  it('should display achievement IDs in the table', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('C1')).toBeInTheDocument();
      expect(screen.getByText('C2')).toBeInTheDocument();
      expect(screen.getByText('L1')).toBeInTheDocument();
    });
  });

  it('should display unlock rates as percentages', async () => {
    renderPage();
    await waitFor(() => {
      // 75% appears in both the Participation stat card and the table
      const seventyFive = screen.getAllByText('75%');
      expect(seventyFive.length).toBeGreaterThanOrEqual(1);
      const ninetyFive = screen.getAllByText('95%');
      expect(ninetyFive.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  it('should display unlock counts', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('19')).toBeInTheDocument();
    });
  });

  it('should display participation info', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/15 of 20 players have unlocked at least one achievement/)).toBeInTheDocument();
    });
  });

  it('should render user filter chips', () => {
    renderPage();
    expect(screen.getByText('Real Players')).toBeInTheDocument();
    expect(screen.getByText('Auto-Generated')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('should fetch with filter parameter when filter is toggled', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('All'));

    await waitFor(() => {
      const lastCall = mockGet.mock.calls[mockGet.mock.calls.length - 1][0] as string;
      expect(lastCall).toContain('filter=all');
    });
  });

  it('should display error state when API fails', async () => {
    mockGet.mockRejectedValue({ response: { data: { error: 'Achievement service error' } } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Achievement service error')).toBeInTheDocument();
    });
  });
});
