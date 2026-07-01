/**
 * Unit tests for battle post-combat services.
 *
 * Tests updateRobotCombatStats, logBattleAuditEvent, and award functions.
 */

const mockRobotFindUnique = jest.fn();
const mockRobotUpdate = jest.fn();
const mockUserUpdate = jest.fn();
const mockBattleParticipantFindFirst = jest.fn();
const mockFinancialLedgerCreate = jest.fn();
const mockAuditLogCreate = jest.fn();
const mockAuditLogFindFirst = jest.fn();

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    robot: {
      findUnique: (...args: unknown[]) => mockRobotFindUnique(...args),
      update: (...args: unknown[]) => mockRobotUpdate(...args),
    },
    user: { update: (...args: unknown[]) => mockUserUpdate(...args) },
    battleParticipant: { findFirst: (...args: unknown[]) => mockBattleParticipantFindFirst(...args) },
    financialLedger: { create: (...args: unknown[]) => mockFinancialLedgerCreate(...args) },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
      findFirst: (...args: unknown[]) => mockAuditLogFindFirst(...args),
    },
    cycleMetadata: { findUnique: jest.fn().mockResolvedValue({ currentCycle: 1 }) },
  },
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/services/economy/streamingRevenueService', () => ({
  calculateStreamingRevenue: jest.fn().mockResolvedValue({ totalRevenue: 100, viewerCount: 50, baseRevenue: 80, qualityBonus: 20 }),
}));

jest.mock('../../../src/services/achievement/achievementService', () => ({
  __esModule: true,
  default: { checkAndAward: jest.fn().mockResolvedValue([]) },
}));

jest.mock('../../../src/services/migration/featureFlags', () => ({
  isEnabled: jest.fn().mockReturnValue(true),
}));

import {
  updateRobotCombatStats,
  awardCreditsToUser,
  awardPrestigeToUser,
  awardFameToRobot,
  didRobotLosePreviousBattle,
} from '../../../src/services/battle/battlePostCombat';

beforeEach(() => {
  jest.clearAllMocks();
  mockRobotFindUnique.mockResolvedValue({ maxHP: 100 });
  mockRobotUpdate.mockResolvedValue({});
  mockUserUpdate.mockResolvedValue({});
});

