/**
 * Unit tests for leagueHistoryService name enrichment.
 *
 * Verifies that getHistoryByCycleRange and getEntityHistory populate
 * the optional `entityName` and `stableName` fields by joining with
 * Robot, TagTeam, and User. Covers:
 *
 * - Robot rows pick up `Robot.name`.
 * - Tag team rows render as "<active> & <reserve>".
 * - `stableName` falls back to `username` when `User.stableName` is null.
 * - Mixed entity types in a single result set are batched (one findMany
 *   per entity type, no N+1).
 * - Missing related rows leave `entityName` undefined without throwing.
 */

// ── Mocks (must come before imports) ────────────────────────────────

const mockPrisma = {
  leagueHistory: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  robot: {
    findMany: jest.fn(),
  },
  tagTeam: {
    findMany: jest.fn(),
  },
  teamBattle: {
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
};

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import { getHistoryByCycleRange, getEntityHistory } from '../leagueHistoryService';

// ── Fixtures ────────────────────────────────────────────────────────

const baseRecord = {
  changeType: 'promotion',
  sourceTier: 'bronze',
  destinationTier: 'silver',
  sourceLeagueId: 'bronze_1',
  destinationLeagueId: 'silver_1',
  leaguePoints: 100,
  cycleNumber: 10,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.leagueHistory.count.mockResolvedValue(0);
  mockPrisma.robot.findMany.mockResolvedValue([]);
  mockPrisma.teamBattle.findMany.mockResolvedValue([]);
  mockPrisma.user.findMany.mockResolvedValue([]);
});

// ── Tests ───────────────────────────────────────────────────────────

describe('leagueHistoryService — name enrichment', () => {
  describe('getHistoryByCycleRange', () => {
    it('populates entityName from Robot.name and stableName from User.stableName', async () => {
      mockPrisma.leagueHistory.findMany.mockResolvedValue([
        { id: 1, entityType: 'robot', entityId: 5, userId: 10, ...baseRecord },
      ]);
      mockPrisma.leagueHistory.count.mockResolvedValue(1);
      mockPrisma.robot.findMany.mockResolvedValue([{ id: 5, name: 'Crusher' }]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 10, username: 'rob', stableName: 'Iron Stable' },
      ]);

      const result = await getHistoryByCycleRange({ startCycle: 1, endCycle: 100 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].entityName).toBe('Crusher');
      expect(result.data[0].stableName).toBe('Iron Stable');
    });

    it('falls back to username when User.stableName is null', async () => {
      mockPrisma.leagueHistory.findMany.mockResolvedValue([
        { id: 1, entityType: 'robot', entityId: 5, userId: 10, ...baseRecord },
      ]);
      mockPrisma.leagueHistory.count.mockResolvedValue(1);
      mockPrisma.robot.findMany.mockResolvedValue([{ id: 5, name: 'Crusher' }]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 10, username: 'rob', stableName: null },
      ]);

      const result = await getHistoryByCycleRange({ startCycle: 1, endCycle: 100 });

      expect(result.data[0].stableName).toBe('rob');
    });

    it('renders tag team entityName from teamName', async () => {
      mockPrisma.leagueHistory.findMany.mockResolvedValue([
        { id: 2, entityType: 'tag_team', entityId: 7, userId: 11, ...baseRecord },
      ]);
      mockPrisma.leagueHistory.count.mockResolvedValue(1);
      mockPrisma.teamBattle.findMany.mockResolvedValue([
        {
          id: 7,
          teamName: 'Hammer & Anvil',
        },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 11, username: 'lia', stableName: 'Forge' },
      ]);

      const result = await getHistoryByCycleRange({ startCycle: 1, endCycle: 100 });

      expect(result.data[0].entityName).toBe('Hammer & Anvil');
      expect(result.data[0].stableName).toBe('Forge');
    });

    it('batches lookups for mixed robot/tag-team rows (one findMany per type)', async () => {
      mockPrisma.leagueHistory.findMany.mockResolvedValue([
        { id: 1, entityType: 'robot', entityId: 5, userId: 10, ...baseRecord },
        { id: 2, entityType: 'robot', entityId: 6, userId: 10, ...baseRecord },
        { id: 3, entityType: 'tag_team', entityId: 7, userId: 11, ...baseRecord },
        { id: 4, entityType: 'tag_team', entityId: 8, userId: 11, ...baseRecord },
      ]);
      mockPrisma.leagueHistory.count.mockResolvedValue(4);
      mockPrisma.robot.findMany.mockResolvedValue([
        { id: 5, name: 'Crusher' },
        { id: 6, name: 'Wrecker' },
      ]);
      mockPrisma.teamBattle.findMany.mockResolvedValue([
        { id: 7, teamName: 'Hammer & Anvil' },
        { id: 8, teamName: 'Spike & Coil' },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 10, username: 'rob', stableName: 'Iron Stable' },
        { id: 11, username: 'lia', stableName: 'Forge' },
      ]);

      const result = await getHistoryByCycleRange({ startCycle: 1, endCycle: 100 });

      // One call per entity type — no N+1
      expect(mockPrisma.robot.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.teamBattle.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(1);

      // findMany was called with the deduped id sets
      expect(mockPrisma.robot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: expect.arrayContaining([5, 6]) } },
        }),
      );
      expect(mockPrisma.teamBattle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: expect.arrayContaining([7, 8]) } },
        }),
      );
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: expect.arrayContaining([10, 11]) } },
        }),
      );

      expect(result.data.map(r => r.entityName)).toEqual([
        'Crusher',
        'Wrecker',
        'Hammer & Anvil',
        'Spike & Coil',
      ]);
    });

    it('leaves entityName undefined when the related row is missing', async () => {
      mockPrisma.leagueHistory.findMany.mockResolvedValue([
        { id: 1, entityType: 'robot', entityId: 999, userId: 10, ...baseRecord },
      ]);
      mockPrisma.leagueHistory.count.mockResolvedValue(1);
      // robot.findMany returns nothing — robot was deleted
      mockPrisma.robot.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 10, username: 'rob', stableName: 'Iron Stable' },
      ]);

      const result = await getHistoryByCycleRange({ startCycle: 1, endCycle: 100 });

      expect(result.data[0].entityName).toBeUndefined();
      expect(result.data[0].stableName).toBe('Iron Stable');
    });

    it('skips enrichment queries entirely when there are no records', async () => {
      mockPrisma.leagueHistory.findMany.mockResolvedValue([]);
      mockPrisma.leagueHistory.count.mockResolvedValue(0);

      const result = await getHistoryByCycleRange({ startCycle: 1, endCycle: 100 });

      expect(result.data).toEqual([]);
      expect(mockPrisma.robot.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.teamBattle.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getEntityHistory', () => {
    it('populates entityName and stableName for each row', async () => {
      mockPrisma.leagueHistory.findMany.mockResolvedValue([
        { id: 1, entityType: 'robot', entityId: 5, userId: 10, ...baseRecord, cycleNumber: 5 },
        { id: 2, entityType: 'robot', entityId: 5, userId: 10, ...baseRecord, cycleNumber: 12 },
      ]);
      mockPrisma.robot.findMany.mockResolvedValue([{ id: 5, name: 'Crusher' }]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 10, username: 'rob', stableName: 'Iron Stable' },
      ]);

      const records = await getEntityHistory('robot', 5);

      expect(records).toHaveLength(2);
      records.forEach(r => {
        expect(r.entityName).toBe('Crusher');
        expect(r.stableName).toBe('Iron Stable');
      });
    });
  });
});
