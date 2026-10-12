/**
 * #532 — the public stable view carries the all-modes battle count per robot.
 */
const mockUserFindUnique = jest.fn();
const mockQueryRaw = jest.fn();
const mockStandingFindMany = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    standing: { findMany: (...args: unknown[]) => mockStandingFindMany(...args) },
  },
}));

jest.mock('../../achievement', () => ({
  achievementService: { getStableAchievements: jest.fn().mockResolvedValue([]) },
}));

import { getStableProfile } from '../stableViewService';

beforeEach(() => {
  jest.clearAllMocks();
  mockUserFindUnique.mockResolvedValue({
    id: 9,
    username: 'arena04',
    stableName: 'Arena 04',
    stableType: 'human',
    prestige: 0,
    championshipTitles: 0,
    championshipTitles1v1: 0,
    championshipTitles2v2: 0,
    championshipTitles3v3: 0,
    robots: [
      { id: 1, name: 'Wattage', elo: 1300, totalBattles: 211 },
      { id: 2, name: 'Spark', elo: 1200, totalBattles: 5 },
    ],
    facilities: [],
    teamBattles: [],
  });
  mockQueryRaw.mockResolvedValue([{ wins: BigInt(3), losses: BigInt(2), draws: BigInt(0) }]);
  mockStandingFindMany.mockImplementation(async (args: { where: { mode: { in: string[] } } }) => {
    const rows = [
      { entityId: 1, mode: 'koth', totalMatches: 68 },
      { entityId: 1, mode: 'grand_melee', totalMatches: 1 },
    ];
    return rows
      .filter((r) => args.where.mode.in.includes(r.mode))
      .map(({ entityId, totalMatches }) => ({ entityId, totalMatches }));
  });
});

describe('getStableProfile allModesBattleCount (#532)', () => {
  it('adds KotH and Grand Melee matches to each robot', async () => {
    const profile = await getStableProfile(9);

    expect(profile?.robots.map((r) => [r.id, r.totalBattles, r.allModesBattleCount])).toEqual([
      [1, 211, 280],
      [2, 5, 5],
    ]);
  });

  it('leaves the stable-level W/L/D totals unchanged', async () => {
    const profile = await getStableProfile(9);

    expect(profile?.stats).toMatchObject({ totalBattles: 5, totalWins: 3, totalLosses: 2, totalDraws: 0 });
  });
});
