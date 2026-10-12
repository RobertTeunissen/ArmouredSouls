import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UpcomingMatches from '../UpcomingMatches';
import type { ScheduledMatch } from '../../utils/matchmakingApi';

const mockedGetUpcomingMatches = vi.hoisted(() => vi.fn());

vi.mock('../../utils/matchmakingApi', async () => {
  const actual = await vi.importActual<typeof import('../../utils/matchmakingApi')>('../../utils/matchmakingApi');
  return {
    ...actual,
    getUpcomingMatches: mockedGetUpcomingMatches,
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 7, username: 'owner' },
    logout: vi.fn(),
  }),
}));

function makeRobot(id: number, userId: number) {
  return {
    id,
    name: `Robot ${id}`,
    elo: 1200,
    currentHP: 100,
    maxHP: 100,
    userId,
    user: { username: userId === 7 ? 'owner' : 'opponent' },
  };
}

function makeTeam(id: number, userId: number, size: number) {
  return {
    id,
    teamName: `Team ${id}`,
    teamSize: size,
    teamLp: 100,
    teamLeague: 'bronze',
    members: Array.from({ length: size }, (_, index) => ({
      robotId: id * 10 + index,
      robotName: `Robot ${id * 10 + index}`,
      robotElo: 1200,
      userId,
      user: { username: userId === 7 ? 'owner' : 'opponent' },
    })),
    combinedELO: size * 1200,
  };
}

function makeMatch(overrides: Partial<ScheduledMatch> = {}): ScheduledMatch {
  return {
    id: `match-${Math.random()}`,
    matchType: 'league_1v1',
    leagueType: 'bronze',
    scheduledFor: '2026-06-01T12:00:00Z',
    status: 'scheduled',
    robot1: null,
    robot2: null,
    teamBattleTeam2: null,
    ...overrides,
  };
}

function renderPage(props: ComponentProps<typeof UpcomingMatches> = {}): void {
  vi.mocked(localStorage.getItem).mockReturnValue('test-token');
  render(
    <MemoryRouter>
      <UpcomingMatches {...props} />
    </MemoryRouter>,
  );
}

function makeByeModes(): ScheduledMatch[] {
  return [
    makeMatch({ matchType: 'league_1v1', isByeMatch: true, robot1: makeRobot(10, 7), byeRewardCredits: 10, byeRewardStatus: 'expected' }),
    makeMatch({ matchType: 'tournament_1v1', isByeMatch: true, robot1: makeRobot(11, 7), byeRewardCredits: 11, byeRewardStatus: 'expected' }),
    makeMatch({ matchType: 'league_2v2', isByeMatch: true, teamBattleTeam1: makeTeam(102, 7, 2), byeRewardCredits: 12, byeRewardStatus: 'expected' }),
    makeMatch({ matchType: 'tournament_2v2', isByeMatch: true, teamBattleTeam1: makeTeam(103, 7, 2), byeRewardCredits: 13, byeRewardStatus: 'expected' }),
    makeMatch({ matchType: 'league_3v3', isByeMatch: true, teamBattleTeam1: makeTeam(104, 7, 3), byeRewardCredits: 14, byeRewardStatus: 'expected' }),
    makeMatch({ matchType: 'tournament_3v3', isByeMatch: true, teamBattleTeam1: makeTeam(105, 7, 3), byeRewardCredits: 15, byeRewardStatus: 'expected' }),
    makeMatch({ matchType: 'tag_team', isByeMatch: true, teamBattleTeam1: makeTeam(106, 7, 2), byeRewardCredits: 16, byeRewardStatus: 'expected' }),
    makeMatch({ matchType: 'koth', isByeMatch: true, kothParticipants: [{ id: 17, name: 'Robot 17', elo: 1200, userId: 7 }], kothParticipantCount: 1, byeRewardCredits: 17, byeRewardStatus: 'expected' }),
    makeMatch({ matchType: 'grand_melee', isByeMatch: true, kothParticipants: [{ id: 18, name: 'Robot 18', elo: 1200, userId: 7 }], kothParticipantCount: 1, byeRewardCredits: 18, byeRewardStatus: 'expected' }),
  ];
}

