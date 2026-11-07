/**
 * Stable page revamp: per-robot standings in every tiered mode, the latest
 * results and the best Hall of Records placements.
 */
const mockStandingFindMany = jest.fn();
const mockMemberFindMany = jest.fn();
const mockParticipantFindMany = jest.fn();
const mockAccoladeFindMany = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    standing: { findMany: (...args: unknown[]) => mockStandingFindMany(...args) },
    teamBattleMember: { findMany: (...args: unknown[]) => mockMemberFindMany(...args) },
    battleParticipant: { findMany: (...args: unknown[]) => mockParticipantFindMany(...args) },
    seasonAccolade: { findMany: (...args: unknown[]) => mockAccoladeFindMany(...args) },
  },
}));

import {
  getRecentResults,
  getRobotStandings,
  getTopAccolades,
  participantOutcome,
  RECENT_RESULTS_LIMIT,
} from '../stable-view-sections';

interface Row {
  entityType: 'robot' | 'team';
  entityId: number;
  mode: string;
  tier: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  draws: number;
  totalMatches: number | null;
}

const row = (overrides: Partial<Row> & Pick<Row, 'entityType' | 'entityId' | 'mode'>): Row => ({
  tier: 'bronze', leaguePoints: 0, wins: 0, losses: 0, draws: 0, totalMatches: null, ...overrides,
});

/** Serves standings rows the way Prisma would filter them. */
function serveStandings(rows: Row[]): void {
  mockStandingFindMany.mockImplementation(async (args: { where: { entityType: string; entityId: { in: number[] }; mode: { in: string[] } } }) =>
    rows
      .filter((r) => r.entityType === args.where.entityType)
      .filter((r) => args.where.entityId.in.includes(r.entityId))
      .filter((r) => args.where.mode.in.includes(r.mode))
      .map(({ entityType: _type, ...rest }) => rest));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMemberFindMany.mockResolvedValue([]);
});

describe('getRobotStandings', () => {
  it('returns played robot and team modes in display order, without unplayed rows', async () => {
    serveStandings([
      row({ entityType: 'robot', entityId: 1, mode: 'grand_melee', tier: 'champion', leaguePoints: 718, wins: 14, totalMatches: 50 }),
      row({ entityType: 'robot', entityId: 1, mode: 'league_1v1', tier: 'champion', leaguePoints: 130, wins: 56, losses: 39 }),
      // Subscribed but never played: the Bronze placeholder row.
      row({ entityType: 'robot', entityId: 1, mode: 'koth', totalMatches: 0 }),
      row({ entityType: 'team', entityId: 7, mode: 'league_2v2', tier: 'diamond', leaguePoints: 122, wins: 54, losses: 42, draws: 1 }),
      // Tournament standings carry no tier and never show.
      row({ entityType: 'robot', entityId: 1, mode: 'tournament_1v1', wins: 3 }),
    ]);
    mockMemberFindMany.mockResolvedValue([{ robotId: 1, teamId: 7, team: { teamName: 'Apes' } }]);

    const standings = (await getRobotStandings([1])).get(1);

    expect(standings?.map((s) => [s.mode, s.tier, s.teamName])).toEqual([
      ['league_1v1', 'champion', null],
      ['league_2v2', 'diamond', 'Apes'],
      ['grand_melee', 'champion', null],
    ]);
    expect(standings?.find((s) => s.mode === 'grand_melee')?.totalMatches).toBe(50);
    expect(standings?.find((s) => s.mode === 'league_1v1')?.totalMatches).toBeNull();
  });

  it('keeps the better team standing when a robot is in two teams of one mode', async () => {
    serveStandings([
      row({ entityType: 'team', entityId: 7, mode: 'tag_team', tier: 'gold', leaguePoints: 90, wins: 4 }),
      row({ entityType: 'team', entityId: 8, mode: 'tag_team', tier: 'platinum', leaguePoints: 10, wins: 2 }),
    ]);
    mockMemberFindMany.mockResolvedValue([
      { robotId: 1, teamId: 7, team: { teamName: 'Gold Team' } },
      { robotId: 1, teamId: 8, team: { teamName: 'Plat Team' } },
    ]);

    const standings = (await getRobotStandings([1])).get(1);

    expect(standings).toHaveLength(1);
    expect(standings?.[0]).toMatchObject({ tier: 'platinum', teamName: 'Plat Team' });
  });

  it('gives every robot an entry, empty when it has not played', async () => {
    serveStandings([]);
    const standings = await getRobotStandings([1, 2]);
    expect(standings.get(1)).toEqual([]);
    expect(standings.get(2)).toEqual([]);
  });

  it('skips the queries for a stable without robots', async () => {
    expect((await getRobotStandings([])).size).toBe(0);
    expect(mockStandingFindMany).not.toHaveBeenCalled();
  });
});

