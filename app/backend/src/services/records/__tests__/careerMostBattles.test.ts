/**
 * Hall of Records "Most Battles" uses the all-modes battle count.
 *
 * The ranking itself runs in SQL (`getTopRobotIdsByAllModesBattleCount`, pinned
 * in allModesBattleCount.test.ts and executed in tests/integration/
 * mostBattlesAllModes.test.ts). This suite pins how `fetchCareerRecords` uses
 * it: ranked order kept, value from the shared batch helper, one batch call.
 */
const mockRobotFindMany = jest.fn();
const mockQueryRaw = jest.fn();
const mockTopIds = jest.fn();
const mockAllModesCounts = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    robot: { findMany: (...args: unknown[]) => mockRobotFindMany(...args) },
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

jest.mock('../../robot/all-modes-battle-count', () => ({
  getTopRobotIdsByAllModesBattleCount: (...args: unknown[]) => mockTopIds(...args),
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
  mockRobotFindMany.mockImplementation(async (args: { where?: { id?: { in: number[] } } }) => {
    const ids = args.where?.id?.in;
    if (!ids) return [];
    return [...ids].reverse().map((id) => ROBOTS.get(id)).filter(Boolean);
  });
  // Robot 2 has fewer win/loss-mode battles but 500 KotH/Grand Melee matches.
  mockTopIds.mockResolvedValue([2, 1, 3]);
  mockAllModesCounts.mockImplementation(async (robots: Array<{ id: number; totalBattles: number }>) =>
    new Map(robots.map((r) => [r.id, r.id === 2 ? 600 : r.totalBattles])));
});

describe('fetchCareerRecords().mostBattles', () => {
  it('keeps the SQL rank order even when the robots load in another order', async () => {
    const { mostBattles } = await fetchCareerRecords();
    expect(mostBattles.map((e) => e.robotId)).toEqual([2, 1, 3]);
  });

  it('asks for the top 10 and loads exactly those robots', async () => {
    await fetchCareerRecords();
    expect(mockTopIds).toHaveBeenCalledWith(10);
    expect(mockRobotFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [2, 1, 3] } } }));
  });

  it('reports the all-modes count from one batch-helper call (no N+1)', async () => {
    const { mostBattles } = await fetchCareerRecords();

    expect(mockAllModesCounts).toHaveBeenCalledTimes(1);
    expect(mostBattles.map((e) => e.allModesBattleCount)).toEqual([600, 400, 50]);
  });

  it('keeps W/L/D and win rate on the win/loss-mode counters', async () => {
    const { mostBattles } = await fetchCareerRecords();

    expect(mostBattles[0]).toMatchObject({ totalBattles: 100, wins: 60, losses: 40, draws: 0, winRate: 60 });
  });

  it('skips a ranked id whose robot vanished between the two queries', async () => {
    mockTopIds.mockResolvedValue([2, 99, 1]);
    const { mostBattles } = await fetchCareerRecords();
    expect(mostBattles.map((e) => e.robotId)).toEqual([2, 1]);
  });
});
