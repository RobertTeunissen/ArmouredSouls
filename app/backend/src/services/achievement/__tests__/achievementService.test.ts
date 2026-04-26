/**
 * Unit tests for AchievementService.
 *
 * Tests the core checkAndAward method, trigger evaluation helpers,
 * updatePinnedAchievements, getRarityLabel, and refreshRarityCache.
 *
 * All external dependencies (Prisma, logger, robotCalculations) are mocked
 * so these run fast without a DB. Follows the same mocking pattern used
 * in app/backend/tests/battlePostCombat.test.ts.
 */

// ─── Mocks (must be before imports) ──────────────────────────────────

const mockPrisma = {
  userAchievement: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  user: {
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
  },
  robot: {
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
  weaponInventory: {
    count: jest.fn().mockResolvedValue(0),
  },
  facility: {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
  },
  tuningAllocation: {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
  },
  battleParticipant: {
    aggregate: jest.fn().mockResolvedValue({ _sum: { credits: 0, streamingRevenue: 0 } }),
    count: jest.fn().mockResolvedValue(0),
  },
  $queryRawUnsafe: jest.fn().mockResolvedValue([{ count: BigInt(0) }]),
  $executeRawUnsafe: jest.fn().mockResolvedValue(0),
};

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../utils/robotCalculations', () => ({
  calculateEffectiveStatsWithStance: jest.fn().mockReturnValue({}),
}));

// ─── Imports (after mocks) ───────────────────────────────────────────

import { achievementService, getRarityLabel } from '../achievementService';
import type { AchievementEvent } from '../achievementService';
import { AchievementError, AchievementErrorCode } from '../../../errors/achievementErrors';

// ─── Test Helpers ────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Reset default mock implementations
  mockPrisma.userAchievement.findMany.mockResolvedValue([]);
  mockPrisma.userAchievement.create.mockResolvedValue({});
  mockPrisma.userAchievement.count.mockResolvedValue(0);
  mockPrisma.userAchievement.groupBy.mockResolvedValue([]);
  mockPrisma.user.findUnique.mockResolvedValue(null);
  mockPrisma.user.update.mockResolvedValue({});
  mockPrisma.user.findMany.mockResolvedValue([]);
  mockPrisma.robot.findUnique.mockResolvedValue(null);
  mockPrisma.robot.findMany.mockResolvedValue([]);
  mockPrisma.robot.count.mockResolvedValue(0);
  mockPrisma.weaponInventory.count.mockResolvedValue(0);
  mockPrisma.facility.count.mockResolvedValue(0);
  mockPrisma.facility.findMany.mockResolvedValue([]);
  mockPrisma.tuningAllocation.count.mockResolvedValue(0);
  mockPrisma.tuningAllocation.findMany.mockResolvedValue([]);
  mockPrisma.battleParticipant.aggregate.mockResolvedValue({ _sum: { credits: 0, streamingRevenue: 0 } });
  mockPrisma.battleParticipant.count.mockResolvedValue(0);
  mockPrisma.$queryRawUnsafe.mockResolvedValue([{ count: BigInt(0) }]);
  mockPrisma.$executeRawUnsafe.mockResolvedValue(0);
});

// ─── Tests: checkAndAward ────────────────────────────────────────────

