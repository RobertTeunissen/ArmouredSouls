/**
 * Hall of Records "Most Battles" uses the all-modes battle count.
 *
 * The ranking itself runs in SQL (`getTopRobotsByAllModesBattleCount`, pinned
 * in allModesBattleCount.test.ts and executed in tests/integration/
 * mostBattlesAllModes.test.ts). This suite pins how `fetchCareerRecords` uses
 * it: ranked order kept, displayed value taken from the ranking row.
 */
const mockRobotFindMany = jest.fn();
const mockQueryRaw = jest.fn();
const mockTopRobots = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    robot: { findMany: (...args: unknown[]) => mockRobotFindMany(...args) },
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

const mockAllModesCounts = jest.fn();

jest.mock('../../robot/all-modes-battle-count', () => ({
  getTopRobotsByAllModesBattleCount: (...args: unknown[]) => mockTopRobots(...args),
  getAllModesBattleCounts: (...args: unknown[]) => mockAllModesCounts(...args),
}));

import { fetchCareerRecords } from '../recordsQueryService';

const user = { username: 'owner', stableName: 'Owner Stable', stableType: 'human' };

function robotRow(id: number, totalBattles: number, wins: number) {
  return { id, name: `R${id}`, totalBattles, wins, losses: totalBattles - wins, draws: 0, elo: 1200, user };
}

/** Rows by id; `findMany({ where: { id: { in } } })` returns them shuffled. */
const ROBOTS = new Map([
  [1, robotRow(1, 400, 200)],
  [2, robotRow(2, 100, 60)],
  [3, robotRow(3, 50, 10)],
]);

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryRaw.mockResolvedValue([]);
  mockAllModesCounts.mockResolvedValue(new Map());
  mockRobotFindMany.mockImplementation(async (args: { where?: { id?: { in: number[] } } }) => {
    const ids = args.where?.id?.in;
    if (!ids) return [];
    return [...ids].reverse().map((id) => ROBOTS.get(id)).filter(Boolean);
  });
  // Robot 2 has fewer win/loss-mode battles but 500 KotH/Grand Melee matches.
  mockTopRobots.mockResolvedValue([
    { robotId: 2, allModesBattleCount: 600 },
    { robotId: 1, allModesBattleCount: 400 },
    { robotId: 3, allModesBattleCount: 50 },
  ]);
});

describe('fetchCareerRecords().mostBattles', () => {
  it('keeps the SQL rank order even when the robots load in another order', async () => {
    const { mostBattles } = await fetchCareerRecords();
    expect(mostBattles.map((e) => e.robotId)).toEqual([2, 1, 3]);
  });

  it('asks for the top 10 and loads exactly those robots', async () => {
    await fetchCareerRecords();
    expect(mockTopRobots).toHaveBeenCalledWith(10);
    expect(mockRobotFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [2, 1, 3] } } }));
  });

  it('displays the all-modes count the ranking query returned, not a second read', async () => {
    // The robot rows say nothing about placement matches: the value must come from the rank row.
    const { mostBattles } = await fetchCareerRecords();
    expect(mostBattles.map((e) => e.allModesBattleCount)).toEqual([600, 400, 50]);
  });

  it('keeps W/L/D and win rate on the win/loss-mode counters', async () => {
    const { mostBattles } = await fetchCareerRecords();

    expect(mostBattles[0]).toMatchObject({ totalBattles: 100, wins: 60, losses: 40, draws: 0, winRate: 60 });
  });

  it('skips a ranked id whose robot vanished between the two queries', async () => {
    mockTopRobots.mockResolvedValue([
      { robotId: 2, allModesBattleCount: 600 },
      { robotId: 99, allModesBattleCount: 500 },
      { robotId: 1, allModesBattleCount: 400 },
    ]);
    const { mostBattles } = await fetchCareerRecords();
    expect(mostBattles.map((e) => e.robotId)).toEqual([2, 1]);
  });
});

describe('fetchCareerRecords() per-battle figures', () => {
  // Lifetime damage and destructions count every mode, so dividing by the
  // win/loss-mode `totalBattles` overstated them (a 373% "kill rate" on ACC).
  it('divides lifetime damage and destructions by the all-modes battle count', async () => {
    const killer = { ...robotRow(7, 100, 60), kills: 250, damageDealtLifetime: 50_000 };
    mockRobotFindMany.mockImplementation(async (args: { where?: { id?: { in: number[] } }; orderBy?: unknown }) => {
      if (args.where?.id?.in) return [];
      return [killer];
    });
    mockAllModesCounts.mockResolvedValue(new Map([[7, 250]]));

    const { mostKills, mostLifetimeDamage } = await fetchCareerRecords();

    expect(mostKills[0]).toMatchObject({ kills: 250, allModesBattleCount: 250, killsPerBattle: 1 });
    expect(mostLifetimeDamage[0]).toMatchObject({ damageDealt: 50_000, allModesBattleCount: 250, avgDamagePerBattle: 200 });
    expect(mostKills[0]).not.toHaveProperty('killRate');
  });

  it('reports 0 per battle for a robot without battles', async () => {
    const idle = { ...robotRow(8, 0, 0), kills: 0, damageDealtLifetime: 0 };
    mockRobotFindMany.mockImplementation(async (args: { where?: { id?: { in: number[] } } }) => (args.where?.id?.in ? [] : [idle]));

    const { mostKills, mostLifetimeDamage } = await fetchCareerRecords();

    expect(mostKills[0].killsPerBattle).toBe(0);
    expect(mostLifetimeDamage[0].avgDamagePerBattle).toBe(0);
  });
});
