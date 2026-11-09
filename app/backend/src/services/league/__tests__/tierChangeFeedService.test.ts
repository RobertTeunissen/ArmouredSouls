/**
 * Unit tests for the dashboard tier-change feed (moved out of routes/leagues.ts).
 */

const mockHistoryFindMany = jest.fn();
const mockStandingFindMany = jest.fn();
const mockRobotFindMany = jest.fn();
const mockTeamFindMany = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    leagueHistory: { findMany: (...args: unknown[]) => mockHistoryFindMany(...args) },
    standing: { findMany: (...args: unknown[]) => mockStandingFindMany(...args) },
    robot: { findMany: (...args: unknown[]) => mockRobotFindMany(...args) },
    teamBattle: { findMany: (...args: unknown[]) => mockTeamFindMany(...args) },
  },
}));

import { getRecentTierChanges } from '../tierChangeFeedService';

const createdAt = new Date('2026-11-09T10:00:00.000Z');

function change(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    entityType: 'robot',
    entityId: 5,
    changeType: 'promotion',
    sourceTier: 'bronze',
    destinationTier: 'silver',
    destinationLeagueId: 'silver_1',
    leaguePoints: 30,
    mode: 'league_1v1',
    createdAt,
    ...overrides,
  };
}

describe('getRecentTierChanges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStandingFindMany.mockResolvedValue([]);
    mockRobotFindMany.mockResolvedValue([{ id: 5, name: 'Alpha' }]);
    mockTeamFindMany.mockResolvedValue([]);
  });

  it('reads the last 24 hours for the stable, newest first, at most 20', async () => {
    mockHistoryFindMany.mockResolvedValue([]);
    const before = Date.now();
    await expect(getRecentTierChanges(9)).resolves.toEqual([]);
    const query = mockHistoryFindMany.mock.calls[0][0] as { where: { userId: number; createdAt: { gt: Date } }; take: number };
    expect(query.where.userId).toBe(9);
    expect(before - query.where.createdAt.gt.getTime()).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
    expect(query.take).toBe(20);
    expect(mockStandingFindMany).not.toHaveBeenCalled();
  });

  it('names the entity and drops duplicates of the same change in the same mode', async () => {
    mockHistoryFindMany.mockResolvedValue([change(1), change(2), change(3, { mode: 'koth' })]);
    const changes = await getRecentTierChanges(9);
    expect(changes.map((c) => [c.id, c.entityName, c.mode])).toEqual([
      [1, 'Alpha', 'league_1v1'],
      [3, 'Alpha', 'koth'],
    ]);
    expect(changes[0].createdAt).toBe(createdAt.toISOString());
  });

  it('falls back to the standing that matches a legacy record without a mode', async () => {
    mockHistoryFindMany.mockResolvedValue([change(1, { mode: null })]);
    mockStandingFindMany.mockResolvedValue([
      { entityId: 5, entityType: 'robot', mode: 'league_1v1', tier: 'bronze', leagueInstanceId: 'bronze_1' },
      { entityId: 5, entityType: 'robot', mode: 'grand_melee', tier: 'silver', leagueInstanceId: 'silver_1' },
    ]);
    const [entry] = await getRecentTierChanges(9);
    expect(entry.mode).toBe('grand_melee');
  });

  it('labels team battles with their size and unknown entities by id', async () => {
    mockHistoryFindMany.mockResolvedValue([
      change(1, { entityType: 'team_battle', entityId: 7, mode: 'league_2v2' }),
      change(2, { entityType: 'robot', entityId: 99 }),
    ]);
    mockTeamFindMany.mockResolvedValue([{ id: 7, teamName: 'Iron Duo', teamSize: 2 }]);
    mockRobotFindMany.mockResolvedValue([]);
    const changes = await getRecentTierChanges(9);
    expect(changes.map((c) => c.entityName)).toEqual(['Iron Duo (2v2)', 'Robot #99']);
  });
});