describe('AchievementService.checkAndAward', () => {
  it('should return empty array when no achievements match the event trigger types', async () => {
    // 'stance_changed' maps to ['effective_stat'] — which requires DB queries
    // that return null/0 by default, so no achievements should match
    const event: AchievementEvent = {
      type: 'stance_changed',
      data: {},
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    expect(result).toEqual([]);
  });

  it('should skip already-unlocked achievements', async () => {
    // Mock that user already has C1 unlocked
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce([
      { achievementId: 'C1' },
      { achievementId: 'C2' },
      { achievementId: 'C3' },
      { achievementId: 'C4' },
      { achievementId: 'C5' },
      { achievementId: 'C6' },
      { achievementId: 'C7' },
      { achievementId: 'C8' },
    ]);

    // Mock robot with 1 win — would qualify for C1 if not already unlocked
    mockPrisma.robot.findUnique.mockResolvedValue({ wins: 1 });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, finalHpPercent: 50 },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    // C1 is already unlocked, so create should not be called for it
    // Other achievements may or may not qualify, but C1 should be skipped
    const createCalls = mockPrisma.userAchievement.create.mock.calls;
    const createdIds = createCalls.map((c: unknown[]) => (c[0] as { data: { achievementId: string } }).data.achievementId);
    expect(createdIds).not.toContain('C1');
  });

  it('should create UserAchievement record for qualifying achievement', async () => {
    // No existing unlocks
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce([]);

    // Robot with 1 win — qualifies for C1 ("I'll Be Back" — win 1 battle)
    mockPrisma.robot.findUnique.mockResolvedValue({ wins: 1, name: 'TestBot' });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, finalHpPercent: 50 },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    // Verify create was called with C1
    const createCalls = mockPrisma.userAchievement.create.mock.calls;
    const createdIds = createCalls.map((c: unknown[]) => (c[0] as { data: { achievementId: string } }).data.achievementId);
    expect(createdIds).toContain('C1');
  });

  it('should award credits and prestige via user.update', async () => {
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce([]);
    // Robot with 1 win — qualifies for C1 (easy tier: 25000 credits, 25 prestige)
    mockPrisma.robot.findUnique.mockResolvedValue({ wins: 1, name: 'TestBot' });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, finalHpPercent: 50 },
    };

    await achievementService.checkAndAward(1, 1, event);

    // Find the user.update call that awards C1 rewards
    const updateCalls = mockPrisma.user.update.mock.calls;
    const rewardCall = updateCalls.find(
      (c: unknown[]) => {
        const arg = c[0] as { data: { currency?: { increment: number } } };
        return arg.data.currency?.increment === 25_000;
      },
    );
    expect(rewardCall).toBeDefined();
    const rewardData = (rewardCall![0] as { data: { currency: { increment: number }; prestige: { increment: number } } }).data;
    expect(rewardData.currency).toEqual({ increment: 25_000 });
    expect(rewardData.prestige).toEqual({ increment: 25 });
  });

  it('should set robotId for robot-scope achievements', async () => {
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce([]);
    // C1 is robot-scope — should record robotId
    mockPrisma.robot.findUnique.mockResolvedValue({ wins: 1, name: 'TestBot' });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, finalHpPercent: 50 },
    };

    await achievementService.checkAndAward(1, 42, event);

    const createCalls = mockPrisma.userAchievement.create.mock.calls;
    const c1Call = createCalls.find(
      (c: unknown[]) => (c[0] as { data: { achievementId: string } }).data.achievementId === 'C1',
    );
    expect(c1Call).toBeDefined();
    expect((c1Call![0] as { data: { robotId: number | null } }).data.robotId).toBe(42);
  });

  it('should set null robotId for user-scope achievements', async () => {
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce([]);
    // E1 "Hello World" is user-scope, triggered by onboarding_complete
    mockPrisma.user.findUnique.mockResolvedValue({ hasCompletedOnboarding: true });

    const event: AchievementEvent = {
      type: 'onboarding_complete',
      data: {},
    };

    await achievementService.checkAndAward(1, 1, event);

    const createCalls = mockPrisma.userAchievement.create.mock.calls;
    const e1Call = createCalls.find(
      (c: unknown[]) => (c[0] as { data: { achievementId: string } }).data.achievementId === 'E1',
    );
    expect(e1Call).toBeDefined();
    // E1 is user-scope, so robotId should be null
    expect((e1Call![0] as { data: { robotId: number | null } }).data.robotId).toBeNull();
  });

  it('should return UnlockedAchievement array with correct shape', async () => {
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce([]);
    mockPrisma.robot.findUnique.mockResolvedValue({ wins: 1, name: 'TestBot' });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, finalHpPercent: 50 },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    // Should have at least C1 unlocked
    const c1 = result.find((a) => a.id === 'C1');
    expect(c1).toBeDefined();
    expect(c1).toEqual(
      expect.objectContaining({
        id: 'C1',
        name: "I'll Be Back",
        description: 'Win your first battle',
        tier: 'easy',
        rewardCredits: 25_000,
        rewardPrestige: 25,
        badgeIconFile: 'achievement-c1',
        robotId: 1,
        robotName: 'TestBot',
      }),
    );
  });

  it('should handle unique constraint violation (P2002) gracefully', async () => {
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce([]);
    mockPrisma.robot.findUnique.mockResolvedValue({ wins: 1, name: 'TestBot' });
    // Simulate P2002 unique constraint violation on create
    mockPrisma.userAchievement.create.mockRejectedValue({ code: 'P2002' });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, finalHpPercent: 50 },
    };

    // Should not throw — P2002 is handled gracefully
    const result = await achievementService.checkAndAward(1, 1, event);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return empty array on internal error', async () => {
    // Make findMany throw to simulate a DB error
    mockPrisma.userAchievement.findMany.mockRejectedValueOnce(new Error('DB connection lost'));

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true },
    };

    const result = await achievementService.checkAndAward(1, 1, event);
    expect(result).toEqual([]);
  });
});

