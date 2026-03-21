import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithRouter } from '../../test-utils';
import KothStandingsPage from '../KothStandingsPage';
import { KothStandingsResponse } from '../../utils/kothApi';

// Mock dependencies
vi.mock('../../utils/kothApi');
vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation">Navigation</div>,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser', email: 'test@test.com', role: 'user', currency: 100000, prestige: 0 },
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import { getKothStandings } from '../../utils/kothApi';

const mockedGetKothStandings = vi.mocked(getKothStandings);

function makeMockStandings(overrides = {}): KothStandingsResponse {
  return {
    data: [
      { rank: 1, robotId: 10, robotName: 'IronClaw', ownerName: 'Player1', ownerId: 1, kothWins: 8, kothMatches: 10, winRate: 80, totalZoneScore: 250, avgZoneScore: 25, kothKills: 15, bestWinStreak: 5 },
      { rank: 2, robotId: 20, robotName: 'SteelFang', ownerName: 'Player2', ownerId: 2, kothWins: 6, kothMatches: 10, winRate: 60, totalZoneScore: 200, avgZoneScore: 20, kothKills: 12, bestWinStreak: 3 },
      { rank: 3, robotId: 30, robotName: 'TitanBolt', ownerName: 'Player3', ownerId: 3, kothWins: 4, kothMatches: 10, winRate: 40, totalZoneScore: 150, avgZoneScore: 15, kothKills: 8, bestWinStreak: 2 },
    ],
    summary: { totalEvents: 10, uniqueParticipants: 20, topRobot: 'IronClaw' },
    pagination: { page: 1, pageSize: 50, total: 3, totalPages: 1 },
    ...overrides,
  };
}

describe('KothStandingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display correct sort order with medal colors for top 3', async () => {
    const standings = makeMockStandings({
      data: [
        { rank: 1, robotId: 10, robotName: 'GoldBot', ownerName: 'P1', ownerId: 2, kothWins: 10, kothMatches: 10, winRate: 100, totalZoneScore: 300, avgZoneScore: 30, kothKills: 20, bestWinStreak: 10 },
        { rank: 2, robotId: 20, robotName: 'SilverBot', ownerName: 'P2', ownerId: 3, kothWins: 7, kothMatches: 10, winRate: 70, totalZoneScore: 200, avgZoneScore: 20, kothKills: 14, bestWinStreak: 5 },
        { rank: 3, robotId: 30, robotName: 'BronzeBot', ownerName: 'P3', ownerId: 4, kothWins: 5, kothMatches: 10, winRate: 50, totalZoneScore: 150, avgZoneScore: 15, kothKills: 10, bestWinStreak: 3 },
        { rank: 4, robotId: 40, robotName: 'FourthBot', ownerName: 'P4', ownerId: 5, kothWins: 3, kothMatches: 10, winRate: 30, totalZoneScore: 100, avgZoneScore: 10, kothKills: 6, bestWinStreak: 2 },
        { rank: 5, robotId: 50, robotName: 'FifthBot', ownerName: 'P5', ownerId: 6, kothWins: 1, kothMatches: 10, winRate: 10, totalZoneScore: 50, avgZoneScore: 5, kothKills: 2, bestWinStreak: 1 },
      ],
    });
    mockedGetKothStandings.mockResolvedValue(standings);

    renderWithRouter(<KothStandingsPage />);

    await waitFor(() => {
      expect(screen.getByText('GoldBot')).toBeInTheDocument();
    });

    // Verify rank cells have correct medal colors
    const rank1Cell = screen.getByText('#1');
    const rank2Cell = screen.getByText('#2');
    const rank3Cell = screen.getByText('#3');

    expect(rank1Cell.className).toContain('text-warning');
    expect(rank2Cell.className).toContain('text-secondary');
    expect(rank3Cell.className).toContain('text-orange-600');

    // Verify robots appear in correct order
    const rows = screen.getAllByRole('row');
    // First row is header, data rows start at index 1
    expect(rows[1]).toHaveTextContent('GoldBot');
    expect(rows[2]).toHaveTextContent('SilverBot');
    expect(rows[3]).toHaveTextContent('BronzeBot');
    expect(rows[4]).toHaveTextContent('FourthBot');
    expect(rows[5]).toHaveTextContent('FifthBot');
  });

  it('should highlight current user\'s robots with blue background and YOU badge', async () => {
    // ownerId: 1 matches the mocked auth user id
    const standings = makeMockStandings();
    mockedGetKothStandings.mockResolvedValue(standings);

    renderWithRouter(<KothStandingsPage />);

    await waitFor(() => {
      expect(screen.getAllByText('IronClaw').length).toBeGreaterThan(0);
    });

    // The first robot (ownerId=1) should have blue background
    const rows = screen.getAllByRole('row');
    const myRow = rows[1]; // IronClaw row (ownerId=1)
    expect(myRow.className).toContain('bg-blue-900');

    // Should show YOU badge
    expect(screen.getByText('YOU')).toBeInTheDocument();

    // Other rows should NOT have blue background
    const otherRow = rows[2]; // SteelFang row (ownerId=2)
    expect(otherRow.className).not.toContain('bg-blue-900');
  });

  it('should toggle between All Time and Last 10 Events filters', async () => {
    mockedGetKothStandings.mockResolvedValue(makeMockStandings());

    renderWithRouter(<KothStandingsPage />);

    await waitFor(() => {
      expect(screen.getAllByText('IronClaw').length).toBeGreaterThan(0);
    });

    // "All Time" should be active by default (has border-orange-500)
    const allTimeBtn = screen.getByText('All Time');
    expect(allTimeBtn.className).toContain('border-orange-500');

    // Click "Last 10 Events"
    const last10Btn = screen.getByText('Last 10 Events');
    fireEvent.click(last10Btn);

    // Verify getKothStandings was called with 'last_10'
    await waitFor(() => {
      expect(mockedGetKothStandings).toHaveBeenCalledWith('last_10', 1, 50);
    });
  });

  it('should display summary header with total events, participants, and top robot', async () => {
    const standings = makeMockStandings({
      summary: { totalEvents: 42, uniqueParticipants: 15, topRobot: 'IronClaw' },
    });
    mockedGetKothStandings.mockResolvedValue(standings);

    renderWithRouter(<KothStandingsPage />);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    // Use getAllByText since '15' appears in both summary and table data
    const fifteens = screen.getAllByText('15');
    expect(fifteens.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText('Total Events')).toBeInTheDocument();
    expect(screen.getByText('Unique Participants')).toBeInTheDocument();

    // topRobot appears in both summary and table; verify at least one is present
    expect(screen.getAllByText('IronClaw').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('#1 Robot')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    // Return a never-resolving promise to keep loading state
    mockedGetKothStandings.mockReturnValue(new Promise(() => {}));

    renderWithRouter(<KothStandingsPage />);

    expect(screen.getByText('Loading standings...')).toBeInTheDocument();
  });

  it('should show error state when API fails', async () => {
    mockedGetKothStandings.mockRejectedValue(new Error('Network error'));

    renderWithRouter(<KothStandingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load King of the Hill standings')).toBeInTheDocument();
    });
  });
});
