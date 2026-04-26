/**
 * Unit tests for battlePostCombat.ts shared helpers.
 *
 * All external dependencies (Prisma, eventLogger, streamingRevenueService,
 * leagueBattleOrchestrator) are mocked so these run fast without a DB.
 */

// ─── Mocks (must be before imports) ──────────────────────────────────

const mockPrisma = {
  battleParticipant: {
    update: jest.fn().mockResolvedValue({}),
  },
  robot: {
    update: jest.fn().mockResolvedValue({}),
  },
  user: {
    update: jest.fn().mockResolvedValue({}),
  },
  $executeRawUnsafe: jest.fn().mockResolvedValue(0),
};

jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

const mockCalculateStreamingRevenue = jest.fn();
const mockAwardStreamingRevenue = jest.fn();

jest.mock('../src/services/economy/streamingRevenueService', () => ({
  calculateStreamingRevenue: (...args: unknown[]) => mockCalculateStreamingRevenue(...args),
  awardStreamingRevenue: (...args: unknown[]) => mockAwardStreamingRevenue(...args),
}));

const mockLogEvent = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/services/common/eventLogger', () => ({
  eventLogger: { logEvent: (...args: unknown[]) => mockLogEvent(...args) },
  EventType: { BATTLE_COMPLETE: 'battle_complete' },
}));

jest.mock('../src/services/battle/baseOrchestrator', () => ({
  getCurrentCycleNumber: jest.fn().mockResolvedValue(42),
}));