const battle = (overrides: Record<string, unknown> = {}) => ({
  battleType: 'league_1v1', leagueType: 'gold', winnerId: null, winningSide: null,
  tournamentId: null, tournamentRound: null, createdAt: new Date('2026-11-06T17:00:00.000Z'), ...overrides,
});

describe('participantOutcome', () => {
  it.each([
    ['1v1 win', { robotId: 1, team: 1, battle: battle({ winnerId: 1 }) }, 'win'],
    ['1v1 loss', { robotId: 1, team: 1, battle: battle({ winnerId: 2 }) }, 'loss'],
    ['draw', { robotId: 1, team: 1, battle: battle() }, 'draw'],
    ['team win by side', { robotId: 1, team: 2, battle: battle({ battleType: 'league_2v2', winnerId: 70, winningSide: 2 }) }, 'win'],
    ['team loss by side', { robotId: 1, team: 1, battle: battle({ battleType: 'tag_team', winnerId: 70, winningSide: 2 }) }, 'loss'],
    ['pre-#39 team battle', { robotId: 1, team: 1, battle: battle({ battleType: 'league_3v3', winnerId: 70 }) }, null],
    ['placement mode', { robotId: 1, team: 1, battle: battle({ battleType: 'grand_melee', winnerId: 1 }) }, null],
  ])('%s', (_label, input, expected) => {
    expect(participantOutcome({ battleId: 1, placement: null, ...input })).toBe(expected);
  });
});

describe('getRecentResults', () => {
  it('groups robots by battle, newest first, with placements for placement modes', async () => {
    mockParticipantFindMany.mockResolvedValue([
      { battleId: 30, robotId: 2, team: 1, placement: 11, battle: battle({ battleType: 'grand_melee', winnerId: 9, leagueType: 'champion' }) },
      { battleId: 30, robotId: 1, team: 1, placement: 6, battle: battle({ battleType: 'grand_melee', winnerId: 9, leagueType: 'champion' }) },
      { battleId: 29, robotId: 1, team: 1, placement: null, battle: battle({ battleType: 'tournament_1v1', winnerId: 1, tournamentId: 4, tournamentRound: 2 }) },
    ]);

    const results = await getRecentResults([{ id: 1, name: 'GekkeAap' }, { id: 2, name: 'DommeAap' }]);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ battleId: 30, battleType: 'grand_melee', tier: 'champion' });
    expect(results[0].entries).toEqual([
      { robotId: 1, robotName: 'GekkeAap', outcome: null, placement: 6 },
      { robotId: 2, robotName: 'DommeAap', outcome: null, placement: 11 },
    ]);
    expect(results[1]).toMatchObject({ battleId: 29, tier: null, tournamentRound: 2 });
    expect(results[1].entries[0]).toMatchObject({ outcome: 'win', placement: null });
  });

  it(`stops at ${RECENT_RESULTS_LIMIT} battles`, async () => {
    mockParticipantFindMany.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({ battleId: 100 - i, robotId: 1, team: 1, placement: null, battle: battle({ winnerId: 1 }) })),
    );
    const results = await getRecentResults([{ id: 1, name: 'A' }]);
    expect(results.map((r) => r.battleId)).toEqual([100, 99, 98, 97, 96]);
  });

  it('returns nothing for a stable without robots', async () => {
    expect(await getRecentResults([])).toEqual([]);
    expect(mockParticipantFindMany).not.toHaveBeenCalled();
  });
});

describe('getTopAccolades', () => {
  it('reads the best placements and leaves tournament wins out', async () => {
    mockAccoladeFindMany.mockResolvedValue([]);
    await getTopAccolades(414);
    expect(mockAccoladeFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 414, category: { not: 'tournamentChampion' } },
      orderBy: [{ rank: 'asc' }, { seasonNumber: 'desc' }, { category: 'asc' }],
    }));
  });
});
