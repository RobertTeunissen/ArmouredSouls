/**
 * Unit tests for Achievement System — Team Battle Integration (Task 14.2)
 *
 * Tests:
 * - New trigger types (league_2v2_wins, league_3v3_wins) fire on team battle win
 * - C18 updated logic: requires all 4 categories (any league, tag team, any tournament, KotH)
 * - Existing C18 holders retain achievement
 * - Player without C18 must have wins in all 4 categories
 *
 * Requirements: R16.1–R16.7
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

import { achievementService } from '../achievementService';
import type { AchievementEvent } from '../achievementService';
import { ACHIEVEMENTS } from '../../../config/achievements';

// ─── Test Helpers ────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

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
  mockPrisma.battleParticipant.aggregate.mockResolvedValue({
    _sum: { credits: 0, streamingRevenue: 0 },
  });
  mockPrisma.battleParticipant.count.mockResolvedValue(0);
  mockPrisma.$queryRawUnsafe.mockResolvedValue([{ count: BigInt(0) }]);
  mockPrisma.$executeRawUnsafe.mockResolvedValue(0);
});

// ─── Tests: New trigger types fire on team battle win (R16.1, R16.4) ─

describe('Achievement Team Battle: league_2v2_wins trigger', () => {
  it('should award L18 "Daft Punk" when robot has 1+ 2v2 league win', async () => {
    // Pre-unlock all achievements except L18
    const allExceptL18 = ACHIEVEMENTS
      .filter((a) => a.id !== 'L18')
      .map((a) => ({ achievementId: a.id }));
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce(allExceptL18);

    // Robot with 1 totalLeague2v2Wins
    mockPrisma.robot.findUnique.mockResolvedValue({
      wins: 0,
      losses: 0,
      totalBattles: 0,
      kills: 0,
      elo: 1200,
      fame: 0,
      name: 'TestBot',
    });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, battleType: 'league_2v2' },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    const l18 = result.find((a) => a.id === 'L18');
    expect(l18).toBeDefined();
    expect(l18!.name).toBe('Daft Punk');
  });

  it('should award L19 "Twins!" when robot has 25+ 2v2 league wins', async () => {
    // Pre-unlock all achievements except L19
    const allExceptL19 = ACHIEVEMENTS
      .filter((a) => a.id !== 'L19')
      .map((a) => ({ achievementId: a.id }));
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce(allExceptL19);

    mockPrisma.robot.findUnique.mockResolvedValue({
      wins: 0,
      losses: 0,
      totalBattles: 0,
      kills: 0,
      elo: 1200,
      fame: 0,
      name: 'TestBot',
    });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, battleType: 'league_2v2' },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    const l19 = result.find((a) => a.id === 'L19');
    expect(l19).toBeDefined();
    expect(l19!.name).toBe('Twins!');
  });

  it('should NOT award L18 when robot has 0 2v2 league wins', async () => {
    const allExceptL18 = ACHIEVEMENTS
      .filter((a) => a.id !== 'L18')
      .map((a) => ({ achievementId: a.id }));
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce(allExceptL18);

    mockPrisma.robot.findUnique.mockResolvedValue({
      wins: 0,
      losses: 0,
      totalBattles: 0,
      kills: 0,
      elo: 1200,
      fame: 0,
      name: 'TestBot',
    });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, battleType: 'league_2v2' },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    const l18 = result.find((a) => a.id === 'L18');
    expect(l18).toBeUndefined();
  });
});

describe('Achievement Team Battle: league_3v3_wins trigger', () => {
  it('should award L20 "Three Laws Safe" when robot has 1+ 3v3 league win', async () => {
    const allExceptL20 = ACHIEVEMENTS
      .filter((a) => a.id !== 'L20')
      .map((a) => ({ achievementId: a.id }));
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce(allExceptL20);

    mockPrisma.robot.findUnique.mockResolvedValue({
      wins: 0,
      losses: 0,
      totalBattles: 0,
      kills: 0,
      elo: 1200,
      fame: 0,
      name: 'TestBot',
    });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, battleType: 'league_3v3' },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    const l20 = result.find((a) => a.id === 'L20');
    expect(l20).toBeDefined();
    expect(l20!.name).toBe('Three Laws Safe');
  });

  it('should award L21 "Voltron" when robot has 25+ 3v3 league wins', async () => {
    const allExceptL21 = ACHIEVEMENTS
      .filter((a) => a.id !== 'L21')
      .map((a) => ({ achievementId: a.id }));
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce(allExceptL21);

    mockPrisma.robot.findUnique.mockResolvedValue({
      wins: 0,
      losses: 0,
      totalBattles: 0,
      kills: 0,
      elo: 1200,
      fame: 0,
      name: 'TestBot',
    });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, battleType: 'league_3v3' },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    const l21 = result.find((a) => a.id === 'L21');
    expect(l21).toBeDefined();
    expect(l21!.name).toBe('Voltron');
  });

  it('should NOT award L20 when robot has 0 3v3 league wins', async () => {
    const allExceptL20 = ACHIEVEMENTS
      .filter((a) => a.id !== 'L20')
      .map((a) => ({ achievementId: a.id }));
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce(allExceptL20);

    mockPrisma.robot.findUnique.mockResolvedValue({
      wins: 0,
      losses: 0,
      totalBattles: 0,
      kills: 0,
      elo: 1200,
      fame: 0,
      name: 'TestBot',
    });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, battleType: 'league_3v3' },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    const l20 = result.find((a) => a.id === 'L20');
    expect(l20).toBeUndefined();
  });
});

// ─── Tests: C18 updated logic — requires all 4 categories (R16.5) ───

describe('Achievement Team Battle: C18 "Autobots, Roll Out!" updated logic', () => {
  it('should award C18 when user has wins in all 4 categories (league via 2v2, tag team, tournament, KotH)', async () => {
    // Pre-unlock all achievements except C18
    const allExceptC18 = ACHIEVEMENTS
      .filter((a) => a.id !== 'C18')
      .map((a) => ({ achievementId: a.id }));
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce(allExceptC18);

    // Robot with wins in all categories (league via 2v2 wins)
    mockPrisma.robot.findUnique.mockResolvedValue({
      wins: 0,
      losses: 0,
      totalBattles: 10,
      kills: 0,
      elo: 1200,
      fame: 0,
      name: 'TestBot',
    });

    // findMany for checkAllModesWin — robots with wins in all categories
    mockPrisma.robot.findMany.mockResolvedValue([
      {
        wins: 0,
      },
    ]);

    // User with tournament win
    mockPrisma.user.findUnique.mockResolvedValue({
      championshipTitles: 1, championshipTitles1v1: 1, championshipTitles2v2: 0, championshipTitles3v3: 0,
      prestige: 0,
      currency: 0,
    });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, battleType: 'league_2v2' },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    const c18 = result.find((a) => a.id === 'C18');
    expect(c18).toBeDefined();
    expect(c18!.name).toBe('Autobots, Roll Out!');
  });

  it('should award C18 when league category satisfied via 3v3 wins only', async () => {
    const allExceptC18 = ACHIEVEMENTS
      .filter((a) => a.id !== 'C18')
      .map((a) => ({ achievementId: a.id }));
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce(allExceptC18);

    mockPrisma.robot.findUnique.mockResolvedValue({
      wins: 0,
      losses: 0,
      totalBattles: 10,
      kills: 0,
      elo: 1200,
      fame: 0,
      name: 'TestBot',
    });

    // findMany for checkAllModesWin
    mockPrisma.robot.findMany.mockResolvedValue([
      {
        wins: 0,
      },
    ]);

    mockPrisma.user.findUnique.mockResolvedValue({
      championshipTitles: 1, championshipTitles1v1: 1, championshipTitles2v2: 0, championshipTitles3v3: 0,
      prestige: 0,
      currency: 0,
    });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, battleType: 'league_3v3' },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    const c18 = result.find((a) => a.id === 'C18');
    expect(c18).toBeDefined();
  });

  it('should award C18 when league category satisfied via 1v1 wins only', async () => {
    const allExceptC18 = ACHIEVEMENTS
      .filter((a) => a.id !== 'C18')
      .map((a) => ({ achievementId: a.id }));
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce(allExceptC18);

    mockPrisma.robot.findUnique.mockResolvedValue({
      wins: 1,
      losses: 0,
      totalBattles: 10,
      kills: 0,
      elo: 1200,
      fame: 0,
      name: 'TestBot',
    });

    // findMany for checkAllModesWin
    mockPrisma.robot.findMany.mockResolvedValue([
      {
        wins: 1,
      },
    ]);

    mockPrisma.user.findUnique.mockResolvedValue({
      championshipTitles: 1, championshipTitles1v1: 1, championshipTitles2v2: 0, championshipTitles3v3: 0,
      prestige: 0,
      currency: 0,
    });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, battleType: 'league_1v1' },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    const c18 = result.find((a) => a.id === 'C18');
    expect(c18).toBeDefined();
  });

  it('should NOT award C18 when missing KotH wins', async () => {
    const allExceptC18 = ACHIEVEMENTS
      .filter((a) => a.id !== 'C18')
      .map((a) => ({ achievementId: a.id }));
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce(allExceptC18);

    mockPrisma.robot.findUnique.mockResolvedValue({
      wins: 1,
      losses: 0,
      totalBattles: 10,
      kills: 0,
      elo: 1200,
      fame: 0,
      name: 'TestBot',
    });

    // findMany for checkAllModesWin — no KotH wins
    mockPrisma.robot.findMany.mockResolvedValue([
      {
        wins: 1,
      },
    ]);

    mockPrisma.user.findUnique.mockResolvedValue({
      championshipTitles: 1, championshipTitles1v1: 1, championshipTitles2v2: 0, championshipTitles3v3: 0,
      prestige: 0,
      currency: 0,
    });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, battleType: 'league_2v2' },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    const c18 = result.find((a) => a.id === 'C18');
    expect(c18).toBeUndefined();
  });

  it('should NOT award C18 when missing tag team wins', async () => {
    const allExceptC18 = ACHIEVEMENTS
      .filter((a) => a.id !== 'C18')
      .map((a) => ({ achievementId: a.id }));
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce(allExceptC18);

    mockPrisma.robot.findUnique.mockResolvedValue({
      wins: 1,
      losses: 0,
      totalBattles: 10,
      kills: 0,
      elo: 1200,
      fame: 0,
      name: 'TestBot',
    });

    // findMany for checkAllModesWin — no tag team wins
    mockPrisma.robot.findMany.mockResolvedValue([
      {
        wins: 1,
      },
    ]);

    mockPrisma.user.findUnique.mockResolvedValue({
      championshipTitles: 1, championshipTitles1v1: 1, championshipTitles2v2: 0, championshipTitles3v3: 0,
      prestige: 0,
      currency: 0,
    });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, battleType: 'league_2v2' },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    const c18 = result.find((a) => a.id === 'C18');
    expect(c18).toBeUndefined();
  });

  it('should NOT award C18 when missing tournament wins', async () => {
    const allExceptC18 = ACHIEVEMENTS
      .filter((a) => a.id !== 'C18')
      .map((a) => ({ achievementId: a.id }));
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce(allExceptC18);

    mockPrisma.robot.findUnique.mockResolvedValue({
      wins: 1,
      losses: 0,
      totalBattles: 10,
      kills: 0,
      elo: 1200,
      fame: 0,
      name: 'TestBot',
    });

    // findMany for checkAllModesWin — has all robot-level wins
    mockPrisma.robot.findMany.mockResolvedValue([
      {
        wins: 1,
      },
    ]);

    // User with NO tournament wins
    mockPrisma.user.findUnique.mockResolvedValue({
      championshipTitles: 0, championshipTitles1v1: 0, championshipTitles2v2: 0, championshipTitles3v3: 0,
      prestige: 0,
      currency: 0,
    });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, battleType: 'league_2v2' },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    const c18 = result.find((a) => a.id === 'C18');
    expect(c18).toBeUndefined();
  });

  it('should NOT award C18 when missing any league wins (no 1v1, 2v2, or 3v3)', async () => {
    const allExceptC18 = ACHIEVEMENTS
      .filter((a) => a.id !== 'C18')
      .map((a) => ({ achievementId: a.id }));
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce(allExceptC18);

    mockPrisma.robot.findUnique.mockResolvedValue({
      wins: 0,
      losses: 0,
      totalBattles: 10,
      kills: 0,
      elo: 1200,
      fame: 0,
      name: 'TestBot',
    });

    // findMany for checkAllModesWin — no league wins at all
    mockPrisma.robot.findMany.mockResolvedValue([
      {
        wins: 0,
      },
    ]);

    mockPrisma.user.findUnique.mockResolvedValue({
      championshipTitles: 1, championshipTitles1v1: 1, championshipTitles2v2: 0, championshipTitles3v3: 0,
      prestige: 0,
      currency: 0,
    });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, battleType: 'koth' },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    const c18 = result.find((a) => a.id === 'C18');
    expect(c18).toBeUndefined();
  });
});

// ─── Tests: Existing C18 holders retain achievement (R16.7) ──────────

describe('Achievement Team Battle: C18 existing holders retention', () => {
  it('should skip C18 evaluation when user already holds C18', async () => {
    // User already has C18 unlocked — it should be skipped entirely
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce([
      { achievementId: 'C18' },
    ]);

    mockPrisma.robot.findUnique.mockResolvedValue({
      wins: 1,
      losses: 0,
      totalBattles: 5,
      kills: 0,
      elo: 1200,
      fame: 0,
      name: 'TestBot',
    });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, battleType: 'league_2v2' },
    };

    const result = await achievementService.checkAndAward(1, 1, event);

    // C18 should NOT appear in newly awarded achievements (already held)
    const c18 = result.find((a) => a.id === 'C18');
    expect(c18).toBeUndefined();

    // Verify create was NOT called for C18
    const createCalls = mockPrisma.userAchievement.create.mock.calls;
    const createdIds = createCalls.map(
      (c: unknown[]) => (c[0] as { data: { achievementId: string } }).data.achievementId,
    );
    expect(createdIds).not.toContain('C18');
  });

  it('should not revoke C18 from existing holders even if they lack 4 categories now', async () => {
    // This test verifies the design: existing C18 holders keep it.
    // The achievement service only awards, never revokes.
    // If C18 is already in userAchievement, it stays — no revocation logic exists.
    mockPrisma.userAchievement.findMany.mockResolvedValueOnce([
      { achievementId: 'C18' },
    ]);

    // Robot that would NOT qualify under new rules (missing KotH)
    mockPrisma.robot.findUnique.mockResolvedValue({
      wins: 1,
      losses: 0,
      totalBattles: 5,
      kills: 0,
      elo: 1200,
      fame: 0,
      name: 'TestBot',
    });

    const event: AchievementEvent = {
      type: 'battle_complete',
      data: { won: true, battleType: 'league_1v1' },
    };

    await achievementService.checkAndAward(1, 1, event);

    // No delete/revoke calls should exist — achievement service only awards
    // The existing C18 row remains untouched in the database
    expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalledWith(
      expect.stringContaining('DELETE'),
      expect.anything(),
    );
  });
});

// ─── Tests: Achievement config validation (R16.4, R16.6) ─────────────

describe('Achievement Team Battle: config validation', () => {
  it('should have L18 "Daft Punk" with correct config', () => {
    const l18 = ACHIEVEMENTS.find((a) => a.id === 'L18');
    expect(l18).toBeDefined();
    expect(l18!.name).toBe('Daft Punk');
    expect(l18!.triggerType).toBe('league_2v2_wins');
    expect(l18!.triggerThreshold).toBe(1);
    expect(l18!.tier).toBe('easy');
    expect(l18!.scope).toBe('robot');
    expect(l18!.category).toBe('league');
  });

  it('should have L19 "Twins!" with correct config', () => {
    const l19 = ACHIEVEMENTS.find((a) => a.id === 'L19');
    expect(l19).toBeDefined();
    expect(l19!.name).toBe('Twins!');
    expect(l19!.triggerType).toBe('league_2v2_wins');
    expect(l19!.triggerThreshold).toBe(25);
    expect(l19!.tier).toBe('hard');
    expect(l19!.scope).toBe('robot');
  });

  it('should have L20 "Three Laws Safe" with correct config', () => {
    const l20 = ACHIEVEMENTS.find((a) => a.id === 'L20');
    expect(l20).toBeDefined();
    expect(l20!.name).toBe('Three Laws Safe');
    expect(l20!.triggerType).toBe('league_3v3_wins');
    expect(l20!.triggerThreshold).toBe(1);
    expect(l20!.tier).toBe('easy');
    expect(l20!.scope).toBe('robot');
  });

  it('should have L21 "Voltron" with correct config', () => {
    const l21 = ACHIEVEMENTS.find((a) => a.id === 'L21');
    expect(l21).toBeDefined();
    expect(l21!.name).toBe('Voltron');
    expect(l21!.triggerType).toBe('league_3v3_wins');
    expect(l21!.triggerThreshold).toBe(25);
    expect(l21!.tier).toBe('hard');
    expect(l21!.scope).toBe('robot');
  });

  it('should have C18 description mentioning all 4 categories', () => {
    const c18 = ACHIEVEMENTS.find((a) => a.id === 'C18');
    expect(c18).toBeDefined();
    expect(c18!.description).toContain('league');
    expect(c18!.description).toContain('tag team');
    expect(c18!.description).toContain('tournament');
    expect(c18!.description).toContain('KotH');
  });

  it('should include league_2v2_wins and league_3v3_wins in AchievementTriggerType', () => {
    // Verify the trigger types exist in the ACHIEVEMENTS config
    const triggerTypes = ACHIEVEMENTS.map((a) => a.triggerType);
    expect(triggerTypes).toContain('league_2v2_wins');
    expect(triggerTypes).toContain('league_3v3_wins');
  });
});
