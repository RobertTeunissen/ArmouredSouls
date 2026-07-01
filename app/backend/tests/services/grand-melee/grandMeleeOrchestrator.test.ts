/**
 * Unit tests for Grand Melee Battle Orchestrator.
 *
 * Tests the executeScheduledGrandMeleeBattles entry point and
 * processGrandMeleeBattle flow with mocked dependencies.
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  scheduledMatch: {
    count: jest.fn().mockResolvedValue(0),
    findFirst: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  robot: {
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
  },
  standing: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  battle: {
    create: jest.fn().mockResolvedValue({ id: 100 }),
  },
  battleParticipant: {
    createMany: jest.fn().mockResolvedValue({ count: 20 }),
    update: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
  },
  battleSummary: {
    create: jest.fn().mockResolvedValue({}),
  },
  user: {
    update: jest.fn().mockResolvedValue({}),
  },
  $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.resolve(Array.isArray(ops) ? ops.map(() => ({})) : undefined)),
};

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/services/battle/combatSimulator', () => ({
  simulateBattleMulti: jest.fn(),
}));

jest.mock('../../../src/services/battle/combatMessageGenerator', () => ({
  CombatMessageGenerator: {
    buildKothBattleLog: jest.fn().mockReturnValue({ events: [], placements: [] }),
  },
}));

jest.mock('../../../src/services/battle/battlePostCombat', () => ({
  logBattleAuditEvent: jest.fn().mockResolvedValue(undefined),
  checkAndAwardAchievements: jest.fn().mockResolvedValue(undefined),
  updateRobotCombatStats: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/services/standings/standingsService', () => ({
  __esModule: true,
  default: { awardGrandMeleePoints: jest.fn().mockResolvedValue({}) },
}));

jest.mock('../../../src/services/economy/streamingRevenueService', () => ({
  calculateStreamingRevenueBatch: jest.fn().mockResolvedValue(new Map()),
}));

jest.mock('../../../src/services/battle/baseOrchestrator', () => ({
  getCurrentCycleNumber: jest.fn().mockResolvedValue(5),
}));

jest.mock('../../../src/utils/robotCalculations', () => ({
  prepareRobotForCombat: jest.fn(),
}));

jest.mock('../../../src/services/tuning-pool', () => ({
  getTuningBonusesBatch: jest.fn().mockResolvedValue(new Map()),
}));

jest.mock('../../../src/services/grand-melee/grandMeleeRewards', () => ({
  calculateGrandMeleeRewards: jest.fn().mockReturnValue({ credits: 500, fame: 5, prestige: 10, lpDelta: 25 }),
}));

jest.mock('../../../src/services/scheduling/schedulingService', () => ({
  __esModule: true,
  default: { completeMatch: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../../src/services/battle/battleSummaryComputer', () => ({
  computeBattleSummary: jest.fn().mockReturnValue({ perRobotStats: {}, damageFlows: {} }),
}));

import { executeScheduledGrandMeleeBattles } from '../../../src/services/grand-melee/grandMeleeBattleOrchestrator';
import { simulateBattleMulti } from '../../../src/services/battle/combatSimulator';
import { updateRobotCombatStats } from '../../../src/services/battle/battlePostCombat';
import standingsService from '../../../src/services/standings/standingsService';
import schedulingService from '../../../src/services/scheduling/schedulingService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRobot(id: number, userId: number = id) {
  return {
    id,
    userId,
    name: `Robot-${id}`,
    elo: 1200 + id,
    maxHP: 100,
    currentHP: 100,
    currentShield: 0,
    maxShield: 0,
    stance: 'balanced',
    loadoutType: 'single',
    mainWeaponId: 1,
    offhandWeaponId: null,
    fame: 10,
    grandMeleeWins: 0,
    grandMeleeTop3: 0,
    mainWeapon: { id: 1, weapon: { id: 1, name: 'Laser', damage: 20, weaponType: 'laser', accuracy: 80, critChance: 5, critMultiplier: 1.5 }, refinements: [] },
    offhandWeapon: null,
  };
}

function makeSimResult(robotCount: number) {
  const finalStates = Array.from({ length: robotCount }, (_, i) => ({
    robot: { id: i + 1, name: `Robot-${i + 1}` },
    isAlive: i === 0,
    currentHP: i === 0 ? 50 : 0,
    maxHP: 100,
    totalDamageDealt: 200 - i * 10,
  }));

  const events = Array.from({ length: robotCount - 1 }, (_, i) => ({
    type: 'destroyed',
    attacker: 'Robot-1',
    defender: `Robot-${i + 2}`,
    timestamp: (i + 1) * 10,
  }));

  return {
    winnerId: 1,
    finalStates,
    events,
    durationSeconds: 180,
    startingPositions: {},
    endingPositions: {},
  };
}

function makeScheduledMatch(id: number, participantCount: number) {
  return {
    id,
    matchType: 'grand_melee',
    status: 'scheduled',
    scheduledFor: new Date(),
    leagueType: 'bronze',
    leagueInstanceId: 'bronze_1',
    isByeMatch: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    participants: Array.from({ length: participantCount }, (_, i) => ({
      id: i + 1,
      scheduledMatchId: id,
      participantType: 'robot',
      participantId: i + 1,
      slot: i + 1,
    })),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('executeScheduledGrandMeleeBattles', () => {
  it('should return empty summary when no matches are scheduled', async () => {
    mockPrisma.scheduledMatch.count.mockResolvedValueOnce(0);

    const summary = await executeScheduledGrandMeleeBattles();

    expect(summary.totalMatches).toBe(0);
    expect(summary.successfulMatches).toBe(0);
    expect(summary.failedMatches).toBe(0);
    expect(summary.matchResults).toHaveLength(0);
  });

  it('should process a match end-to-end successfully', async () => {
    const match = makeScheduledMatch(1, 10);
    const robots = Array.from({ length: 10 }, (_, i) => makeRobot(i + 1));
    const simResult = makeSimResult(10);

    mockPrisma.scheduledMatch.count.mockResolvedValueOnce(1);
    mockPrisma.scheduledMatch.findFirst.mockResolvedValueOnce(match);
    mockPrisma.robot.findMany.mockResolvedValueOnce(robots);
    (simulateBattleMulti as jest.Mock).mockReturnValueOnce(simResult);

    const summary = await executeScheduledGrandMeleeBattles();

    expect(summary.totalMatches).toBe(1);
    expect(summary.successfulMatches).toBe(1);
    expect(summary.failedMatches).toBe(0);
    expect(summary.matchResults).toHaveLength(1);
    expect(summary.matchResults[0].winnerId).toBe(1);
    expect(summary.totalRobotsInvolved).toBe(10);

    // Verify combat was run
    expect(simulateBattleMulti).toHaveBeenCalledTimes(1);
    expect(simulateBattleMulti).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ allowDraws: false, arenaRadius: 16 + (10 - 2) * 3 }),
    );

    // Verify BattleParticipant records created
    expect(mockPrisma.battleParticipant.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ battleId: 100, robotId: 1, placement: 1 }),
        ]),
      }),
    );

    // Verify standings updated for all participants
    expect(standingsService.awardGrandMeleePoints).toHaveBeenCalledTimes(10);

    // Verify robot combat stats updated for all participants
    expect(updateRobotCombatStats).toHaveBeenCalledTimes(10);
    expect(updateRobotCombatStats).toHaveBeenCalledWith(
      expect.objectContaining({
        robotId: 1,
        isWinner: true,
        battleType: 'grand_melee',
        skipBattleCounters: true,
      }),
    );

    // Verify match marked as completed
    expect(schedulingService.completeMatch).toHaveBeenCalledWith(1, 100);

    // Verify grandMeleeWins/Top3 counters incremented
    expect(mockPrisma.robot.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: { grandMeleeWins: { increment: 1 } } }),
    );
  });

  it('should fail gracefully when below minimum participants', async () => {
    const match = makeScheduledMatch(1, 5);
    const robots = Array.from({ length: 5 }, (_, i) => makeRobot(i + 1));

    mockPrisma.scheduledMatch.count.mockResolvedValueOnce(1);
    mockPrisma.scheduledMatch.findFirst.mockResolvedValueOnce(match);
    mockPrisma.robot.findMany.mockResolvedValueOnce(robots);

    const summary = await executeScheduledGrandMeleeBattles();

    expect(summary.failedMatches).toBe(1);
    expect(summary.successfulMatches).toBe(0);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toContain('expected at least 8 robots');
  });

  it('should use correct arena radius formula: 16 + (N-2) * 3', async () => {
    const match = makeScheduledMatch(1, 20);
    const robots = Array.from({ length: 20 }, (_, i) => makeRobot(i + 1));

    mockPrisma.scheduledMatch.count.mockResolvedValueOnce(1);
    mockPrisma.scheduledMatch.findFirst.mockResolvedValueOnce(match);
    mockPrisma.robot.findMany.mockResolvedValueOnce(robots);
    (simulateBattleMulti as jest.Mock).mockReturnValueOnce(makeSimResult(20));

    await executeScheduledGrandMeleeBattles();

    // 16 + (20 - 2) * 3 = 16 + 54 = 70
    expect(simulateBattleMulti).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ arenaRadius: 70 }),
    );
  });

  it('should create battle with correct type and winning_side', async () => {
    const match = makeScheduledMatch(1, 8);
    const robots = Array.from({ length: 8 }, (_, i) => makeRobot(i + 1));

    mockPrisma.scheduledMatch.count.mockResolvedValueOnce(1);
    mockPrisma.scheduledMatch.findFirst.mockResolvedValueOnce(match);
    mockPrisma.robot.findMany.mockResolvedValueOnce(robots);
    (simulateBattleMulti as jest.Mock).mockReturnValueOnce(makeSimResult(8));

    await executeScheduledGrandMeleeBattles();

    expect(mockPrisma.battle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          battleType: 'grand_melee',
          winnerId: 1,
        }),
      }),
    );
  });
});
