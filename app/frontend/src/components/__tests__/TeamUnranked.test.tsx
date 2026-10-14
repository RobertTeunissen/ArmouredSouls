/**
 * A team gets a standings row in a league only once it is complete and every
 * member holds that league's subscription. Until then the team-battle routes
 * return null tier/instance/LP, and every team view must show "Unranked" and
 * "—" for LP instead of Bronze / 0 LP.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { TeamBattle, TeamBattleRobot } from '../../utils/teamBattleApi';
import type { TeamBattleLeagueHistoryEntry } from '../../utils/robotApi';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { userId: 1, username: 'test_user', role: 'user' }, logout: vi.fn() }),
}));

vi.mock('../../hooks/useSubscriptions', () => ({
  useStableOverview: () => ({
    data: { robots: [], registeredEvents: [] },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock('../../utils/teamBattleApi', () => ({
  getMyTeamBattles: vi.fn(),
  registerTeamBattle: vi.fn(),
  swapTeamBattleMember: vi.fn(),
  renameTeamBattle: vi.fn(),
  disbandTeamBattle: vi.fn(),
}));

vi.mock('../../utils/robotApi', () => ({
  fetchRobotTeamBattleLeagueHistory: vi.fn(),
}));

vi.mock('../../utils/api', () => ({
  api: { get: vi.fn().mockResolvedValue({ standing: null }) },
}));

vi.mock('../../stores', () => ({
  useRobotStore: (selector: (state: { robots: unknown[] }) => unknown) => selector({ robots: [] }),
}));

// recharts needs a real layout engine; the timeline itself is not under test.
vi.mock('../LeagueTimeline', () => ({
  default: ({ currentTier, emptyMessage }: { currentTier: string; emptyMessage?: string }) => (
    <div data-testid="league-timeline" data-current-tier={currentTier}>{emptyMessage}</div>
  ),
}));

import TeamBattleManagementContent from '../team-battles/TeamBattleManagementContent';
import LeagueStandingsSummary from '../LeagueStandingsSummary';
import TeamBattleLeagueHistory from '../TeamBattleLeagueHistory';
import { getMyTeamBattles } from '../../utils/teamBattleApi';
import { fetchRobotTeamBattleLeagueHistory } from '../../utils/robotApi';

function makeRobot(id: number, name: string): TeamBattleRobot {
  return {
    id,
    name,
    elo: 1200,
    currentHP: 100,
    maxHP: 100,
    currentShield: null,
    maxShield: null,
    loadoutType: 'single',
    mainWeaponId: 1,
    offhandWeaponId: null,
    subscriptions: [],
  };
}

/** A 2v2 team with no league_2v2 and no tag_team standing, as the route returns it. */
function makeUnrankedTeam(): TeamBattle {
  const robots = [makeRobot(1, 'Alpha'), makeRobot(2, 'Beta')];
  return {
    id: 1,
    stableId: 1,
    teamSize: 2,
    teamName: 'Iron Duo',
    teamLp: null,
    teamLeague: null,
    teamLeagueId: null,
    cyclesInLeague: 0,
    totalLeagueWins: 0,
    totalLeagueLosses: 0,
    totalLeagueDraws: 0,
    tagTeamLp: null,
    tagTeamLeague: null,
    tagTeamLeagueId: null,
    totalTagTeamWins: 0,
    totalTagTeamLosses: 0,
    totalTagTeamDraws: 0,
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01',
    members: robots.map((robot, slotIndex) => ({ id: 10 + slotIndex, teamId: 1, robotId: robot.id, slotIndex, robot })),
    isLockedForBattle: false,
  };
}

describe('teams without a standing are shown as Unranked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localStorage.getItem).mockReturnValue('mock-token');
    vi.mocked(getMyTeamBattles).mockResolvedValue([makeUnrankedTeam()]);
  });

  afterEach(() => {
    vi.mocked(localStorage.getItem).mockReset();
  });

  it('team card (Team Battles page): Unranked and — LP for the 2v2 and Tag Team leagues', async () => {
    render(
      <MemoryRouter>
        <TeamBattleManagementContent teamSize={2} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Iron Duo')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Unranked')).toHaveLength(2);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Bronze')).not.toBeInTheDocument();
  });

  it('dashboard standings card: Unranked and — LP for the 2v2 and Tag Team cards', async () => {
    render(
      <MemoryRouter>
        <LeagueStandingsSummary />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Iron Duo').length).toBeGreaterThan(0);
    });

    // Desktop and mobile layouts, for both the 2v2 and the Tag Team card
    expect(screen.getAllByText('Unranked')).toHaveLength(4);
    expect(screen.getAllByText('— LP')).toHaveLength(4);
    expect(screen.queryByText('Bronze')).not.toBeInTheDocument();
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
  });

  it('robot detail team league history: Unranked instead of a tier', async () => {
    const entry: TeamBattleLeagueHistoryEntry = {
      teamId: 1,
      teamSize: 2,
      teamName: 'Iron Duo',
      currentLeague: null,
      currentLeagueId: null,
      currentLp: null,
      history: [],
      tagTeamHistory: [],
      tagTeamCurrentLeague: null,
      tagTeamCurrentLp: null,
    };
    vi.mocked(fetchRobotTeamBattleLeagueHistory).mockResolvedValue({ teams: [entry] });

    render(<TeamBattleLeagueHistory robotId={1} />);

    await waitFor(() => {
      expect(screen.getByTestId('team-league-history')).toBeInTheDocument();
    });

    expect(screen.getByText('Iron Duo is Unranked in the 2v2 League. No tier changes recorded yet.')).toBeInTheDocument();
    expect(screen.getByText('Iron Duo is Unranked in the Tag Team League. No tier changes recorded yet.')).toBeInTheDocument();
    for (const timeline of screen.getAllByTestId('league-timeline')) {
      expect(timeline).toHaveAttribute('data-current-tier', 'Unranked');
    }
    expect(screen.queryByText(/currently in/)).not.toBeInTheDocument();
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
  });

  it('robot detail team league history: still shows the tier when the team is placed', async () => {
    vi.mocked(fetchRobotTeamBattleLeagueHistory).mockResolvedValue({
      teams: [{
        teamId: 1,
        teamSize: 2,
        teamName: 'Iron Duo',
        currentLeague: 'silver',
        currentLeagueId: 'silver_1',
        currentLp: 42,
        history: [],
        tagTeamHistory: [],
        tagTeamCurrentLeague: null,
        tagTeamCurrentLp: null,
      }],
    });

    render(<TeamBattleLeagueHistory robotId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Iron Duo is currently in silver league. No tier changes recorded yet.')).toBeInTheDocument();
    });
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Iron Duo is Unranked in the Tag Team League. No tier changes recorded yet.')).toBeInTheDocument();
  });
});
