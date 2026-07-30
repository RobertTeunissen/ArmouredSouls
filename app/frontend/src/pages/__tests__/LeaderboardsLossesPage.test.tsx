import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeaderboardsLossesPage from '../LeaderboardsLossesPage';

const mockGet = vi.fn();

vi.mock('../../utils/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1 } }),
}));

vi.mock('../../components/Navigation', () => ({
  default: () => <nav data-testid="nav" />,
}));

vi.mock('../../components/OwnerNameLink', () => ({
  default: ({ displayName }: { displayName: string }) => <span>{displayName}</span>,
}));

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    rank: 1,
    robotId: 10,
    robotName: 'Crusher',
    totalLosses: 21,
    killsByMode: {
      league_1v1: 4,
      league_2v2: 0,
      league_3v3: 0,
      tag_team: 2,
      koth: 15,
      grand_melee: 0,
      tournament_1v1: 0,
      tournament_2v2: 0,
      tournament_3v3: 0,
    },
    stableId: 1,
    stableName: 'Test Stable',
    elo: 1300,
    totalBattles: 30,
    wins: 18,
    losses: 10,
    draws: 2,
    winRate: 60,
    lossRatio: 2.1,
    damageDealtLifetime: 5000,
    ...overrides,
  };
}

function response(sortBy = 'total') {
  return {
    leaderboard: [makeEntry()],
    pagination: { page: 1, limit: 100, totalRobots: 1, totalPages: 1, hasMore: false },
    sortBy,
    timestamp: new Date().toISOString(),
  };
}

describe('LeaderboardsLossesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(response());
  });

  it('should request the all-type total ranking by default', async () => {
    render(<LeaderboardsLossesPage />);

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(mockGet).toHaveBeenCalledWith(
      '/api/leaderboards/losses',
      { params: { page: 1, limit: 100, sortBy: 'total' } },
    );
  });

  it('should render the total and a column value for every battle type', async () => {
    render(<LeaderboardsLossesPage />);

    await waitFor(() => expect(screen.getAllByText('21').length).toBeGreaterThan(0));
    // KotH specialist: 15 of its 21 destructions came from one battle type.
    expect(screen.getAllByText('15').length).toBeGreaterThan(0);
    expect(screen.getAllByText('4').length).toBeGreaterThan(0);
  });

  it('should re-request the ranking when a battle type header is clicked', async () => {
    render(<LeaderboardsLossesPage />);
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

    mockGet.mockResolvedValue(response('koth'));
    await userEvent.click(screen.getByTestId('sort-koth'));

    await waitFor(() =>
      expect(mockGet).toHaveBeenLastCalledWith(
        '/api/leaderboards/losses',
        { params: { page: 1, limit: 100, sortBy: 'koth' } },
      ),
    );
  });

  it('should offer a mobile ranking control covering every battle type', async () => {
    render(<LeaderboardsLossesPage />);
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const select = screen.getByLabelText('Rank by');
    // All nine battle types plus the combined total.
    expect(select.querySelectorAll('option')).toHaveLength(10);

    mockGet.mockResolvedValue(response('grand_melee'));
    await userEvent.selectOptions(select, 'grand_melee');

    await waitFor(() =>
      expect(mockGet).toHaveBeenLastCalledWith(
        '/api/leaderboards/losses',
        { params: { page: 1, limit: 100, sortBy: 'grand_melee' } },
      ),
    );
  });

  it('should no longer offer a league filter or a refresh button', async () => {
    render(<LeaderboardsLossesPage />);
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(screen.queryByText('League Filter')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull();
  });

  it('should show an error message when the request fails', async () => {
    mockGet.mockRejectedValue(new Error('boom'));
    render(<LeaderboardsLossesPage />);

    await waitFor(() =>
      expect(screen.getByText('Failed to load total losses leaderboard')).toBeInTheDocument(),
    );
  });
});