jest.mock('../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// ─── Imports (after mocks) ───────────────────────────────────────────

import {
  awardStreamingRevenueForParticipant,
  logBattleAuditEvent,
  updateRobotCombatStats,
  awardCreditsToUser,
  awardPrestigeToUser,
  awardFameToRobot,
  ParticipantOutcome,
} from '../src/services/battle/battlePostCombat';
import { StreamingRevenueCalculation } from '../src/services/economy/streamingRevenueService';

// ─── Test Data Helpers ───────────────────────────────────────────────

function makeParticipantOutcome(overrides: Partial<ParticipantOutcome> = {}): ParticipantOutcome {
  return {
    robotId: 1,
    userId: 10,
    isWinner: true,
    isDraw: false,
    damageDealt: 250,
    finalHP: 80,
    yielded: false,
    destroyed: false,
    credits: 15000,
    prestige: 10,
    fame: 5,
    eloBefore: 1200,
    eloAfter: 1216,
    ...overrides,
  };
}

function makeStreamingCalc(overrides: Partial<StreamingRevenueCalculation> = {}): StreamingRevenueCalculation {
  return {
    baseAmount: 1000,
    battleMultiplier: 1.05,
    fameMultiplier: 1.02,
    studioMultiplier: 2.0,
    totalRevenue: 2142,
    robotId: 1,
    robotName: 'TestBot',
    robotBattles: 50,
    robotFame: 100,
    studioLevel: 1,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('awardStreamingRevenueForParticipant', () => {
  it('should return null for bye matches', async () => {
    const result = await awardStreamingRevenueForParticipant(1, 10, 100, true);

    expect(result).toBeNull();
    expect(mockCalculateStreamingRevenue).not.toHaveBeenCalled();
  });

  it('should return null when calculateStreamingRevenue returns null', async () => {
    mockCalculateStreamingRevenue.mockResolvedValueOnce(null);

    const result = await awardStreamingRevenueForParticipant(1, 10, 100, false);

    expect(result).toBeNull();
    expect(mockCalculateStreamingRevenue).toHaveBeenCalledWith(1, 10, false);
    expect(mockAwardStreamingRevenue).not.toHaveBeenCalled();
  });

  it('should calculate, award, and update participant when revenue exists', async () => {
    const calc = makeStreamingCalc();
    mockCalculateStreamingRevenue.mockResolvedValueOnce(calc);
    mockAwardStreamingRevenue.mockResolvedValueOnce(undefined);

    const result = await awardStreamingRevenueForParticipant(1, 10, 100, false);

    expect(result).toEqual(calc);
    expect(mockCalculateStreamingRevenue).toHaveBeenCalledWith(1, 10, false);
    expect(mockAwardStreamingRevenue).toHaveBeenCalledWith(10, calc, 42);
    expect(mockPrisma.battleParticipant.update).toHaveBeenCalledWith({
      where: { battleId_robotId: { battleId: 100, robotId: 1 } },
      data: { streamingRevenue: 2142 },
    });
  });

  it('should default isByeMatch to false when not provided', async () => {
    const calc = makeStreamingCalc();
    mockCalculateStreamingRevenue.mockResolvedValueOnce(calc);
    mockAwardStreamingRevenue.mockResolvedValueOnce(undefined);

    const result = await awardStreamingRevenueForParticipant(1, 10, 100);

    expect(result).toEqual(calc);
    expect(mockCalculateStreamingRevenue).toHaveBeenCalled();
  });
});

describe('logBattleAuditEvent', () => {
  it('should log a battle_complete event with correct fields for a winner', async () => {
    const participant = makeParticipantOutcome();
    const battle = { id: 100, battleType: '1v1', leagueType: 'bronze', durationSeconds: 45, eloChange: 16 };

    await logBattleAuditEvent(participant, battle, 2, 2142, false);

    expect(mockLogEvent).toHaveBeenCalledTimes(1);
    const [cycleNumber, eventType, payload, options] = mockLogEvent.mock.calls[0];

    expect(cycleNumber).toBe(42);
    expect(eventType).toBe('battle_complete');
    expect(payload.result).toBe('win');
    expect(payload.opponentId).toBe(2);
    expect(payload.isByeMatch).toBe(false);
    expect(payload.eloBefore).toBe(1200);
    expect(payload.eloAfter).toBe(1216);
    expect(payload.eloChange).toBe(16);
    expect(payload.damageDealt).toBe(250);
    expect(payload.credits).toBe(15000);
    expect(payload.prestige).toBe(10);
    expect(payload.fame).toBe(5);
    expect(payload.streamingRevenue).toBe(2142);
    expect(payload.battleType).toBe('1v1');
    expect(options.userId).toBe(10);
    expect(options.robotId).toBe(1);
    expect(options.battleId).toBe(100);
  });

  it('should log result as "loss" for a loser', async () => {
    const participant = makeParticipantOutcome({ isWinner: false });
    const battle = { id: 100, battleType: '1v1', leagueType: 'bronze', durationSeconds: 45, eloChange: 16 };

    await logBattleAuditEvent(participant, battle, 2, 0, false);

    const payload = mockLogEvent.mock.calls[0][2];
    expect(payload.result).toBe('loss');
    expect(payload.eloChange).toBe(-16);
  });

  it('should log result as "draw" for a draw', async () => {
    const participant = makeParticipantOutcome({ isWinner: false, isDraw: true });
    const battle = { id: 100, battleType: '1v1', leagueType: 'bronze', durationSeconds: 120, eloChange: 0 };

    await logBattleAuditEvent(participant, battle, 2, 0, false);

    const payload = mockLogEvent.mock.calls[0][2];
    expect(payload.result).toBe('draw');
  });

  it('should merge type-specific extras into the payload', async () => {
    const participant = makeParticipantOutcome();
    const battle = { id: 100, battleType: 'koth', leagueType: 'koth', durationSeconds: 150, eloChange: 0 };
    const extras = { placement: 1, zoneScore: 30, zoneDominance: true };

    await logBattleAuditEvent(participant, battle, null, 0, false, extras);

    const payload = mockLogEvent.mock.calls[0][2];
    expect(payload.placement).toBe(1);
    expect(payload.zoneScore).toBe(30);
    expect(payload.zoneDominance).toBe(true);
    expect(payload.opponentId).toBeNull();
  });
});

describe('updateRobotCombatStats', () => {
  it('should update robot stats for a winner', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 80,
      newELO: 1216,
      isWinner: true,
      isDraw: false,
      damageDealt: 250,
      damageTakenByOpponent: 120,
      opponentDestroyed: true,
    });

    expect(mockPrisma.robot.update).toHaveBeenCalledTimes(1);
    const call = mockPrisma.robot.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 1 });
    expect(call.data.currentHP).toBe(80);
    expect(call.data.elo).toBe(1216);
    expect(call.data.totalBattles).toEqual({ increment: 1 });
    expect(call.data.wins).toEqual({ increment: 1 });
    expect(call.data.kills).toEqual({ increment: 1 });
    expect(call.data.damageDealtLifetime).toEqual({ increment: 250 });
    expect(call.data.damageTakenLifetime).toEqual({ increment: 120 });
    // Loser fields should not be present
    expect(call.data.losses).toBeUndefined();
    expect(call.data.draws).toBeUndefined();
  });

  it('should update robot stats for a loser', async () => {
    await updateRobotCombatStats({
      robotId: 2,
      finalHP: 0,
      newELO: 1184,
      isWinner: false,
      isDraw: false,
      damageDealt: 120,
      damageTakenByOpponent: 250,
      opponentDestroyed: false,
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    expect(call.data.losses).toEqual({ increment: 1 });
    expect(call.data.wins).toBeUndefined();
    expect(call.data.draws).toBeUndefined();
    expect(call.data.kills).toBeUndefined();
  });

  it('should update robot stats for a draw', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 50,
      newELO: 1200,
      isWinner: false,
      isDraw: true,
      damageDealt: 200,
      damageTakenByOpponent: 200,
      opponentDestroyed: false,
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    expect(call.data.draws).toEqual({ increment: 1 });
    expect(call.data.wins).toBeUndefined();
    expect(call.data.losses).toBeUndefined();
  });

  it('should apply league points change with min-0 clamping', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 0,
      newELO: 1184,
      isWinner: false,
      isDraw: false,
      damageDealt: 100,
      damageTakenByOpponent: 200,
      opponentDestroyed: false,
      leaguePointsChange: -5,
      currentLeaguePoints: 3,
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    // max(0, 3 + (-5)) = max(0, -2) = 0
    expect(call.data.leaguePoints).toBe(0);
  });

  it('should apply positive league points change', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 80,
      newELO: 1216,
      isWinner: true,
      isDraw: false,
      damageDealt: 250,
      damageTakenByOpponent: 120,
      opponentDestroyed: false,
      leaguePointsChange: 3,
      currentLeaguePoints: 10,
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    expect(call.data.leaguePoints).toBe(13);
  });

  it('should apply fame increment when provided', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 80,
      newELO: 1216,
      isWinner: true,
      isDraw: false,
      damageDealt: 250,
      damageTakenByOpponent: 120,
      opponentDestroyed: false,
      fameIncrement: 10,
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    expect(call.data.fame).toEqual({ increment: 10 });
  });

  it('should not set fame when fameIncrement is 0', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 80,
      newELO: 1216,
      isWinner: true,
      isDraw: false,
      damageDealt: 250,
      damageTakenByOpponent: 120,
      opponentDestroyed: false,
      fameIncrement: 0,
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    expect(call.data.fame).toBeUndefined();
  });

  it('should not set leaguePoints when leaguePointsChange is 0', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 80,
      newELO: 1216,
      isWinner: true,
      isDraw: false,
      damageDealt: 250,
      damageTakenByOpponent: 120,
      opponentDestroyed: false,
      leaguePointsChange: 0,
      currentLeaguePoints: 10,
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    expect(call.data.leaguePoints).toBeUndefined();
  });

  it('should merge extraData into the update', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 80,
      newELO: 1216,
      isWinner: true,
      isDraw: false,
      damageDealt: 250,
      damageTakenByOpponent: 120,
      opponentDestroyed: false,
      extraData: { kothBattles: { increment: 1 } },
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    expect(call.data.kothBattles).toEqual({ increment: 1 });
  });

  // ── League Win/Lose Streak Tests ──

  it('should increment currentWinStreak and reset currentLoseStreak on league win', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 80,
      newELO: 1216,
      isWinner: true,
      isDraw: false,
      damageDealt: 250,
      damageTakenByOpponent: 120,
      opponentDestroyed: false,
      battleType: 'league',
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    expect(call.data.currentWinStreak).toEqual({ increment: 1 });
    expect(call.data.currentLoseStreak).toBe(0);
  });

  it('should update bestWinStreak via raw SQL on league win', async () => {
    await updateRobotCombatStats({
      robotId: 42,
      finalHP: 80,
      newELO: 1216,
      isWinner: true,
      isDraw: false,
      damageDealt: 250,
      damageTakenByOpponent: 120,
      opponentDestroyed: false,
      battleType: 'league',
    });

    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
      `UPDATE robots SET best_win_streak = current_win_streak WHERE id = $1 AND current_win_streak > best_win_streak`,
      42,
    );
  });

  it('should reset currentWinStreak and increment currentLoseStreak on league loss', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 0,
      newELO: 1184,
      isWinner: false,
      isDraw: false,
      damageDealt: 100,
      damageTakenByOpponent: 200,
      opponentDestroyed: false,
      battleType: 'league',
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    expect(call.data.currentWinStreak).toBe(0);
    expect(call.data.currentLoseStreak).toEqual({ increment: 1 });
    expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('should reset both streaks on league draw', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 50,
      newELO: 1200,
      isWinner: false,
      isDraw: true,
      damageDealt: 200,
      damageTakenByOpponent: 200,
      opponentDestroyed: false,
      battleType: 'league',
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    expect(call.data.currentWinStreak).toBe(0);
    expect(call.data.currentLoseStreak).toBe(0);
    expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('should not update streak fields when battleType is not league', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 80,
      newELO: 1216,
      isWinner: true,
      isDraw: false,
      damageDealt: 250,
      damageTakenByOpponent: 120,
      opponentDestroyed: false,
      battleType: 'koth',
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    expect(call.data.currentWinStreak).toBeUndefined();
    expect(call.data.currentLoseStreak).toBeUndefined();
    expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('should not update streak fields when battleType is not provided', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 80,
      newELO: 1216,
      isWinner: true,
      isDraw: false,
      damageDealt: 250,
      damageTakenByOpponent: 120,
      opponentDestroyed: false,
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    expect(call.data.currentWinStreak).toBeUndefined();
    expect(call.data.currentLoseStreak).toBeUndefined();
    expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  // ── Stance/Loadout Win Counter Tests ──

  it('should increment offensiveWins on win with offensive stance', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 80,
      newELO: 1216,
      isWinner: true,
      isDraw: false,
      damageDealt: 250,
      damageTakenByOpponent: 120,
      opponentDestroyed: false,
      stance: 'offensive',
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    expect(call.data.offensiveWins).toEqual({ increment: 1 });
    expect(call.data.defensiveWins).toBeUndefined();
    expect(call.data.balancedWins).toBeUndefined();
  });

  it('should increment defensiveWins on win with defensive stance', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 80,
      newELO: 1216,
      isWinner: true,
      isDraw: false,
      damageDealt: 250,
      damageTakenByOpponent: 120,
      opponentDestroyed: false,
      stance: 'defensive',
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    expect(call.data.defensiveWins).toEqual({ increment: 1 });
    expect(call.data.offensiveWins).toBeUndefined();
    expect(call.data.balancedWins).toBeUndefined();
  });

  it('should increment balancedWins on win with balanced stance', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 80,
      newELO: 1216,
      isWinner: true,
      isDraw: false,
      damageDealt: 250,
      damageTakenByOpponent: 120,
      opponentDestroyed: false,
      stance: 'balanced',
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    expect(call.data.balancedWins).toEqual({ increment: 1 });
    expect(call.data.offensiveWins).toBeUndefined();
    expect(call.data.defensiveWins).toBeUndefined();
  });

  it('should increment dualWieldWins on win with dual_wield loadout', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 80,
      newELO: 1216,
      isWinner: true,
      isDraw: false,
      damageDealt: 250,
      damageTakenByOpponent: 120,
      opponentDestroyed: false,
      loadoutType: 'dual_wield',
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    expect(call.data.dualWieldWins).toEqual({ increment: 1 });
  });

  it('should not increment stance/loadout counters on loss', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 0,
      newELO: 1184,
      isWinner: false,
      isDraw: false,
      damageDealt: 100,
      damageTakenByOpponent: 200,
      opponentDestroyed: false,
      stance: 'offensive',
      loadoutType: 'dual_wield',
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    expect(call.data.offensiveWins).toBeUndefined();
    expect(call.data.dualWieldWins).toBeUndefined();
  });

  it('should not increment stance/loadout counters on draw', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 50,
      newELO: 1200,
      isWinner: false,
      isDraw: true,
      damageDealt: 200,
      damageTakenByOpponent: 200,
      opponentDestroyed: false,
      stance: 'defensive',
      loadoutType: 'dual_wield',
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    expect(call.data.defensiveWins).toBeUndefined();
    expect(call.data.dualWieldWins).toBeUndefined();
  });

  it('should handle league win with stance and loadout together', async () => {
    await updateRobotCombatStats({
      robotId: 1,
      finalHP: 80,
      newELO: 1216,
      isWinner: true,
      isDraw: false,
      damageDealt: 250,
      damageTakenByOpponent: 120,
      opponentDestroyed: false,
      battleType: 'league',
      stance: 'offensive',
      loadoutType: 'dual_wield',
    });

    const call = mockPrisma.robot.update.mock.calls[0][0];
    // Streak fields
    expect(call.data.currentWinStreak).toEqual({ increment: 1 });
    expect(call.data.currentLoseStreak).toBe(0);
    // Stance/loadout counters
    expect(call.data.offensiveWins).toEqual({ increment: 1 });
    expect(call.data.dualWieldWins).toEqual({ increment: 1 });
    // bestWinStreak raw SQL
    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
  });
});