// ─── Tests: Trigger Evaluation ───────────────────────────────────────

describe('AchievementService trigger evaluation', () => {
  it('should evaluate perfect_victory trigger correctly (won=true, finalHpPercent=100)', async () => {
    // Pre-unlock all achievements except C9 so only C9 is evaluated
    const allExceptC9 = (await import('../../../config/achievements')).ACHIEVEMENTS
      .filter((a) => a.id !== 'C9')
      .map((a) => ({ achievementId: a.id }));
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce(allExceptC9);

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, finalHpPercent: 100 },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    const c9 = result.find((a) => a.id === 'C9');
    expect(c9).toBeDefined();
    expect(c9!.name).toBe('Flawless Victory');
  });

  it('should evaluate low_hp_win trigger correctly (won=true, finalHpPercent=5)', async () => {
    // Pre-unlock all achievements except C10 so only C10 is evaluated
    const allExceptC10 = (await import('../../../config/achievements')).ACHIEVEMENTS
      .filter((a) => a.id !== 'C10')
      .map((a) => ({ achievementId: a.id }));
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce(allExceptC10);

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, finalHpPercent: 5 },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    // C10 "It's Just a Flesh Wound" — low_hp_win with maxHpPercent: 10
    const c10 = result.find((a) => a.id === 'C10');
    expect(c10).toBeDefined();
    expect(c10!.name).toBe("It's Just a Flesh Wound");
  });

  it('should require league or tournament battleType for elo_upset trigger', async () => {
    // Pre-unlock all achievements except C11 so only C11 is evaluated
    const allExceptC11 = (await import('../../../config/achievements')).ACHIEVEMENTS
      .filter((a) => a.id !== 'C11')
      .map((a) => ({ achievementId: a.id }));
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce(allExceptC11);

    // elo_upset with koth battleType — should NOT trigger C11
    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, eloDiff: 200, battleType: 'koth' },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    const c11 = result.find((a) => a.id === 'C11');
    expect(c11).toBeUndefined();
  });

  it('should trigger elo_upset for league battleType with sufficient eloDiff', async () => {
    // Pre-unlock all achievements except C11 so only C11 is evaluated
    const allExceptC11 = (await import('../../../config/achievements')).ACHIEVEMENTS
      .filter((a) => a.id !== 'C11')
      .map((a) => ({ achievementId: a.id }));
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce(allExceptC11);

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, eloDiff: 200, battleType: 'league' },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    const c11 = result.find((a) => a.id === 'C11');
    expect(c11).toBeDefined();
    expect(c11!.name).toBe('Never Tell Me the Odds');
  });
});

// ─── Tests: updatePinnedAchievements ─────────────────────────────────

