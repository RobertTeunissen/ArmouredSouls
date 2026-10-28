/**
 * #531 — Battle Performance panel team-mode outcomes.
 *
 * Team-mode W/L/D must come from the permanent `battles.winning_side` column,
 * never from the ephemeral `battle_log` (NULLed after the retention window).
 * Before the fix every 2v2/3v3 League battle older than the retention window
 * was counted as a draw (Wattage: 1W-7L-63D).
 */
const mockBattleFindMany = jest.fn();
const mockTeamBattleMemberFindMany = jest.fn();
const mockScheduledTournamentMatchFindMany = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    battle: { findMany: (...args: unknown[]) => mockBattleFindMany(...args) },
    teamBattleMember: { findMany: (...args: unknown[]) => mockTeamBattleMemberFindMany(...args) },
    scheduledTournamentMatch: {
      findMany: (...args: unknown[]) => mockScheduledTournamentMatchFindMany(...args),
    },
  },
}));

jest.mock('../../scheduling/schedulingService', () => ({
  __esModule: true,
  default: { getUpcomingForRobot: jest.fn() },
}));

import { getPerformanceContext } from '../robotQueryService';

const ROBOT_ID = 42;
const TEAMMATE_ID = 43;

interface FixtureParticipant {
  robotId: number;
  team: number;
  damageDealt: number;
  eloBefore: number;
  eloAfter: number;
  placement: number | null;
  role: string | null;
}

interface FixtureBattle {
  id: number;
  battleType: string;
  leagueType: string;
  tournamentId: number | null;
  winnerId: number | null;
  winningSide: number | null;
  createdAt: Date;
  participants: FixtureParticipant[];
  tournament: { id: number; name: string; totalParticipants: number } | null;
}

let nextBattleId = 1;

/**
 * A side-based battle where the robot under test fights on team 1.
 * `side` is the stored winning side: 1 = robot's side won, 2 = other side won,
 * null = draw (winnerId null) unless `winnerId` is given (legacy row).
 */
function sideBattle(
  battleType: string,
  side: 1 | 2 | null,
  opts: { winnerId?: number | null; eloDelta?: number; tournamentId?: number } = {},
): FixtureBattle {
  const winnerId = opts.winnerId !== undefined ? opts.winnerId : side === null ? null : 900 + side;
  const eloDelta = opts.eloDelta ?? 0;
  return {
    id: nextBattleId++,
    battleType,
    leagueType: 'bronze',
    tournamentId: opts.tournamentId ?? null,
    winnerId,
    winningSide: side,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    participants: [
      { robotId: ROBOT_ID, team: 1, damageDealt: 10, eloBefore: 1200, eloAfter: 1200 + eloDelta, placement: null, role: 'active' },
      { robotId: TEAMMATE_ID, team: 1, damageDealt: 5, eloBefore: 1200, eloAfter: 1200, placement: null, role: 'active' },
      { robotId: 100, team: 2, damageDealt: 7, eloBefore: 1200, eloAfter: 1200, placement: null, role: 'active' },
      { robotId: 101, team: 2, damageDealt: 3, eloBefore: 1200, eloAfter: 1200, placement: null, role: 'active' },
    ],
    tournament: opts.tournamentId
      ? { id: opts.tournamentId, name: 'Cup', totalParticipants: 8 }
      : null,
  };
}

function repeat(n: number, make: () => FixtureBattle): FixtureBattle[] {
  return Array.from({ length: n }, make);
}

beforeEach(() => {
  jest.clearAllMocks();
  nextBattleId = 1;
  mockTeamBattleMemberFindMany.mockResolvedValue([]);
  mockScheduledTournamentMatchFindMany.mockResolvedValue([]);
});

describe('getPerformanceContext team-mode outcomes (#531)', () => {
  it('derives 2v2 League W/L/D from winning_side for battles whose battle_log was pruned', async () => {
    // 71 battles, none with a battle_log: 30 wins, 39 losses, 2 real draws.
    mockBattleFindMany.mockResolvedValue([
      ...repeat(30, () => sideBattle('league_2v2', 1)),
      ...repeat(39, () => sideBattle('league_2v2', 2)),
      ...repeat(2, () => sideBattle('league_2v2', null)),
    ]);

    const result = await getPerformanceContext(ROBOT_ID);

    expect(result.league2v2.totalBattles).toBe(71);
    expect(result.league2v2.wins).toBe(30);
    expect(result.league2v2.losses).toBe(39);
    expect(result.league2v2.draws).toBe(2);
    expect(result.league2v2.winRate).toBe(((30 / 71) * 100).toFixed(1));
  });

  it('derives 3v3 League W/L/D from winning_side', async () => {
    mockBattleFindMany.mockResolvedValue([
      ...repeat(4, () => sideBattle('league_3v3', 1)),
      ...repeat(5, () => sideBattle('league_3v3', 2)),
      sideBattle('league_3v3', null),
    ]);

    const result = await getPerformanceContext(ROBOT_ID);

    expect(result.league3v3).toMatchObject({ totalBattles: 10, wins: 4, losses: 5, draws: 1 });
  });

  it('derives team tournament W/L from winning_side', async () => {
    mockBattleFindMany.mockResolvedValue([
      sideBattle('tournament_2v2', 1, { tournamentId: 7 }),
      sideBattle('tournament_2v2', 1, { tournamentId: 7 }),
      sideBattle('tournament_2v2', 2, { tournamentId: 7 }),
    ]);

    const result = await getPerformanceContext(ROBOT_ID);

    expect(result.tournaments).toHaveLength(1);
    expect(result.tournaments[0]).toMatchObject({ tournamentId: 7, wins: 2, losses: 1 });
  });

  it('prefers the stored winning_side over the ELO direction for tag team', async () => {
    mockBattleFindMany.mockResolvedValue([
      // Win with no ELO change: the old heuristic called this a draw.
      sideBattle('tag_team', 1, { eloDelta: 0 }),
      // Loss despite an ELO gain: the side column wins.
      sideBattle('tag_team', 2, { eloDelta: 5 }),
      // Legacy side-less row: falls back to the ELO heuristic.
      sideBattle('tag_team', null, { winnerId: 77, eloDelta: 3 }),
      sideBattle('tag_team', null),
    ]);

    const result = await getPerformanceContext(ROBOT_ID);

    expect(result.tagTeam).toMatchObject({ totalBattles: 4, wins: 2, losses: 1, draws: 1 });
  });

  it('does not count a legacy row (winner set, side missing) as a 2v2 draw', async () => {
    mockBattleFindMany.mockResolvedValue([
      sideBattle('league_2v2', null, { winnerId: 5 }),
      sideBattle('league_2v2', 1),
    ]);

    const result = await getPerformanceContext(ROBOT_ID);

    expect(result.league2v2).toMatchObject({ totalBattles: 2, wins: 1, losses: 0, draws: 0 });
  });

  it('selects winning_side and does not read battle_log', async () => {
    mockBattleFindMany.mockResolvedValue([]);

    await getPerformanceContext(ROBOT_ID);

    const args = mockBattleFindMany.mock.calls[0][0] as { select: Record<string, unknown> };
    expect(args.select.winningSide).toBe(true);
    expect(args.select).not.toHaveProperty('battleLogZst');
    expect(args.select).not.toHaveProperty('legacyBattleLog');
  });
});
