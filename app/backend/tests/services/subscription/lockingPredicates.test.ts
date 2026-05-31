/**
 * Unit tests for lockingPredicates.ts
 *
 * Subscription locking model:
 * - Tournament: real lock (can't unsubscribe while alive in bracket)
 * - League 2v2: locked when robot's team has a scheduled 2v2 match
 * - League 3v3: locked when robot's team has a scheduled 3v3 match
 * - League 1v1, Tag Team, KotH: no lock (always return false, unsubscribe is instant)
 *
 * _Requirements: R5.7, R3.7, R3.8, R3.9_
 */

// ── Mocks ────────────────────────────────────────────────────────────

const mockPrisma = {
  scheduledTournamentMatch: { count: jest.fn() },
  scheduledTeamBattleMatch: { count: jest.fn() },
};

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import {
  leagueLockingPredicate,
  tournamentLockingPredicate,
  tagTeamLockingPredicate,
  kothLockingPredicate,
  league2v2LockingPredicate,
  league3v3LockingPredicate,
} from '../../../src/services/subscription/lockingPredicates';

// ── Tests ────────────────────────────────────────────────────────────

describe('lockingPredicates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('leagueLockingPredicate', () => {
    it('should always return false (no lock for league)', async () => {
      const result = await leagueLockingPredicate(42);
      expect(result).toBe(false);
    });

    it('should not query the database', async () => {
      await leagueLockingPredicate(42);
      expect(mockPrisma.scheduledTournamentMatch.count).not.toHaveBeenCalled();
    });
  });

  describe('tournamentLockingPredicate', () => {
    it('should return true when robot is alive in active bracket', async () => {
      mockPrisma.scheduledTournamentMatch.count.mockResolvedValue(1);

      const result = await tournamentLockingPredicate(7);

      expect(result).toBe(true);
      expect(mockPrisma.scheduledTournamentMatch.count).toHaveBeenCalledWith({
        where: {
          status: { in: ['pending', 'scheduled'] },
          tournament: { status: 'active' },
          OR: [{ robot1Id: 7 }, { robot2Id: 7 }],
          winnerId: null,
        },
      });
    });

    it('should return false when robot is not in active bracket', async () => {
      mockPrisma.scheduledTournamentMatch.count.mockResolvedValue(0);

      const result = await tournamentLockingPredicate(7);

      expect(result).toBe(false);
    });
  });

  describe('tagTeamLockingPredicate', () => {
    it('should always return false (no lock for tag team)', async () => {
      const result = await tagTeamLockingPredicate(15);
      expect(result).toBe(false);
    });

    it('should not query the database', async () => {
      await tagTeamLockingPredicate(15);
      expect(mockPrisma.scheduledTournamentMatch.count).not.toHaveBeenCalled();
    });
  });

  describe('kothLockingPredicate', () => {
    it('should always return false (no lock for KotH)', async () => {
      const result = await kothLockingPredicate(33);
      expect(result).toBe(false);
    });

    it('should not query the database', async () => {
      await kothLockingPredicate(33);
      expect(mockPrisma.scheduledTournamentMatch.count).not.toHaveBeenCalled();
    });
  });

  describe('league2v2LockingPredicate', () => {
    it('should return true when robot has a scheduled 2v2 match', async () => {
      mockPrisma.scheduledTeamBattleMatch.count.mockResolvedValue(1);

      const result = await league2v2LockingPredicate(10);

      expect(result).toBe(true);
      expect(mockPrisma.scheduledTeamBattleMatch.count).toHaveBeenCalledWith({
        where: {
          status: 'scheduled',
          teamSize: 2,
          OR: [
            { team1: { members: { some: { robotId: 10 } } } },
            { team2: { members: { some: { robotId: 10 } } } },
          ],
        },
      });
    });

    it('should return false when robot has no scheduled 2v2 match', async () => {
      mockPrisma.scheduledTeamBattleMatch.count.mockResolvedValue(0);

      const result = await league2v2LockingPredicate(10);

      expect(result).toBe(false);
    });

    it('should query with teamSize 2 (not 3)', async () => {
      mockPrisma.scheduledTeamBattleMatch.count.mockResolvedValue(0);

      await league2v2LockingPredicate(5);

      const callArgs = mockPrisma.scheduledTeamBattleMatch.count.mock.calls[0][0];
      expect(callArgs.where.teamSize).toBe(2);
    });
  });

  describe('league3v3LockingPredicate', () => {
    it('should return true when robot has a scheduled 3v3 match', async () => {
      mockPrisma.scheduledTeamBattleMatch.count.mockResolvedValue(1);

      const result = await league3v3LockingPredicate(20);

      expect(result).toBe(true);
      expect(mockPrisma.scheduledTeamBattleMatch.count).toHaveBeenCalledWith({
        where: {
          status: 'scheduled',
          teamSize: 3,
          OR: [
            { team1: { members: { some: { robotId: 20 } } } },
            { team2: { members: { some: { robotId: 20 } } } },
          ],
        },
      });
    });

    it('should return false when robot has no scheduled 3v3 match', async () => {
      mockPrisma.scheduledTeamBattleMatch.count.mockResolvedValue(0);

      const result = await league3v3LockingPredicate(20);

      expect(result).toBe(false);
    });

    it('should query with teamSize 3 (not 2)', async () => {
      mockPrisma.scheduledTeamBattleMatch.count.mockResolvedValue(0);

      await league3v3LockingPredicate(8);

      const callArgs = mockPrisma.scheduledTeamBattleMatch.count.mock.calls[0][0];
      expect(callArgs.where.teamSize).toBe(3);
    });
  });
});