describe('AchievementService.updatePinnedAchievements', () => {
  it('should throw TOO_MANY_PINNED when more than 6 IDs provided', async () => {
    const sevenIds = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'];

    await expect(
      achievementService.updatePinnedAchievements(1, sevenIds),
    ).rejects.toThrow(AchievementError);

    try {
      await achievementService.updatePinnedAchievements(1, sevenIds);
    } catch (err) {
      expect((err as AchievementError).code).toBe(AchievementErrorCode.TOO_MANY_PINNED);
    }
  });

  it('should throw INVALID_ACHIEVEMENT_ID for non-existent achievement ID', async () => {
    await expect(
      achievementService.updatePinnedAchievements(1, ['FAKE_ID']),
    ).rejects.toThrow(AchievementError);

    try {
      await achievementService.updatePinnedAchievements(1, ['FAKE_ID']);
    } catch (err) {
      expect((err as AchievementError).code).toBe(AchievementErrorCode.INVALID_ACHIEVEMENT_ID);
    }
  });

  it('should throw ACHIEVEMENT_NOT_UNLOCKED for locked achievement', async () => {
    // C1 exists in config but user hasn't unlocked it
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce([]);

    await expect(
      achievementService.updatePinnedAchievements(1, ['C1']),
    ).rejects.toThrow(AchievementError);

    try {
      // Reset mock for second call
      mockPrisma.userAchievement.findMany.mockResolvedValueOnce([]);
      await achievementService.updatePinnedAchievements(1, ['C1']);
    } catch (err) {
      expect((err as AchievementError).code).toBe(AchievementErrorCode.ACHIEVEMENT_NOT_UNLOCKED);
    }
  });

  it('should update pinnedAchievements when all validations pass', async () => {
    // User has C1 and C2 unlocked
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce([
      { achievementId: 'C1' },
      { achievementId: 'C2' },
    ]);

    await achievementService.updatePinnedAchievements(1, ['C1', 'C2']);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { pinnedAchievements: ['C1', 'C2'] },
    });
  });
});

// ─── Tests: getRarityLabel ───────────────────────────────────────────

describe('getRarityLabel', () => {
  it('should return correct labels for boundary values', () => {
    // > 75% → Common
    expect(getRarityLabel(100)).toEqual({ label: 'Common', color: 'text-secondary' });
    expect(getRarityLabel(76)).toEqual({ label: 'Common', color: 'text-secondary' });

    // 25–75% → Uncommon
    expect(getRarityLabel(75)).toEqual({ label: 'Uncommon', color: 'text-success' });
    expect(getRarityLabel(50)).toEqual({ label: 'Uncommon', color: 'text-success' });
    expect(getRarityLabel(26)).toEqual({ label: 'Uncommon', color: 'text-success' });

    // 10–25% → Rare
    expect(getRarityLabel(25)).toEqual({ label: 'Rare', color: 'text-primary' });
    expect(getRarityLabel(11)).toEqual({ label: 'Rare', color: 'text-primary' });

    // 1–10% → Epic
    expect(getRarityLabel(10)).toEqual({ label: 'Epic', color: 'text-warning' });
    expect(getRarityLabel(2)).toEqual({ label: 'Epic', color: 'text-warning' });

    // < 1% → Legendary
    expect(getRarityLabel(1)).toEqual({ label: 'Legendary', color: 'text-error' });
    expect(getRarityLabel(0.5)).toEqual({ label: 'Legendary', color: 'text-error' });
    expect(getRarityLabel(0)).toEqual({ label: 'Legendary', color: 'text-error' });
  });
});

// ─── Tests: refreshRarityCache ───────────────────────────────────────

describe('AchievementService.refreshRarityCache', () => {
  it('should update rarity cache from DB groupBy results', async () => {
    mockPrisma.userAchievement.groupBy.mockResolvedValueOnce([
      { achievementId: 'C1', _count: { achievementId: 10 } },
      { achievementId: 'C2', _count: { achievementId: 5 } },
    ]);
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ count: BigInt(20) }]);

    await achievementService.refreshRarityCache();

    const rarityData = achievementService.getRarityData();
    expect(rarityData.counts.get('C1')).toBe(10);
    expect(rarityData.counts.get('C2')).toBe(5);
    expect(rarityData.totalActivePlayers).toBe(20);
    expect(rarityData.refreshedAt.getTime()).toBeGreaterThan(0);
  });
});
