/**
 * Dashboard stable totals count each battle once per stable.
 *
 * `getStableStats` sums the per-robot career counters, which count a team
 * battle once per member, and used to add the tag-team standings W/L/D on top.
 * A same-stable tag-team pair therefore showed one battle as three. These tests
 * pin the fix: the sum minus the shared-side overlap, nothing from standings.
 */

const mockUserFindUnique = jest.fn();
const mockRobotFindMany = jest.fn();
const mockTeamBattleFindMany = jest.fn();
const mockStandingFindMany = jest.fn();
const mockCycleSnapshotFindFirst = jest.fn();
const mockCycleSnapshotFindUnique = jest.fn();
const mockAuditLogFindMany = jest.fn();
const mockQueryRaw = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    robot: { findMany: (...args: unknown[]) => mockRobotFindMany(...args) },
    teamBattle: { findMany: (...args: unknown[]) => mockTeamBattleFindMany(...args) },
    standing: { findMany: (...args: unknown[]) => mockStandingFindMany(...args) },
    cycleSnapshot: {
      findFirst: (...args: unknown[]) => mockCycleSnapshotFindFirst(...args),
      findUnique: (...args: unknown[]) => mockCycleSnapshotFindUnique(...args),
    },
    auditLog: { findMany: (...args: unknown[]) => mockAuditLogFindMany(...args) },
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

import { getStableStats } from '../userProfileService';
import {
  classifySharedSideOutcome,
  computeStableBattleOverlap,
  getStableBattleOverlap,
  NO_COUNTER_BYE_BATTLE_TYPES,
  type SharedSideGroup,
} from '../stable-battle-overlap';

interface RobotRow {
  id: number;
  elo: number;
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
}

function robot(id: number, counters: Omit<RobotRow, 'id' | 'elo'>, elo = 1200): RobotRow & Record<string, unknown> {
  return { id, elo, ...counters, currentHP: 100, maxHP: 100, mainWeapon: null };
}

function side(overrides: Partial<SharedSideGroup>): SharedSideGroup {
  return { battleId: 1, team: 1, robotCount: 2, winnerId: 10, winningSide: 1, ...overrides };
}

/** Serve one stable: its robots, its tag teams and the shared sides the SQL would return. */
function serveStable(robots: RobotRow[], sharedSides: SharedSideGroup[], tagTeamIds: number[] = []) {
  mockUserFindUnique.mockResolvedValue({ prestige: 0 });
  mockRobotFindMany.mockResolvedValue(robots);
  mockTeamBattleFindMany.mockResolvedValue(tagTeamIds.map((id) => ({ id })));
  mockStandingFindMany.mockImplementation((args: { where: { mode?: string } }) =>
    Promise.resolve(args.where.mode === 'tag_team' ? tagTeamIds.map(() => ({ tier: 'bronze' })) : [{ tier: 'bronze' }]),
  );
  mockQueryRaw.mockResolvedValue(sharedSides);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCycleSnapshotFindFirst.mockResolvedValue(null);
  mockAuditLogFindMany.mockResolvedValue([]);
});

describe('classifySharedSideOutcome', () => {
  it('reads the outcome from battles.winning_side', () => {
    expect(classifySharedSideOutcome({ team: 1, winnerId: 10, winningSide: 1 })).toBe('win');
    expect(classifySharedSideOutcome({ team: 2, winnerId: 10, winningSide: 1 })).toBe('loss');
  });

  it('treats a battle without a winner as a draw', () => {
    expect(classifySharedSideOutcome({ team: 1, winnerId: null, winningSide: null })).toBe('draw');
  });

  it('marks a legacy row with a winner but no winning side as unknown', () => {
    expect(classifySharedSideOutcome({ team: 1, winnerId: 10, winningSide: null })).toBe('unknown');
  });
});

describe('computeStableBattleOverlap', () => {
  it('subtracts k - 1 per shared side, filed under the side outcome', () => {
    expect(
      computeStableBattleOverlap([
        side({ battleId: 1, robotCount: 2, winningSide: 1 }), // tag team / 2v2 win
        side({ battleId: 2, robotCount: 3, team: 2, winningSide: 1 }), // 3v3 loss
        side({ battleId: 3, robotCount: 2, winnerId: null, winningSide: null }), // draw
      ]),
    ).toEqual({ battles: 4, wins: 1, losses: 2, draws: 1 });
  });

  it('subtracts nothing for a lone robot or an unreadable legacy outcome', () => {
    expect(
      computeStableBattleOverlap([
        side({ robotCount: 1 }),
        side({ battleId: 2, winnerId: 10, winningSide: null }),
      ]),
    ).toEqual({ battles: 0, wins: 0, losses: 0, draws: 0 });
  });
});

