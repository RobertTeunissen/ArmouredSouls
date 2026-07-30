/**
 * Unit tests for battle post-combat services.
 *
 * Tests updateRobotCombatStats, logBattleAuditEvent, and award functions.
 */

const mockRobotFindUnique = jest.fn();
const mockRobotUpdate = jest.fn();
const mockRobotModeKillsUpsert = jest.fn();
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
    robotModeKills: { upsert: (...args: unknown[]) => mockRobotModeKillsUpsert(...args) },
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
  mockRobotModeKillsUpsert.mockResolvedValue({});
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
      opponentsDestroyed: 1,
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
      opponentsDestroyed: 0,
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
      opponentsDestroyed: 0,
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
      opponentsDestroyed: 0,
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
  });

  it('should increment kills by the number of opponents destroyed', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 40,
      newELO: 1200,
      isWinner: true,
      isDraw: false,
      damageDealt: 400,
      damageTakenByOpponent: 60,
      opponentsDestroyed: 3,
      fameIncrement: 0,
      battleType: 'league_3v3',
      stance: 'offensive',
      loadoutType: 'single',
    });

    const updateData = mockRobotUpdate.mock.calls[0][0].data;
    expect(updateData.kills).toEqual({ increment: 3 });
  });

  // Regression: the kills increment used to sit inside the `skipBattleCounters`
  // guard, so KotH and Grand Melee — the only modes where a robot can wreck
  // several opponents at once — never recorded a single destruction.
  it('should record destructions for placement modes that skip battle counters', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 25,
      newELO: 1200,
      isWinner: false,
      isDraw: false,
      damageDealt: 900,
      damageTakenByOpponent: 75,
      opponentsDestroyed: 4,
      fameIncrement: 0,
      battleType: 'grand_melee',
      stance: 'offensive',
      loadoutType: 'single',
      skipBattleCounters: true,
      placement: 2,
    });

    const updateData = mockRobotUpdate.mock.calls[0][0].data;
    expect(updateData.kills).toEqual({ increment: 4 });
    expect(updateData.totalBattles).toBeUndefined();
  });

  it('should tally destructions against the battle type', async () => {
    await updateRobotCombatStats({
      robotId: 7,
      finalHP: 50,
      newELO: 1200,
      isWinner: true,
      isDraw: false,
      damageDealt: 300,
      damageTakenByOpponent: 50,
      opponentsDestroyed: 2,
      fameIncrement: 0,
      battleType: 'tag_team',
      stance: 'offensive',
      loadoutType: 'single',
    });

    expect(mockRobotModeKillsUpsert).toHaveBeenCalledWith({
      where: { robotId_mode: { robotId: 7, mode: 'tag_team' } },
      update: { kills: { increment: 2 } },
      create: { robotId: 7, mode: 'tag_team', kills: 2 },
    });
  });

  it('should tally destructions for placement modes that skip battle counters', async () => {
    await updateRobotCombatStats({
      robotId: 8,
      finalHP: 0,
      newELO: 1200,
      isWinner: false,
      isDraw: false,
      damageDealt: 700,
      damageTakenByOpponent: 100,
      opponentsDestroyed: 5,
      fameIncrement: 0,
      battleType: 'grand_melee',
      stance: 'offensive',
      loadoutType: 'single',
      skipBattleCounters: true,
      placement: 4,
    });

    expect(mockRobotModeKillsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { robotId_mode: { robotId: 8, mode: 'grand_melee' } },
        update: { kills: { increment: 5 } },
      }),
    );
  });

  it('should not tally a battle type that maps to no tracked mode', async () => {
    await updateRobotCombatStats({
      robotId: 9,
      finalHP: 60,
      newELO: 1200,
      isWinner: true,
      isDraw: false,
      damageDealt: 100,
      damageTakenByOpponent: 20,
      opponentsDestroyed: 1,
      fameIncrement: 0,
      battleType: 'practice',
      stance: 'balanced',
      loadoutType: 'single',
    });

    // The lifetime total is still recorded; only the per-mode split is skipped.
    expect(mockRobotUpdate.mock.calls[0][0].data.kills).toEqual({ increment: 1 });
    expect(mockRobotModeKillsUpsert).not.toHaveBeenCalled();
  });

  it('should not fail the battle when the per-mode tally write fails', async () => {
    mockRobotModeKillsUpsert.mockRejectedValue(new Error('deadlock'));

    await expect(
      updateRobotCombatStats({
        robotId: 10,
        finalHP: 40,
        newELO: 1200,
        isWinner: true,
        isDraw: false,
        damageDealt: 100,
        damageTakenByOpponent: 30,
        opponentsDestroyed: 1,
        fameIncrement: 0,
        battleType: 'league_1v1',
        stance: 'balanced',
        loadoutType: 'single',
      }),
    ).resolves.toBeUndefined();

    expect(mockRobotUpdate).toHaveBeenCalled();
  });

  it('should not write a kills increment when nothing was destroyed', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 10,
      newELO: 1190,
      isWinner: false,
      isDraw: false,
      damageDealt: 20,
      damageTakenByOpponent: 90,
      opponentsDestroyed: 0,
      fameIncrement: 0,
      battleType: 'koth',
      stance: 'defensive',
      loadoutType: 'single',
      skipBattleCounters: true,
    });

    const updateData = mockRobotUpdate.mock.calls[0][0].data;
    expect(updateData.kills).toBeUndefined();
    expect(mockRobotModeKillsUpsert).not.toHaveBeenCalled();
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
      opponentsDestroyed: 0,
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
      opponentsDestroyed: 1,
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
      opponentsDestroyed: 0,
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
