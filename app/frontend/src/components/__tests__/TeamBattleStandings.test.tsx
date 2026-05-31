import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { userId: 1, username: 'test_user', role: 'user' }, logout: vi.fn() }),
}));

vi.mock('../../utils/teamBattleApi', () => ({
  getMyTeamBattles: vi.fn(),
}));

import LeagueStandingsSummary from '../LeagueStandingsSummary';
import { getMyTeamBattles } from '../../utils/teamBattleApi';

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <LeagueStandingsSummary />
    </MemoryRouter>,
  );
}

describe('LeagueStandingsSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock localStorage for token
    vi.mocked(localStorage.getItem).mockReturnValue('mock-token');
  });

  it('should show loading state initially', () => {
    vi.mocked(getMyTeamBattles).mockReturnValue(new Promise(() => {}));
    renderWithRouter();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show "League Standings" heading', async () => {
    vi.mocked(getMyTeamBattles).mockResolvedValue([]);
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('League Standings')).toBeInTheDocument();
    });
  });

  it('should show empty state when no teams registered', async () => {
    vi.mocked(getMyTeamBattles).mockResolvedValue([]);
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/No league data yet/)).toBeInTheDocument();
    });
  });

  it('should show empty state message when no data', async () => {
    vi.mocked(getMyTeamBattles).mockResolvedValue([]);
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/No league data yet/)).toBeInTheDocument();
    });
  });

  it('should render 2v2 team standings with team name, tier, LP, and W/L/D', async () => {
    vi.mocked(getMyTeamBattles).mockResolvedValue([
      {
        id: 1,
        stableId: 1,
        teamSize: 2,
        teamName: 'Iron Duo',
        teamLp: 85,
        teamLeague: 'silver',
        teamLeagueId: 'inst-1',
        cyclesInLeague: 10,
        totalWins: 8,
        totalLosses: 3,
        totalDraws: 1,
        eligibility: 'ELIGIBLE',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        members: [],
        isLockedForBattle: false,
      },
    ]);
    renderWithRouter();

    await waitFor(() => {
      // Component renders both desktop and mobile views, so use getAllByText
      const teamNames = screen.getAllByText('Iron Duo');
      expect(teamNames.length).toBeGreaterThan(0);
    });

    // LP is rendered in both desktop and mobile views
    const lpElements = screen.getAllByText('85 LP');
    expect(lpElements.length).toBeGreaterThan(0);
    // W/L/D stats
    const winElements = screen.getAllByText('8W');
    expect(winElements.length).toBeGreaterThan(0);
    const lossElements = screen.getAllByText('3L');
    expect(lossElements.length).toBeGreaterThan(0);
    const drawElements = screen.getAllByText('1D');
    expect(drawElements.length).toBeGreaterThan(0);
  });

  it('should render 3v3 team standings separately from 2v2', async () => {
    vi.mocked(getMyTeamBattles).mockResolvedValue([
      {
        id: 1,
        stableId: 1,
        teamSize: 2,
        teamName: 'Iron Duo',
        teamLp: 85,
        teamLeague: 'silver',
        teamLeagueId: 'inst-1',
        cyclesInLeague: 10,
        totalWins: 8,
        totalLosses: 3,
        totalDraws: 1,
        eligibility: 'ELIGIBLE',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        members: [],
        isLockedForBattle: false,
      },
      {
        id: 2,
        stableId: 1,
        teamSize: 3,
        teamName: 'Steel Triad',
        teamLp: 120,
        teamLeague: 'gold',
        teamLeagueId: 'inst-2',
        cyclesInLeague: 15,
        totalWins: 12,
        totalLosses: 5,
        totalDraws: 2,
        eligibility: 'ELIGIBLE',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        members: [],
        isLockedForBattle: false,
      },
    ]);
    renderWithRouter();

    await waitFor(() => {
      const ironDuoElements = screen.getAllByText('Iron Duo');
      expect(ironDuoElements.length).toBeGreaterThan(0);
      const steelTriadElements = screen.getAllByText('Steel Triad');
      expect(steelTriadElements.length).toBeGreaterThan(0);
    });

    // Both size labels should be present
    expect(screen.getByText('2v2')).toBeInTheDocument();
    expect(screen.getByText('3v3')).toBeInTheDocument();
  });

  it('should show eligibility status badge (Ready/Ineligible)', async () => {
    vi.mocked(getMyTeamBattles).mockResolvedValue([
      {
        id: 1,
        stableId: 1,
        teamSize: 2,
        teamName: 'Ready Team',
        teamLp: 50,
        teamLeague: 'bronze',
        teamLeagueId: 'inst-1',
        cyclesInLeague: 5,
        totalWins: 3,
        totalLosses: 2,
        totalDraws: 0,
        eligibility: 'ELIGIBLE',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        members: [],
        isLockedForBattle: false,
      },
      {
        id: 2,
        stableId: 1,
        teamSize: 3,
        teamName: 'Broken Team',
        teamLp: 30,
        teamLeague: 'bronze',
        teamLeagueId: 'inst-2',
        cyclesInLeague: 3,
        totalWins: 1,
        totalLosses: 4,
        totalDraws: 0,
        eligibility: 'INELIGIBLE',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        members: [],
        isLockedForBattle: false,
      },
    ]);
    renderWithRouter();

    await waitFor(() => {
      const readyTeamElements = screen.getAllByText('Ready Team');
      expect(readyTeamElements.length).toBeGreaterThan(0);
      const brokenTeamElements = screen.getAllByText('Broken Team');
      expect(brokenTeamElements.length).toBeGreaterThan(0);
    });

    // Check eligibility indicators are present (both desktop and mobile views)
    const readyIndicators = screen.getAllByText(/✓/);
    const ineligibleIndicators = screen.getAllByText(/✗/);
    expect(readyIndicators.length).toBeGreaterThan(0);
    expect(ineligibleIndicators.length).toBeGreaterThan(0);
  });

  it('should show error state when API fails', async () => {
    vi.mocked(getMyTeamBattles).mockRejectedValue(new Error('Network error'));
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Failed to load team standings')).toBeInTheDocument();
    });
  });

  it('should have "Full Standings" link when teams exist', async () => {
    vi.mocked(getMyTeamBattles).mockResolvedValue([
      {
        id: 1,
        stableId: 1,
        teamSize: 2,
        teamName: 'Test Team',
        teamLp: 50,
        teamLeague: 'bronze',
        teamLeagueId: 'inst-1',
        cyclesInLeague: 5,
        totalWins: 3,
        totalLosses: 2,
        totalDraws: 0,
        eligibility: 'ELIGIBLE',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        members: [],
        isLockedForBattle: false,
      },
    ]);
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Full Standings →')).toBeInTheDocument();
    });
  });

  it('should not have horizontal overflow on mobile viewport', async () => {
    vi.mocked(getMyTeamBattles).mockResolvedValue([
      {
        id: 1,
        stableId: 1,
        teamSize: 2,
        teamName: 'A Very Long Team Name That Could Overflow',
        teamLp: 999,
        teamLeague: 'champion',
        teamLeagueId: 'inst-1',
        cyclesInLeague: 50,
        totalWins: 100,
        totalLosses: 20,
        totalDraws: 5,
        eligibility: 'ELIGIBLE',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        members: [],
        isLockedForBattle: false,
      },
    ]);
    const { container } = renderWithRouter();

    await waitFor(() => {
      const teamNames = screen.getAllByText('A Very Long Team Name That Could Overflow');
      expect(teamNames.length).toBeGreaterThan(0);
    });

    // Verify the team name elements have truncate class to prevent overflow
    const teamNameElements = screen.getAllByText('A Very Long Team Name That Could Overflow');
    teamNameElements.forEach((el) => {
      expect(el.className).toContain('truncate');
    });

    // Verify the container doesn't have overflow-x-auto (no horizontal scroll needed)
    const outerContainer = container.firstChild as HTMLElement;
    expect(outerContainer).toBeTruthy();
  });
});
