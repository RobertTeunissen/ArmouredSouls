/**
 * Unit Tests for PlayerEngagementPage
 *
 * Tests login recency displays, activity indicators render, churn risk
 * classification shows, sorting and filtering work.
 *
 * _Requirements: 13.2, 13.3, 13.4, 13.5_
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlayerEngagementPage from '../PlayerEngagementPage';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockGet = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

const mockEngagementResponse = {
  players: [
    {
      userId: 1,
      username: 'alice',
      stableName: 'Alpha Stable',
      currency: 50000,
      lastLoginAt: '2026-04-18T10:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
      onboardingComplete: true,
      robotCount: 3,
      totalBattles: 20,
      totalWins: 12,
      winRate: 60,
      churnRisk: 'low',
    },
    {
      userId: 2,
      username: 'bob',
      stableName: null,
      currency: 10000,
      lastLoginAt: '2026-04-10T10:00:00Z',
      createdAt: '2026-02-01T00:00:00Z',
      onboardingComplete: false,
      robotCount: 1,
      totalBattles: 5,
      totalWins: 1,
      winRate: 20,
      churnRisk: 'high',
    },
    {
      userId: 3,
      username: 'charlie',
      stableName: 'Gamma Stable',
      currency: 30000,
      lastLoginAt: null,
      createdAt: '2026-03-01T00:00:00Z',
      onboardingComplete: true,
      robotCount: 2,
      totalBattles: 0,
      totalWins: 0,
      winRate: 0,
      churnRisk: 'high',
    },
  ],
  total: 3,
  page: 1,
  pageSize: 25,
  totalPages: 1,
  timestamp: '2026-04-20T12:00:00Z',
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('PlayerEngagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: mockEngagementResponse });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <PlayerEngagementPage />
      </MemoryRouter>,
    );

  it('should render the page header', async () => {
    renderPage();
    expect(screen.getByText('Player Engagement')).toBeInTheDocument();
  });

  it('should render summary stat cards', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Total Players')).toBeInTheDocument();
      expect(screen.getByText('High Risk')).toBeInTheDocument();
      expect(screen.getByText('Medium Risk')).toBeInTheDocument();
      expect(screen.getByText('Low Risk')).toBeInTheDocument();
    });
  });

  it('should display player usernames in the table', async () => {
    renderPage();
    await waitFor(() => {
      // alice shows as "Alpha Stable" (stableName), bob shows as "bob" (no stableName)
      expect(screen.getByText('Alpha Stable')).toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
      expect(screen.getByText('Gamma Stable')).toBeInTheDocument();
    });
  });

  it('should display login recency with "Never" for null lastLoginAt', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Never')).toBeInTheDocument();
    });
  });

  it('should display churn risk badges', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('LOW')).toBeInTheDocument();
      // Two HIGH risk players
      const highElements = screen.getAllByText('HIGH');
      expect(highElements.length).toBe(2);
    });
  });

  it('should display onboarding status', async () => {
    renderPage();
    await waitFor(() => {
      // alice and charlie have onboardingComplete: true
      const doneElements = screen.getAllByText('✓ Done');
      expect(doneElements.length).toBe(2);
      // bob has onboardingComplete: false
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });
  });

  it('should render user filter chips', async () => {
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

    fireEvent.click(screen.getByText('Auto-Generated'));

    await waitFor(() => {
      const lastCall = mockGet.mock.calls[mockGet.mock.calls.length - 1][0] as string;
      expect(lastCall).toContain('filter=auto');
    });
  });

  it('should display error state when API fails', async () => {
    mockGet.mockRejectedValue({ response: { data: { error: 'Server error' } } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('should fetch data on mount with default parameters', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/engagement/players'),
      );
      const url = mockGet.mock.calls[0][0] as string;
      expect(url).toContain('filter=real');
    });
  });
});
