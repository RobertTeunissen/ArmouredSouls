/**
 * Unit Tests for LeagueHealthPage
 *
 * Tests tier counts render, ELO distribution displays, promo/demo eligibility shows.
 * Tests 2v2 and 3v3 league health sections render with team counts, avg ELO, and rebalancing indicators.
 * Tests tag team league health section renders with team counts, distribution, and rebalancing indicators.
 *
 * _Requirements: 15.2, 15.3, 15.4, R11.6, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_
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

const mockTeamBattleLeagueHealthData = {
  league2v2: {
    leagues: [
      { league: 'bronze', teamCount: 10, averageElo: 2000, instances: 1, instanceDetails: [{ id: 'bronze_1', teamCount: 10 }], needsRebalancing: false },
      { league: 'silver', teamCount: 6, averageElo: 2400, instances: 1, instanceDetails: [{ id: 'silver_1', teamCount: 6 }], needsRebalancing: false },
      { league: 'gold', teamCount: 0, averageElo: 0, instances: 0, instanceDetails: [], needsRebalancing: false },
    ],
    totalTeams: 16,
  },
  league3v3: {
    leagues: [
      { league: 'bronze', teamCount: 8, averageElo: 3000, instances: 1, instanceDetails: [{ id: 'bronze_1', teamCount: 8 }], needsRebalancing: false },
      { league: 'silver', teamCount: 4, averageElo: 3600, instances: 1, instanceDetails: [{ id: 'silver_1', teamCount: 4 }], needsRebalancing: true },
      { league: 'gold', teamCount: 0, averageElo: 0, instances: 0, instanceDetails: [], needsRebalancing: false },
    ],
    totalTeams: 12,
  },
};

const mockTagTeamLeagueHealthData = {
  leagues: [
    { league: 'bronze', teamCount: 12, instances: 1, instanceDetails: [{ id: 'bronze_1', teamCount: 12 }], teamsPerInstance: { min: 12, max: 12, avg: 12 }, needsRebalancing: false },
    { league: 'silver', teamCount: 5, instances: 1, instanceDetails: [{ id: 'silver_1', teamCount: 5 }], teamsPerInstance: { min: 5, max: 5, avg: 5 }, needsRebalancing: true },
    { league: 'gold', teamCount: 0, instances: 0, instanceDetails: [], teamsPerInstance: { min: 0, max: 0, avg: 0 }, needsRebalancing: false },
  ],
  totalTeams: 17,
  timestamp: '2026-06-01T00:00:00.000Z',
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('LeagueHealthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/admin/league-health') {
        return Promise.resolve({ data: mockLeagueHealthData });
      }
      if (url === '/api/admin/team-battle-league-health') {
        return Promise.resolve({ data: mockTeamBattleLeagueHealthData });
      }
      if (url === '/api/admin/tag-team-league-health') {
        return Promise.resolve({ data: mockTagTeamLeagueHealthData });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
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

  it('should render 1v1 league tiers table', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('1v1 League Tiers')).toBeInTheDocument();
    });
  });

  it('should display robot counts per tier', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('20')).toBeInTheDocument();
    });
  });

  it('should display instance counts', async () => {
    renderPage();
    await waitFor(() => {
      // bronze has 2 instances — verify in the 1v1 table context
      // The "2" text appears in multiple places now, so check the table has the value
      const tables = screen.getAllByRole('table');
      expect(tables.length).toBeGreaterThanOrEqual(1);
      // The first table (1v1) should contain "2" for bronze instances
      expect(tables[0].textContent).toContain('2');
    });
  });

  it('should fetch from all league-health endpoints', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/admin/league-health');
      expect(mockGet).toHaveBeenCalledWith('/api/admin/team-battle-league-health');
      expect(mockGet).toHaveBeenCalledWith('/api/admin/tag-team-league-health');
    });
  });

  it('should display error state when API fails', async () => {
    mockGet.mockRejectedValue({ response: { data: { error: 'League query failed' } } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('League query failed')).toBeInTheDocument();
    });
  });

  // 2v2 League section tests
  it('should render 2v2 League section', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('2v2 League Tiers')).toBeInTheDocument();
      expect(screen.getByTestId('league-health-2v2')).toBeInTheDocument();
    });
  });

  it('should display 2v2 total teams count', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('16')).toBeInTheDocument();
    });
  });

  // 3v3 League section tests
  it('should render 3v3 League section', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('3v3 League Tiers')).toBeInTheDocument();
      expect(screen.getByTestId('league-health-3v3')).toBeInTheDocument();
    });
  });

  it('should display 3v3 total teams count', async () => {
    renderPage();
    await waitFor(() => {
      const section3v3 = screen.getByTestId('league-health-3v3');
      // 3v3 total teams = 12
      expect(section3v3.textContent).toContain('12');
    });
  });

  it('should show needs-rebalancing indicator for 3v3 silver tier', async () => {
    renderPage();
    await waitFor(() => {
      const section3v3 = screen.getByTestId('league-health-3v3');
      // The 3v3 silver tier has needsRebalancing: true, so there should be a warning indicator
      expect(section3v3.querySelector('.text-yellow-400')).toBeInTheDocument();
    });
  });

  it('should show balanced indicator for 2v2 tiers', async () => {
    renderPage();
    await waitFor(() => {
      const section2v2 = screen.getByTestId('league-health-2v2');
      // All 2v2 tiers have needsRebalancing: false, so no warning indicators
      expect(section2v2.querySelector('.text-yellow-400')).not.toBeInTheDocument();
    });
  });

  it('should display "Total Teams" stat cards for 2v2, 3v3, and tag team', async () => {
    renderPage();
    await waitFor(() => {
      const totalTeamsLabels = screen.getAllByText('Total Teams');
      expect(totalTeamsLabels).toHaveLength(3); // One for 2v2, one for 3v3, one for tag team
    });
  });

  it('should display "Needs Rebalancing" stat cards for 2v2, 3v3, and tag team', async () => {
    renderPage();
    await waitFor(() => {
      const rebalancingLabels = screen.getAllByText('Needs Rebalancing');
      expect(rebalancingLabels).toHaveLength(3); // One for 2v2, one for 3v3, one for tag team
    });
  });

  // Tag Team League section tests
  it('should render Tag Team League section', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Tag Team League Tiers')).toBeInTheDocument();
      expect(screen.getByTestId('league-health-tag-team')).toBeInTheDocument();
    });
  });

  it('should display tag team total teams count', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('17')).toBeInTheDocument();
    });
  });

  it('should show needs-rebalancing indicator for tag team silver tier', async () => {
    renderPage();
    await waitFor(() => {
      const sectionTagTeam = screen.getByTestId('league-health-tag-team');
      // The tag team silver tier has needsRebalancing: true, so there should be a warning indicator
      expect(sectionTagTeam.querySelector('.text-yellow-400')).toBeInTheDocument();
    });
  });

  it('should display distribution column (min/max/avg) in tag team section', async () => {
    renderPage();
    await waitFor(() => {
      const sectionTagTeam = screen.getByTestId('league-health-tag-team');
      // Bronze tier: min 12, max 12, avg 12
      expect(sectionTagTeam.textContent).toContain('12/12/12');
      // Silver tier: min 5, max 5, avg 5
      expect(sectionTagTeam.textContent).toContain('5/5/5');
    });
  });

  it('should fetch from tag-team-league-health endpoint on page load', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/admin/tag-team-league-health');
    });
  });
});
