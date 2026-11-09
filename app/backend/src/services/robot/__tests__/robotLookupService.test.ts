/**
 * Unit tests for robotLookupService: the small robot reads behind the robot
 * routes (moved out of routes/robots.ts).
 */

const mockRobotFindUnique = jest.fn();
const mockStandingFindFirst = jest.fn();
const mockCycleFindUnique = jest.fn();
const mockGetModeKills = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    robot: { findUnique: (...args: unknown[]) => mockRobotFindUnique(...args) },
    standing: { findFirst: (...args: unknown[]) => mockStandingFindFirst(...args) },
    cycleMetadata: { findUnique: (...args: unknown[]) => mockCycleFindUnique(...args) },
  },
}));

jest.mock('../../battle/modeKillsQueries', () => ({
  getModeKills: (...args: unknown[]) => mockGetModeKills(...args),
}));

import {
  getEventLogCycleNumber,
  getRobotPlacementStanding,
  requireRobotRef,
} from '../robotLookupService';

describe('robotLookupService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requireRobotRef', () => {
    it('returns id, name and owner', async () => {
      mockRobotFindUnique.mockResolvedValue({ id: 5, name: 'Alpha', userId: 9 });
      await expect(requireRobotRef(5)).resolves.toEqual({ id: 5, name: 'Alpha', userId: 9 });
      expect(mockRobotFindUnique).toHaveBeenCalledWith({ where: { id: 5 }, select: { id: true, name: true, userId: true } });
    });

    it('throws ROBOT_NOT_FOUND (404) for a missing robot', async () => {
      mockRobotFindUnique.mockResolvedValue(null);
      await expect(requireRobotRef(5)).rejects.toMatchObject({ statusCode: 404, message: 'Robot not found' });
    });
  });

  describe('getRobotPlacementStanding', () => {
    it('maps the standing and adds the mode\'s kills', async () => {
      mockRobotFindUnique.mockResolvedValue({ id: 5, name: 'Alpha', userId: 9 });
      mockStandingFindFirst.mockResolvedValue({
        tier: 'silver', leagueInstanceId: 'silver_1', leaguePoints: 12, wins: 3, totalMatches: 8,
        bestPlacement: 1, currentWinStreak: 2, bestWinStreak: 4, losses: 5,
      });
      mockGetModeKills.mockResolvedValue(6);

      await expect(getRobotPlacementStanding(5, 'koth')).resolves.toEqual({
        tier: 'silver', leagueInstanceId: 'silver_1', leaguePoints: 12, wins: 3, totalMatches: 8,
        totalKills: 6, bestPlacement: 1, currentWinStreak: 2, bestWinStreak: 4,
      });
      expect(mockStandingFindFirst).toHaveBeenCalledWith({ where: { entityType: 'robot', entityId: 5, mode: 'koth' } });
      expect(mockGetModeKills).toHaveBeenCalledWith(5, 'koth');
    });

    it('is null for a robot that never entered the mode', async () => {
      mockRobotFindUnique.mockResolvedValue({ id: 5, name: 'Alpha', userId: 9 });
      mockStandingFindFirst.mockResolvedValue(null);
      mockGetModeKills.mockResolvedValue(0);
      await expect(getRobotPlacementStanding(5, 'grand_melee')).resolves.toBeNull();
    });

    it('is a 404 for a missing robot', async () => {
      mockRobotFindUnique.mockResolvedValue(null);
      await expect(getRobotPlacementStanding(5, 'koth')).rejects.toMatchObject({ statusCode: 404 });
      expect(mockStandingFindFirst).not.toHaveBeenCalled();
    });
  });

  it('getEventLogCycleNumber is completed cycles + 1', async () => {
    mockCycleFindUnique.mockResolvedValue({ totalCycles: 41 });
    await expect(getEventLogCycleNumber()).resolves.toBe(42);
    mockCycleFindUnique.mockResolvedValue(null);
    await expect(getEventLogCycleNumber()).resolves.toBe(1);
  });
});