describe('getStableBattleOverlap', () => {
  it('issues no query for a stable without robots', async () => {
    await expect(getStableBattleOverlap([])).resolves.toEqual({ battles: 0, wins: 0, losses: 0, draws: 0 });
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('skips rows that never touched the robot counters', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getStableBattleOverlap([1, 2, 2]);

    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = mockQueryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const sql = strings.join('?');
    expect(values).toEqual([
      [1, 2],
      ['koth', 'grand_melee'],
      ['tournament_1v1', 'tournament_2v2', 'tournament_3v3'],
    ]);
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('opp.team <> bp.team');
    expect(sql).toContain('HAVING COUNT(*) > 1');
    expect(sql).not.toContain('battle_log');
  });

  it('derives the bye exclusion from the Bye_Mode_Table (updatesElo: false, not placement)', () => {
    expect([...NO_COUNTER_BYE_BATTLE_TYPES]).toEqual(['tournament_1v1', 'tournament_2v2', 'tournament_3v3']);
  });
});

describe('getStableStats: each battle counts once per stable', () => {
  it('counts a same-stable tag-team pair battle once (was 3: two robots + tag-team standing)', async () => {
    serveStable(
      [robot(1, { totalBattles: 1, wins: 1, losses: 0, draws: 0 }), robot(2, { totalBattles: 1, wins: 1, losses: 0, draws: 0 })],
      [side({ battleId: 50, team: 1, robotCount: 2, winningSide: 1 })],
      [10],
    );

    const stats = await getStableStats(1);

    expect(stats).toMatchObject({ totalBattles: 1, wins: 1, losses: 0, draws: 0, winRate: 100, highestTagTeamLeague: 'bronze' });
    // The tag-team standing is read for its tier only, never for W/L/D.
    const tagTeamCall = mockStandingFindMany.mock.calls.find(([a]) => a.where.mode === 'tag_team');
    expect(tagTeamCall?.[0].select).toEqual({ tier: true });
  });

  it('counts a tag-team battle between two stables once for each stable', async () => {
    // Stable A (robots 1, 2) on side 1 beat stable B (robots 3, 4) on side 2.
    serveStable(
      [robot(1, { totalBattles: 1, wins: 1, losses: 0, draws: 0 }), robot(2, { totalBattles: 1, wins: 1, losses: 0, draws: 0 })],
      [side({ battleId: 60, team: 1, robotCount: 2, winningSide: 1 })],
      [10],
    );
    await expect(getStableStats(1)).resolves.toMatchObject({ totalBattles: 1, wins: 1, losses: 0 });

    serveStable(
      [robot(3, { totalBattles: 1, wins: 0, losses: 1, draws: 0 }), robot(4, { totalBattles: 1, wins: 0, losses: 1, draws: 0 })],
      [side({ battleId: 60, team: 2, robotCount: 2, winningSide: 1 })],
      [11],
    );
    await expect(getStableStats(2)).resolves.toMatchObject({ totalBattles: 1, wins: 0, losses: 1, winRate: 0 });
  });

  it('applies the same correction to 2v2 and 3v3 League, including draws', async () => {
    // One 3v3 draw (all three robots) and one 2v2 win (robots 1 and 2).
    serveStable(
      [
        robot(1, { totalBattles: 2, wins: 1, losses: 0, draws: 1 }),
        robot(2, { totalBattles: 2, wins: 1, losses: 0, draws: 1 }),
        robot(3, { totalBattles: 1, wins: 0, losses: 0, draws: 1 }),
      ],
      [
        side({ battleId: 70, robotCount: 3, winnerId: null, winningSide: null }),
        side({ battleId: 71, robotCount: 2, winningSide: 1 }),
      ],
    );

    await expect(getStableStats(1)).resolves.toMatchObject({ totalBattles: 2, wins: 1, losses: 0, draws: 1, winRate: 50 });
  });

  it('leaves 1v1 totals as the plain sum of robot counters', async () => {
    serveStable(
      [robot(1, { totalBattles: 10, wins: 6, losses: 3, draws: 1 }), robot(2, { totalBattles: 8, wins: 4, losses: 4, draws: 0 })],
      [],
    );

    await expect(getStableStats(1)).resolves.toMatchObject({ totalBattles: 18, wins: 10, losses: 7, draws: 1, winRate: 55.6 });
  });

  it('still counts byes as battles: a 1v1 bye and a 2v2 bye each count once', async () => {
    // Robot 1: one league 1v1 bye. Robots 1 and 2: one league 2v2 bye together.
    // Both bye kinds add a battle and a win to each real robot's counters.
    serveStable(
      [robot(1, { totalBattles: 2, wins: 2, losses: 0, draws: 0 }), robot(2, { totalBattles: 1, wins: 1, losses: 0, draws: 0 })],
      [side({ battleId: 80, team: 1, robotCount: 2, winningSide: 1 })], // the 2v2 bye, real side only
    );

    await expect(getStableStats(1)).resolves.toMatchObject({ totalBattles: 2, wins: 2, losses: 0, winRate: 100 });
  });

  it('counts a shared battle once in the cycle win/loss delta as well', async () => {
    serveStable(
      [robot(1, { totalBattles: 2, wins: 1, losses: 1, draws: 0 }, 1500), robot(2, { totalBattles: 1, wins: 1, losses: 0, draws: 0 })],
      [side({ battleId: 90, robotCount: 2, winningSide: 1 })],
    );
    mockCycleSnapshotFindFirst.mockResolvedValue({ cycleNumber: 4 });
    mockCycleSnapshotFindUnique.mockResolvedValue({ stableMetrics: [], robotMetrics: [] });
    mockAuditLogFindMany.mockResolvedValue([
      { battleId: 90, payload: { result: 'win', battleType: 'tag_team' } },
      { battleId: 90, payload: { result: 'win', battleType: 'tag_team' } },
      { battleId: 91, payload: { result: 'loss', battleType: 'league_1v1' } },
      // Two of the stable's teams meeting: opposite results stay separate.
      { battleId: 92, payload: { result: 'win', battleType: 'tournament_2v2' } },
      { battleId: 92, payload: { result: 'loss', battleType: 'tournament_2v2' } },
    ]);

    const stats = await getStableStats(1);

    expect(stats.cycleChanges).toMatchObject({ wins: 2, losses: 2 });
    expect(mockAuditLogFindMany.mock.calls[0][0].select).toEqual({ payload: true, battleId: true });
  });
});