describe('UpcomingMatches shared display routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('should render all nine mode byes through the shared ByeMatchCard with expected rewards', async () => {
    mockedGetUpcomingMatches.mockResolvedValue(makeByeModes());
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('BYE').length).toBeGreaterThanOrEqual(18);
    });

    expect(screen.getAllByText(/Expected bye reward:/).length).toBeGreaterThanOrEqual(18);
    expect(screen.queryByText('PENDING')).toBeNull();
    expect(screen.getAllByText('No opponent — walkover').length).toBeGreaterThanOrEqual(18);
  });

  it('should render two independent standard cards when one stable owns opposite sides', async () => {
    mockedGetUpcomingMatches.mockResolvedValue([
      makeMatch({
        robot1: makeRobot(10, 7),
        robot2: makeRobot(20, 7),
      }),
    ]);
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('PENDING').length).toBeGreaterThanOrEqual(4);
    });

    expect(screen.getAllByText('Robot 10').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Robot 20').length).toBeGreaterThan(0);
  });

  it('should omit malformed bye records rather than falling through to an ordinary card', async () => {
    mockedGetUpcomingMatches.mockResolvedValue([
      makeMatch({ isByeMatch: true, robot1: null, robot2: null }),
    ]);
    renderPage();

    await waitFor(() => expect(mockedGetUpcomingMatches).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('BYE')).toBeNull();
    expect(screen.queryByText('PENDING')).toBeNull();
  });
});

describe('UpcomingMatches perspective and readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('Dashboard (no robotId) should only render the viewer\'s own sides', async () => {
    mockedGetUpcomingMatches.mockResolvedValue([
      makeMatch({ robot1: makeRobot(10, 7), robot2: makeRobot(20, 8) }),
      makeMatch({ robot1: makeRobot(30, 8), robot2: makeRobot(40, 9) }),
    ]);
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('PENDING')).toHaveLength(2);
    });
    expect(screen.queryByText('Robot 30')).toBeNull();
    expect(screen.queryByText('Robot 40')).toBeNull();
  });

  it('Robot Detail should render a match card for a robot the viewer does not own', async () => {
    mockedGetUpcomingMatches.mockResolvedValue([
      makeMatch({ robot1: makeRobot(20, 8), robot2: makeRobot(30, 9) }),
    ]);
    renderPage({ robotId: 20 });

    await waitFor(() => {
      expect(screen.getAllByText('PENDING')).toHaveLength(2);
    });
    expect(screen.getAllByText('Robot 20').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Robot 30').length).toBeGreaterThan(0);
    expect(mockedGetUpcomingMatches).toHaveBeenCalledWith(20);
  });

  it('Robot Detail should render a team card when the viewer owns neither side', async () => {
    mockedGetUpcomingMatches.mockResolvedValue([
      makeMatch({
        matchType: 'league_2v2',
        teamBattleTeam1: makeTeam(201, 8, 2),
        teamBattleTeam2: makeTeam(301, 9, 2),
      }),
    ]);
    renderPage({ robotId: 3010 });

    await waitFor(() => {
      expect(screen.getAllByText('Team 301').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Team 201').length).toBeGreaterThan(0);
  });

  it('should not show the readiness badge when readiness is unknown', async () => {
    mockedGetUpcomingMatches.mockResolvedValue([
      makeMatch({ robot1: makeRobot(20, 8), robot2: makeRobot(30, 9) }),
    ]);
    renderPage({ robotId: 20, battleReadiness: undefined });

    await waitFor(() => {
      expect(screen.getAllByText('PENDING').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Not Battle Ready')).toBeNull();
  });

  it('should show the readiness badge and warnings when not ready', async () => {
    mockedGetUpcomingMatches.mockResolvedValue([
      makeMatch({ robot1: makeRobot(10, 7), robot2: makeRobot(20, 8) }),
    ]);
    renderPage({ robotId: 10, battleReadiness: { isReady: false, warnings: ['No main weapon equipped'] } });

    await waitFor(() => {
      expect(screen.getByText('Not Battle Ready')).toBeTruthy();
    });
    expect(screen.getByText(/⚠️ No main weapon equipped/)).toBeTruthy();
  });
});
