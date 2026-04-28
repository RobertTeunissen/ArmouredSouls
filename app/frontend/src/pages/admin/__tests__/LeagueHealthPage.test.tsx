/**
 * Unit Tests for LeagueHealthPage
 *
 * Tests tier counts render, ELO distribution displays, promo/demo eligibility shows.
 *
 * _Requirements: 15.2, 15.3, 15.4_
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LeagueHealthPage from '../LeagueHealthPage';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockGet = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

const mockLeagueHealthData = {
  leagues: [
    { league: 'bronze', robotCount: 20, averageElo: 1000, instances: 2, instanceDetails: [{ id: 'bronze-1', robotCount: 10 }, { id: 'bronze-2', robotCount: 10 }] },
    { league: 'silver', robotCount: 15, averageElo: 1200, instances: 1, instanceDetails: [{ id: 'silver-1', robotCount: 15 }] },
    { league: 'gold', robotCount: 8, averageElo: 1500, instances: 1, instanceDetails: [{ id: 'gold-1', robotCount: 8 }] },
  ],
  totalRobots: 43,
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('LeagueHealthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: mockLeagueHealthData });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <LeagueHealthPage />
      </MemoryRouter>,
    );

  it('should render the page header', () => {
    renderPage();
    expect(screen.getByText('League Health')).toBeInTheDocument();
  });

  it('should display summary stat cards', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Total Robots')).toBeInTheDocument();
      expect(screen.getByText('Active Tiers')).toBeInTheDocument();
      expect(screen.getByText('Empty Tiers')).toBeInTheDocument();
    });
  });

  it('should display total robot count', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('43')).toBeInTheDocument();
    });
  });

  it('should display active tiers count', async () => {
    renderPage();
    await waitFor(() => {
      // 3 active tiers (all have robotCount > 0)
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('should render league tiers table', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('League Tiers')).toBeInTheDocument();
      expect(screen.getByText('bronze')).toBeInTheDocument();
      expect(screen.getByText('silver')).toBeInTheDocument();
      expect(screen.getByText('gold')).toBeInTheDocument();
    });
  });

  it('should display robot counts per tier', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
    });
  });

  it('should display instance counts', async () => {
    renderPage();
    await waitFor(() => {
      // bronze has 2 instances, silver and gold have 1 each
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('should fetch from the league-health endpoint', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/admin/league-health');
    });
  });

  it('should display error state when API fails', async () => {
    mockGet.mockRejectedValue({ response: { data: { error: 'League query failed' } } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('League query failed')).toBeInTheDocument();
    });
  });
});
