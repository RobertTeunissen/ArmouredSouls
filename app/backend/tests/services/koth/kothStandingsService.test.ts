/**
 * Unit tests for KotH Standings Service.
 */

const mockStandingCount = jest.fn();
const mockStandingFindMany = jest.fn();
const mockScheduledMatchCount = jest.fn();
const mockRobotFindMany = jest.fn();
const mockSubscriptionFindMany = jest.fn();

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    standing: {
      count: (...args: unknown[]) => mockStandingCount(...args),
      findMany: (...args: unknown[]) => mockStandingFindMany(...args),
    },
    scheduledMatch: {
      count: (...args: unknown[]) => mockScheduledMatchCount(...args),
    },
    robot: {
      findMany: (...args: unknown[]) => mockRobotFindMany(...args),
    },
    subscription: {
      findMany: (...args: unknown[]) => mockSubscriptionFindMany(...args),
    },
  },
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { getKothStandings } from '../../../src/services/koth/kothStandingsService';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getKothStandings', () => {
  it('should return standings with pagination', async () => {
    mockScheduledMatchCount.mockResolvedValue(10);
    mockStandingCount.mockResolvedValue(3);
    mockStandingFindMany.mockResolvedValue([
      { entityId: 1, leaguePoints: 50, totalMatches: 10, totalKills: 5, totalZoneScore: 200, totalZoneTime: 100, bestPlacement: 1, bestWinStreak: 3, wins: 4, tier: 'bronze', leagueInstanceId: 'bronze_1' },
      { entityId: 2, leaguePoints: 30, totalMatches: 8, totalKills: 2, totalZoneScore: 100, totalZoneTime: 50, bestPlacement: 2, bestWinStreak: 1, wins: 2, tier: 'bronze', leagueInstanceId: 'bronze_1' },
    ]);
    mockRobotFindMany.mockResolvedValue([
      { id: 1, name: 'Killer Bot', user: { id: 10, username: 'player1', stableName: 'Iron Forge' } },
      { id: 2, name: 'Tank Bot', user: { id: 11, username: 'player2', stableName: 'Steel Works' } },
    ]);
    mockSubscriptionFindMany.mockResolvedValue([{ robotId: 1 }]);

    const result = await getKothStandings({ view: 'all_time', page: 1, limit: 10 });

    expect(result.standings).toHaveLength(2);
    expect(result.standings[0]).toMatchObject({
      rank: 1,
      robotId: 1,
      robotName: 'Killer Bot',
      owner: 'Iron Forge',
      kothPoints: 50,
      kothMatches: 10,
      kothWins: 4,
      isSubscribed: true,
    });
    expect(result.standings[1]).toMatchObject({
      rank: 2,
      robotId: 2,
      robotName: 'Tank Bot',
      isSubscribed: false,
    });
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 3,
      totalPages: 1,
    });
    expect(result.summary.totalEvents).toBe(10);
    expect(result.summary.uniqueParticipants).toBe(3);
  });

  it('should handle empty standings', async () => {
    mockScheduledMatchCount.mockResolvedValue(0);
    mockStandingCount.mockResolvedValue(0);
    mockStandingFindMany.mockResolvedValue([]);
    mockRobotFindMany.mockResolvedValue([]);
    mockSubscriptionFindMany.mockResolvedValue([]);

    const result = await getKothStandings({ view: 'all_time', page: 1, limit: 10 });

    expect(result.standings).toHaveLength(0);
    expect(result.summary.topRobot).toBeNull();
  });

  it('should calculate winRate and avgZoneScore', async () => {
    mockScheduledMatchCount.mockResolvedValue(5);
    mockStandingCount.mockResolvedValue(1);
    mockStandingFindMany.mockResolvedValue([
      { entityId: 1, leaguePoints: 20, totalMatches: 4, totalKills: 3, totalZoneScore: 200, totalZoneTime: 80, bestPlacement: 2, bestWinStreak: 2, wins: 2, tier: 'silver', leagueInstanceId: 'silver_1' },
    ]);
    mockRobotFindMany.mockResolvedValue([
      { id: 1, name: 'Bot', user: { id: 1, username: 'p', stableName: 'S' } },
    ]);
    mockSubscriptionFindMany.mockResolvedValue([]);

    const result = await getKothStandings({ view: 'all_time', page: 1, limit: 10 });

    expect(result.standings[0].winRate).toBe(50); // 2/4 * 100
    expect(result.standings[0].avgZoneScore).toBe(50); // 200/4
  });

  it('should filter by tier when provided', async () => {
    mockScheduledMatchCount.mockResolvedValue(5);
    mockStandingCount.mockResolvedValue(0);
    mockStandingFindMany.mockResolvedValue([]);
    mockRobotFindMany.mockResolvedValue([]);
    mockSubscriptionFindMany.mockResolvedValue([]);

    await getKothStandings({ view: 'all_time', page: 1, limit: 10, tier: 'gold' });

    expect(mockStandingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tier: 'gold' }),
      }),
    );
  });

  it('should filter by instance when provided', async () => {
    mockScheduledMatchCount.mockResolvedValue(5);
    mockStandingCount.mockResolvedValue(0);
    mockStandingFindMany.mockResolvedValue([]);
    mockRobotFindMany.mockResolvedValue([]);
    mockSubscriptionFindMany.mockResolvedValue([]);

    await getKothStandings({ view: 'all_time', page: 1, limit: 10, instance: 'silver_2' });

    expect(mockStandingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ leagueInstanceId: 'silver_2' }),
      }),
    );
  });

  it('should handle page 2 with correct rank offset', async () => {
    mockScheduledMatchCount.mockResolvedValue(20);
    mockStandingCount.mockResolvedValue(15);
    mockStandingFindMany.mockResolvedValue([
      { entityId: 11, leaguePoints: 10, totalMatches: 5, totalKills: 1, totalZoneScore: 50, totalZoneTime: 20, bestPlacement: 4, bestWinStreak: 0, wins: 0, tier: 'bronze', leagueInstanceId: 'bronze_1' },
    ]);
    mockRobotFindMany.mockResolvedValue([
      { id: 11, name: 'Page2Bot', user: { id: 1, username: 'p', stableName: null } },
    ]);
    mockSubscriptionFindMany.mockResolvedValue([]);

    const result = await getKothStandings({ view: 'all_time', page: 2, limit: 10 });

    // Rank should be 11 (page 2, first entry = (2-1)*10 + 1)
    expect(result.standings[0].rank).toBe(11);
    // Owner should fall back to username when stableName is null
    expect(result.standings[0].owner).toBe('p');
  });
});
