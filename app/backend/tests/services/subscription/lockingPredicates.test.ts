/**
 * Unit tests for lockingPredicates.ts
 *
 * Subscription locking model:
 * - Tournament: real lock (can't unsubscribe while alive in bracket)
 * - League 2v2: locked when robot's team has a scheduled 2v2 match
 * - League 3v3: locked when robot's team has a scheduled 3v3 match
 * - Tag Team: locked when robot's team has a scheduled tag_team match (matchMode='tag_team')
 * - League 1v1, KotH: no lock (always return false, unsubscribe is instant)
 *
 * _Requirements: R5.7, R3.7, R3.8, R3.9_
 */

// ── Mocks ────────────────────────────────────────────────────────────

const mockPrisma = {
  scheduledTournamentMatch: { count: jest.fn() },
  scheduledTeamBattleMatch: { count: jest.fn() },
  teamBattleMember: { findFirst: jest.fn(), findMany: jest.fn() },
  scheduledMatchParticipant: { findMany: jest.fn().mockResolvedValue([]) },
  standing: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
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
          participantType: 'robot',
          status: { in: ['pending', 'scheduled'] },
          tournament: { status: 'active' },
          OR: [{ participant1Id: 7 }, { participant2Id: 7 }],
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
    it('should return true when robot is on a team with a scheduled tag_team match', async () => {
      mockPrisma.teamBattleMember.findFirst.mockResolvedValue({ teamId: 100 });
      // schedulingService.getUpcomingForTeam queries scheduledMatchParticipant.findMany
      mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([
        { scheduledMatch: { id: 1, matchType: 'tag_team', status: 'scheduled', scheduledFor: new Date(), participants: [] } },
      ]);

      const result = await tagTeamLockingPredicate(15);

      expect(result).toBe(true);
      expect(mockPrisma.teamBattleMember.findFirst).toHaveBeenCalledWith({
        where: { robotId: 15, team: { teamSize: 2 } },
      });
    });

    it('should return false when robot is not a member of any teamSize=2 team', async () => {
      mockPrisma.teamBattleMember.findFirst.mockResolvedValue(null);

      const result = await tagTeamLockingPredicate(15);

      expect(result).toBe(false);
    });

    it('should return false when robot is on a team but no scheduled tag_team match exists', async () => {
      mockPrisma.teamBattleMember.findFirst.mockResolvedValue({ teamId: 200 });
      mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([]);

      const result = await tagTeamLockingPredicate(15);

      expect(result).toBe(false);
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
      mockPrisma.teamBattleMember.findFirst.mockResolvedValue({ teamId: 10 });
      mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([
        { scheduledMatch: { id: 1, matchType: 'league_2v2', status: 'scheduled', scheduledFor: new Date(), participants: [] } },
      ]);

      const result = await league2v2LockingPredicate(10);

      expect(result).toBe(true);
    });

    it('should return false when robot has no scheduled 2v2 match', async () => {
      mockPrisma.teamBattleMember.findFirst.mockResolvedValue({ teamId: 10 });
      mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([]);

      const result = await league2v2LockingPredicate(10);

      expect(result).toBe(false);
    });

    it('should return false when robot is not a member of any team', async () => {
      mockPrisma.teamBattleMember.findFirst.mockResolvedValue(null);

      const result = await league2v2LockingPredicate(5);

      expect(result).toBe(false);
    });
  });

  describe('league3v3LockingPredicate', () => {
    it('should return true when robot has a scheduled 3v3 match', async () => {
      mockPrisma.teamBattleMember.findFirst.mockResolvedValue({ teamId: 20 });
      mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([
        { scheduledMatch: { id: 2, matchType: 'league_3v3', status: 'scheduled', scheduledFor: new Date(), participants: [] } },
      ]);

      const result = await league3v3LockingPredicate(20);

      expect(result).toBe(true);
    });

    it('should return false when robot has no scheduled 3v3 match', async () => {
      mockPrisma.teamBattleMember.findFirst.mockResolvedValue({ teamId: 20 });
      mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([]);

      const result = await league3v3LockingPredicate(20);

      expect(result).toBe(false);
    });

    it('should return false when robot is not a member of any team', async () => {
      mockPrisma.teamBattleMember.findFirst.mockResolvedValue(null);

      const result = await league3v3LockingPredicate(8);

      expect(result).toBe(false);
    });
  });
});
