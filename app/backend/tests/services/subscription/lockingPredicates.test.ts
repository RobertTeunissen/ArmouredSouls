/**
 * Unit tests for lockingPredicates.ts
 *
 * Two-state subscription model:
 * - Tournament: real lock (can't unsubscribe while alive in bracket)
 * - League, Tag Team, KotH: no lock (always return false, unsubscribe is instant)
 *
 * _Requirements: R5.7_
 */

// ── Mocks ────────────────────────────────────────────────────────────

const mockPrisma = {
  scheduledTournamentMatch: { count: jest.fn() },
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
});
