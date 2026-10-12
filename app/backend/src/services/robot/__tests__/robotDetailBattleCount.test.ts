/**
 * #532 — the robot detail payload carries the all-modes battle count.
 *
 * allModesBattleCount = robots.total_battles + KotH + Grand Melee standings
 * matches. totalBattles itself is unchanged (it is the W/L/D denominator).
 */
const mockRobotFindUnique = jest.fn();
const mockStandingFindFirst = jest.fn();
const mockStandingFindMany = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    robot: { findUnique: (...args: unknown[]) => mockRobotFindUnique(...args) },
    standing: {
      findFirst: (...args: unknown[]) => mockStandingFindFirst(...args),
      findMany: (...args: unknown[]) => mockStandingFindMany(...args),
    },
  },
}));

jest.mock('../../scheduling/schedulingService', () => ({
  __esModule: true,
  default: { getUpcomingForRobot: jest.fn() },
}));

import { findRobotById } from '../robotQueryService';

const ROBOT = { id: 1, userId: 9, name: 'Wattage', totalBattles: 211, wins: 71, losses: 63, draws: 77 };

beforeEach(() => {
  jest.clearAllMocks();
  mockRobotFindUnique.mockResolvedValue(ROBOT);
  mockStandingFindMany.mockResolvedValue([
    { entityId: 1, totalMatches: 68 },
    { entityId: 1, totalMatches: 1 },
  ]);
});

describe('findRobotById allModesBattleCount (#532)', () => {
  it('adds KotH and Grand Melee matches when the robot has a league standing', async () => {
    mockStandingFindFirst.mockResolvedValue({
      leaguePoints: 10, wins: 34, losses: 34, draws: 2, tier: 'bronze', leagueInstanceId: 'bronze_1',
      cyclesInTier: 3, currentWinStreak: 0, bestWinStreak: 4, currentLoseStreak: 1,
    });

    const result = await findRobotById(ROBOT.id);

    expect(result).toMatchObject({ totalBattles: 211, allModesBattleCount: 280, leaguePoints: 10 });
  });

  it('adds KotH and Grand Melee matches when the robot has no league standing', async () => {
    mockStandingFindFirst.mockResolvedValue(null);

    const result = await findRobotById(ROBOT.id);

    expect(result).toMatchObject({ totalBattles: 211, allModesBattleCount: 280 });
    expect(mockStandingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ mode: { in: ['koth', 'grand_melee'] } }),
      }),
    );
  });

  it('returns null for a missing robot without querying standings', async () => {
    mockRobotFindUnique.mockResolvedValue(null);

    await expect(findRobotById(404)).resolves.toBeNull();
    expect(mockStandingFindMany).not.toHaveBeenCalled();
  });
});