describe('updateRobotCombatStats', () => {
  it('should update robot HP, ELO, and damage stats', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 80,
      newELO: 1250,
      isWinner: true,
      isDraw: false,
      damageDealt: 150,
      damageTakenByOpponent: 50,
      opponentDestroyed: true,
      fameIncrement: 5,
      battleType: 'league_1v1',
      stance: 'offensive',
      loadoutType: 'single',
    });

    expect(mockRobotUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          currentHP: 80,
          elo: 1250,
          damageDealtLifetime: { increment: 150 },
          damageTakenLifetime: { increment: 50 },
          totalBattles: { increment: 1 },
          wins: { increment: 1 },
          kills: { increment: 1 },
          fame: { increment: 5 },
          offensiveWins: { increment: 1 },
        }),
      }),
    );
  });

  it('should increment losses on loss', async () => {
    await updateRobotCombatStats({
      robotId: 2,
      finalHP: 0,
      newELO: 1180,
      isWinner: false,
      isDraw: false,
      damageDealt: 50,
      damageTakenByOpponent: 100,
      opponentDestroyed: false,
      fameIncrement: 0,
      battleType: 'league_1v1',
      stance: 'balanced',
      loadoutType: 'single',
    });

    expect(mockRobotUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          losses: { increment: 1 },
          totalBattles: { increment: 1 },
        }),
      }),
    );
    // Should NOT have wins or kills
    const updateData = mockRobotUpdate.mock.calls[0][0].data;
    expect(updateData.wins).toBeUndefined();
    expect(updateData.kills).toBeUndefined();
  });

  it('should increment draws on draw', async () => {
    await updateRobotCombatStats({
      robotId: 3,
      finalHP: 30,
      newELO: 1200,
      isWinner: false,
      isDraw: true,
      damageDealt: 80,
      damageTakenByOpponent: 80,
      opponentDestroyed: false,
      fameIncrement: 0,
      battleType: 'league_1v1',
      stance: 'defensive',
      loadoutType: 'single',
    });

    const updateData = mockRobotUpdate.mock.calls[0][0].data;
    expect(updateData.draws).toEqual({ increment: 1 });
    expect(updateData.wins).toBeUndefined();
    expect(updateData.losses).toBeUndefined();
  });

  it('should skip battle counters when skipBattleCounters=true', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 50,
      newELO: 1200,
      isWinner: true,
      isDraw: false,
      damageDealt: 200,
      damageTakenByOpponent: 100,
      opponentDestroyed: false,
      fameIncrement: 0,
      battleType: 'grand_melee',
      stance: 'balanced',
      loadoutType: 'single',
      skipBattleCounters: true,
    });

    const updateData = mockRobotUpdate.mock.calls[0][0].data;
    expect(updateData.totalBattles).toBeUndefined();
    expect(updateData.wins).toBeUndefined();
    expect(updateData.losses).toBeUndefined();
    expect(updateData.kills).toBeUndefined();
  });

  it('should clamp finalHP to robot maxHP', async () => {
    mockRobotFindUnique.mockResolvedValue({ maxHP: 100 });

    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 150, // exceeds maxHP (tuning-inflated)
      newELO: 1200,
      isWinner: true,
      isDraw: false,
      damageDealt: 100,
      damageTakenByOpponent: 50,
      opponentDestroyed: false,
      fameIncrement: 0,
      battleType: 'league_1v1',
      stance: 'balanced',
      loadoutType: 'single',
    });

    const updateData = mockRobotUpdate.mock.calls[0][0].data;
    expect(updateData.currentHP).toBe(100); // clamped to maxHP
  });

  it('should track dual_wield wins', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 50,
      newELO: 1250,
      isWinner: true,
      isDraw: false,
      damageDealt: 200,
      damageTakenByOpponent: 50,
      opponentDestroyed: true,
      fameIncrement: 0,
      battleType: 'league_1v1',
      stance: 'offensive',
      loadoutType: 'dual_wield',
    });

    const updateData = mockRobotUpdate.mock.calls[0][0].data;
    expect(updateData.dualWieldWins).toEqual({ increment: 1 });
    expect(updateData.offensiveWins).toEqual({ increment: 1 });
  });

  it('should track defensive wins', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 90,
      newELO: 1220,
      isWinner: true,
      isDraw: false,
      damageDealt: 80,
      damageTakenByOpponent: 10,
      opponentDestroyed: false,
      fameIncrement: 0,
      battleType: 'league_1v1',
      stance: 'defensive',
      loadoutType: 'single',
    });

    const updateData = mockRobotUpdate.mock.calls[0][0].data;
    expect(updateData.defensiveWins).toEqual({ increment: 1 });
  });
});

describe('awardCreditsToUser', () => {
  it('should increment user currency', async () => {
    await awardCreditsToUser(1, 5000);

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { currency: { increment: 5000 } },
    });
  });
});

describe('awardPrestigeToUser', () => {
  it('should increment user prestige', async () => {
    await awardPrestigeToUser(1, 50);

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { prestige: { increment: 50 } },
    });
  });
});

describe('awardFameToRobot', () => {
  it('should increment robot fame', async () => {
    await awardFameToRobot(5, 10);

    expect(mockRobotUpdate).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { fame: { increment: 10 } },
    });
  });
});

describe('didRobotLosePreviousBattle', () => {
  it('should return true when last battle was a loss', async () => {
    mockBattleParticipantFindFirst.mockResolvedValue({
      robotId: 1,
      battle: { winnerId: 99 }, // someone else won
    });

    const result = await didRobotLosePreviousBattle(1, 100);
    expect(result).toBe(true);
  });

  it('should return false when last battle was a win', async () => {
    mockBattleParticipantFindFirst.mockResolvedValue({
      robotId: 1,
      battle: { winnerId: 1 }, // this robot won
    });

    const result = await didRobotLosePreviousBattle(1, 100);
    expect(result).toBe(false);
  });

  it('should return false when no previous battles', async () => {
    mockBattleParticipantFindFirst.mockResolvedValue(null);

    const result = await didRobotLosePreviousBattle(1, 100);
    expect(result).toBe(false);
  });

  it('should return false when previous battle was a draw (winnerId null)', async () => {
    mockBattleParticipantFindFirst.mockResolvedValue({
      robotId: 1,
      battle: { winnerId: null },
    });

    const result = await didRobotLosePreviousBattle(1, 100);
    expect(result).toBe(false);
  });
});
