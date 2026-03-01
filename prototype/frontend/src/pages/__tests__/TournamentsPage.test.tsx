import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TournamentsPage from '../TournamentsPage';

// Mock dependencies
vi.mock('../../utils/tournamentApi', () => ({
  listTournaments: vi.fn(),
  getTournamentDetails: vi.fn(),
}));

vi.mock('../../utils/robotApi', () => ({
  fetchMyRobots: vi.fn(),
}));

vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation">Navigation</div>,
}));

const mockLogout = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser' },
    logout: mockLogout,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { listTournaments, getTournamentDetails } from '../../utils/tournamentApi';
import { fetchMyRobots } from '../../utils/robotApi';

const mockedListTournaments = vi.mocked(listTournaments);
const mockedGetDetails = vi.mocked(getTournamentDetails);
const mockedFetchMyRobots = vi.mocked(fetchMyRobots);

const mockTournaments = [
  {
    id: 1,
    name: 'Grand Arena Championship',
    type: 'single_elimination',
    status: 'active' as const,
    currentRound: 3,
    maxRounds: 7,
    totalParticipants: 128,
    winnerId: null,
    startedAt: '2026-02-01T00:00:00Z',
    completedAt: null,
    createdAt: '2026-01-30T00:00:00Z',
  },
  {
    id: 2,
    name: 'Rookie Rumble',
    type: 'single_elimination',
    status: 'completed' as const,
    currentRound: 5,
    maxRounds: 5,
    totalParticipants: 32,
    winnerId: 10,
    startedAt: '2026-01-15T00:00:00Z',
    completedAt: '2026-01-20T00:00:00Z',
    createdAt: '2026-01-14T00:00:00Z',
  },
];

const mockMyRobots = [
  { id: 5, name: 'Iron Fist', elo: 1450 },
  { id: 12, name: 'Steel Thunder', elo: 1380 },
];

const mockTournamentDetails = {
  tournament: {
    ...mockTournaments[0],
    matches: [
      {
        id: 101,
        tournamentId: 1,
        round: 3,
        matchNumber: 1,
        robot1Id: 5,
        robot2Id: 20,
        winnerId: null,
        battleId: null,
        status: 'pending',
        isByeMatch: false,
        completedAt: null,
        robot1: { id: 5, name: 'Iron Fist', elo: 1450, currentHP: 850, maxHP: 1000 },
        robot2: { id: 20, name: 'Enemy Bot', elo: 1400, currentHP: 900, maxHP: 1000 },
      },
      {
        id: 102,
        tournamentId: 1,
        round: 3,
        matchNumber: 2,
        robot1Id: 30,
        robot2Id: 40,
        winnerId: null,
        battleId: null,
        status: 'pending',
        isByeMatch: false,
        completedAt: null,
        robot1: { id: 30, name: 'Alpha Strike', elo: 1500, currentHP: 1000, maxHP: 1000 },
        robot2: { id: 40, name: 'Beta Crusher', elo: 1350, currentHP: 800, maxHP: 1000 },
      },
    ],
    currentRoundMatches: [
      {
        id: 101,
        tournamentId: 1,
        round: 3,
        matchNumber: 1,
        robot1Id: 5,
        robot2Id: 20,
        winnerId: null,
        battleId: null,
        status: 'pending',
        isByeMatch: false,
        completedAt: null,
        robot1: { id: 5, name: 'Iron Fist', elo: 1450, currentHP: 850, maxHP: 1000 },
        robot2: { id: 20, name: 'Enemy Bot', elo: 1400, currentHP: 900, maxHP: 1000 },
      },
      {
        id: 102,
        tournamentId: 1,
        round: 3,
        matchNumber: 2,
        robot1Id: 30,
        robot2Id: 40,
        winnerId: null,
        battleId: null,
        status: 'pending',
        isByeMatch: false,
        completedAt: null,
        robot1: { id: 30, name: 'Alpha Strike', elo: 1500, currentHP: 1000, maxHP: 1000 },
        robot2: { id: 40, name: 'Beta Crusher', elo: 1350, currentHP: 800, maxHP: 1000 },
      },
    ],
    participantCount: 128,
  },
};

describe('TournamentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock localStorage.getItem to return a token when asked
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedFetchMyRobots.mockResolvedValue(mockMyRobots as any);
    mockedListTournaments.mockResolvedValue({ tournaments: mockTournaments });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedGetDetails.mockResolvedValue(mockTournamentDetails as any);
  });

  const renderPage = () => render(<BrowserRouter><TournamentsPage /></BrowserRouter>);

  it('should display tournament list after loading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Grand Arena Championship')).toBeInTheDocument();
      expect(screen.getByText('Rookie Rumble')).toBeInTheDocument();
    });
  });

  it('should fetch user robots on mount for filtering', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockedFetchMyRobots).toHaveBeenCalled();
    });
  });

  it('should show tournament details when View Tournament Details is clicked', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Grand Arena Championship')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByText('View Tournament Details');
    fireEvent.click(viewButtons[0]);

    await waitFor(() => {
      expect(mockedGetDetails).toHaveBeenCalledWith(expect.any(String), 1);
    });
  });

  describe('Show only my robots filter', () => {
    it('should filter matches to only show user robots when checked', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Grand Arena Championship')).toBeInTheDocument();
      });

      // Open tournament details
      const viewButtons = screen.getAllByText('View Tournament Details');
      fireEvent.click(viewButtons[0]);

      // Wait for details modal to load with match data
      await waitFor(() => {
        expect(screen.getByText('Enemy Bot')).toBeInTheDocument();
      });

      // Both matches should be visible initially
      expect(screen.getByText('Alpha Strike')).toBeInTheDocument();

      // Toggle "Show only my robots"
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      await waitFor(() => {
        // Only the match with user's robot (Iron Fist, id=5) should remain
        expect(screen.getByText('Enemy Bot')).toBeInTheDocument();
        expect(screen.queryByText('Alpha Strike')).not.toBeInTheDocument();
      });
    });

    it('should show all matches again when filter is unchecked', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Grand Arena Championship')).toBeInTheDocument();
      });

      const viewButtons = screen.getAllByText('View Tournament Details');
      fireEvent.click(viewButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Enemy Bot')).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox');

      // Check then uncheck
      fireEvent.click(checkbox);
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(screen.getByText('Enemy Bot')).toBeInTheDocument();
        expect(screen.getByText('Alpha Strike')).toBeInTheDocument();
      });
    });

    it('should show empty state when filter is on but no user robots in matches', async () => {
      // Override with no user robots
      mockedFetchMyRobots.mockResolvedValue([]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Grand Arena Championship')).toBeInTheDocument();
      });

      const viewButtons = screen.getAllByText('View Tournament Details');
      fireEvent.click(viewButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Enemy Bot')).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      await waitFor(() => {
        // No matches should be visible
        expect(screen.queryByText('Enemy Bot')).not.toBeInTheDocument();
        expect(screen.queryByText('Alpha Strike')).not.toBeInTheDocument();
      });
    });
  });

  it('should display error when tournament fetch fails', async () => {
    mockedListTournaments.mockRejectedValue({ response: { status: 500 } });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Failed to load tournaments/)).toBeInTheDocument();
    });
  });
});
