/**
 * A robot without a league_1v1 standing (not subscribed to 1v1) is returned by
 * the API without currentLeague/leagueId/leaguePoints. The 1v1 card must render
 * it as "Unranked" instead of throwing in getTierName(undefined).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { userId: 1, username: 'test_user', role: 'user' }, logout: vi.fn() }),
}));

vi.mock('../../utils/teamBattleApi', () => ({
  getMyTeamBattles: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../utils/api', () => ({
  api: { get: vi.fn().mockResolvedValue({ standing: null }) },
}));

vi.mock('../../hooks/useSubscriptions', () => ({
  useStableOverview: () => ({ data: { robots: [{ robotId: 7, subscriptions: [] }] } }),
}));

const unrankedRobot = {
  id: 7,
  name: 'Fresh Bot',
  // No currentLeague / leagueId / leaguePoints / totalLeague1v1* — the API omits them
};

vi.mock('../../stores', () => ({
  useRobotStore: (selector: (state: { robots: unknown[] }) => unknown) =>
    selector({ robots: [unrankedRobot] }),
}));

import LeagueStandingsSummary from '../LeagueStandingsSummary';

describe('LeagueStandingsSummary — robot without a 1v1 standing', () => {
  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReturnValue('mock-token');
  });

  it('renders the robot as Unranked with no LP instead of throwing', async () => {
    render(
      <MemoryRouter>
        <LeagueStandingsSummary />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Fresh Bot').length).toBeGreaterThan(0);
    });

    // Desktop and mobile layouts both render the 1v1 tier label
    expect(screen.getAllByText('Unranked').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('— LP').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('0W').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
  });
});