describe('awardCreditsToUser', () => {
  it('should increment user currency when amount > 0', async () => {
    await awardCreditsToUser(10, 5000);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { currency: { increment: 5000 } },
    });
  });

  it('should not call prisma when amount is 0', async () => {
    await awardCreditsToUser(10, 0);

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('should not call prisma when amount is negative', async () => {
    await awardCreditsToUser(10, -100);

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});

describe('awardPrestigeToUser', () => {
  it('should increment user prestige when amount > 0', async () => {
    await awardPrestigeToUser(10, 15);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { prestige: { increment: 15 } },
    });
  });

  it('should not call prisma when amount is 0', async () => {
    await awardPrestigeToUser(10, 0);

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('should not call prisma when amount is negative', async () => {
    await awardPrestigeToUser(10, -5);

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});

describe('awardFameToRobot', () => {
  it('should increment robot fame when amount > 0', async () => {
    await awardFameToRobot(1, 8);

    expect(mockPrisma.robot.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { fame: { increment: 8 } },
    });
  });

  it('should not call prisma when amount is 0', async () => {
    await awardFameToRobot(1, 0);

    expect(mockPrisma.robot.update).not.toHaveBeenCalled();
  });

  it('should not call prisma when amount is negative', async () => {
    await awardFameToRobot(1, -3);

    expect(mockPrisma.robot.update).not.toHaveBeenCalled();
  });
});
