/**
 * Unit tests for teamBattleOrchestrator.ts and teamBattleAdapter.ts
 *
 * Tests the full execution flow (fetch → simulate → persist → reward → audit),
 * single-match failure handling, transaction rollback on reward failure,
 * audit log emission per robot, adapter promotion/demotion logic, and
 * league history recording.
 *
 * _Requirements: R1.4, R1.5, R7.10, R7.11, R8.2–R8.8, R10.4, R10.5_
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockTransaction = jest.fn();
const mockPrisma = {
  scheduledTeamBattleMatch: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  scheduledMatch: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  robot: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  battle: {
    create: jest.fn(),
    update: jest.fn(),
  },
  battleParticipant: {
    createMany: jest.fn(),
    updateMany: jest.fn(),
  },
  teamBattle: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  standing: {
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
  },
  $transaction: mockTransaction,
  $executeRaw: jest.fn(),
};

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockSimulateTeamBattle = jest.fn();
jest.mock('../../../src/services/team-battle/teamBattleEngine', () => ({
  __esModule: true,
  simulateTeamBattle: (...args: unknown[]) => mockSimulateTeamBattle(...args),
}));

const mockCalculateTeamBattleReward = jest.fn();
const mockDistributeTeamCredits = jest.fn();
const mockCalculateTeamBattleFame = jest.fn();
const mockCalculateTeamBattlePrestige = jest.fn();
const mockCalculateTeamBattleELOChanges = jest.fn();
const mockCalculateTeamBattleLPDelta = jest.fn();
const mockGetByeTeamELO = jest.fn();

jest.mock('../../../src/services/team-battle/teamBattleRewardService', () => ({
  __esModule: true,
  calculateTeamBattleReward: (...args: unknown[]) => mockCalculateTeamBattleReward(...args),
  distributeTeamCredits: (...args: unknown[]) => mockDistributeTeamCredits(...args),
  calculateTeamBattleFame: (...args: unknown[]) => mockCalculateTeamBattleFame(...args),
  calculateTeamBattlePrestige: (...args: unknown[]) => mockCalculateTeamBattlePrestige(...args),
  calculateTeamBattleELOChanges: (...args: unknown[]) => mockCalculateTeamBattleELOChanges(...args),
  calculateTeamBattleLPDelta: (...args: unknown[]) => mockCalculateTeamBattleLPDelta(...args),
  getByeTeamELO: (...args: unknown[]) => mockGetByeTeamELO(...args),
}));

const mockLogBattleAuditEvent = jest.fn();
const mockAwardCreditsToUser = jest.fn();
const mockAwardPrestigeToUser = jest.fn();
const mockAwardStreamingRevenueForParticipant = jest.fn();
const mockCheckAndAwardAchievements = jest.fn();
const mockDidRobotLosePreviousBattle = jest.fn();

jest.mock('../../../src/services/battle/battlePostCombat', () => ({
  __esModule: true,
  logBattleAuditEvent: (...args: unknown[]) => mockLogBattleAuditEvent(...args),
  awardCreditsToUser: (...args: unknown[]) => mockAwardCreditsToUser(...args),
  awardPrestigeToUser: (...args: unknown[]) => mockAwardPrestigeToUser(...args),
  awardStreamingRevenueForParticipant: (...args: unknown[]) => mockAwardStreamingRevenueForParticipant(...args),
  checkAndAwardAchievements: (...args: unknown[]) => mockCheckAndAwardAchievements(...args),
  didRobotLosePreviousBattle: (...args: unknown[]) => mockDidRobotLosePreviousBattle(...args),
}));

const mockGetCurrentCycleNumber = jest.fn();
jest.mock('../../../src/services/battle/baseOrchestrator', () => ({
  __esModule: true,
  getCurrentCycleNumber: () => mockGetCurrentCycleNumber(),
}));

jest.mock('../../../src/utils/robotCalculations', () => ({
  __esModule: true,
  prepareRobotForCombat: jest.fn(),
}));

jest.mock('../../../src/services/tuning-pool', () => ({
  __esModule: true,
  getTuningBonusesBatch: jest.fn().mockResolvedValue(new Map()),
}));

// Mock standingsService for LP/streak updates (Spec #40 — unified standings)
const mockRecordBattleResult = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/services/standings/standingsService', () => ({
  __esModule: true,
  default: {
    recordBattleResult: (...args: unknown[]) => mockRecordBattleResult(...args),
  },
}));

// Mock leagueEngine for adapter tests
const mockRebalanceAllTiers = jest.fn();
const mockDeterminePromotionsForInstance = jest.fn();
const mockDetermineDemotionsForInstance = jest.fn();
const mockPromoteEntity = jest.fn();
const mockDemoteEntity = jest.fn();

jest.mock('../../../src/services/league/leagueEngine', () => ({
  __esModule: true,
  rebalanceAllTiers: (...args: unknown[]) => mockRebalanceAllTiers(...args),
  determinePromotionsForInstance: (...args: unknown[]) => mockDeterminePromotionsForInstance(...args),
  determineDemotionsForInstance: (...args: unknown[]) => mockDetermineDemotionsForInstance(...args),
  promoteEntity: (...args: unknown[]) => mockPromoteEntity(...args),
  demoteEntity: (...args: unknown[]) => mockDemoteEntity(...args),
}));

jest.mock('../../../src/services/league/leaguePromotionThresholds', () => ({
  __esModule: true,
  getMinLPForPromotion: jest.fn().mockReturnValue(50),
}));

jest.mock('../../../src/services/league/leagueHistoryService', () => ({
  __esModule: true,
  recordTierChange: jest.fn().mockResolvedValue(undefined),
  getCurrentCycleNumber: jest.fn().mockResolvedValue(1),
}));

// ── Import under test ────────────────────────────────────────────────────────

import { executeScheduledTeamBattles } from '../../../src/services/team-battle/teamBattleOrchestrator';
import {
  teamBattleAdapter,
  TEAM_BATTLE_LEAGUE_CONFIG,
  TEAM_BATTLE_LEAGUE_TIERS,
  determineTeamBattlePromotions,
  determineTeamBattleDemotions,
  promoteTeamBattle,
  demoteTeamBattle,
  rebalanceTeamBattleLeagues,
} from '../../../src/services/team-battle/teamBattleAdapter';
import { TeamBattleResult } from '../../../src/types/teamBattleLogTypes';
import { Prisma } from '../../../generated/prisma';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRobotWithWeapons(id: number, elo: number = 1000) {
  return {
    id,
    userId: 100,
    name: `Robot ${id}`,
    elo,
    mainWeapon: null,
    offhandWeapon: null,
    mainWeaponId: null,
    offhandWeaponId: null,
    currentHP: 100,
    maxHP: 100,
    currentShield: 20,
    maxShield: 20,
  };
}

function makeScheduledMatch(
  id: number,
  teamSize: 2 | 3 = 2,
  opts: { isBye?: boolean; team1Id?: number; team2Id?: number | null } = {},
) {
  const team1Id = opts.team1Id ?? 1;
  const team2Id = opts.isBye ? null : (opts.team2Id ?? 2);
  const memberCount = teamSize;

  const team1Members = Array.from({ length: memberCount }, (_, i) => ({
    id: team1Id * 100 + i,
    teamId: team1Id,
    robotId: team1Id * 10 + i,
    slotIndex: i,
    robot: makeRobotWithWeapons(team1Id * 10 + i, 1000),
  }));

  const team2Members = team2Id
    ? Array.from({ length: memberCount }, (_, i) => ({
        id: team2Id * 100 + i,
        teamId: team2Id,
        robotId: team2Id * 10 + i,
        slotIndex: i,
        robot: makeRobotWithWeapons(team2Id * 10 + i, 1000),
      }))
    : [];

  return {
    id,
    team1Id,
    team2Id,
    teamSize,
    teamBattleLeague: 'bronze',
    teamBattleLeagueId: 'bronze_1',
    scheduledFor: new Date('2024-06-15T09:00:00Z'),
    status: 'scheduled',
    cancelReason: null,
    team1: {
      id: team1Id,
      stableId: 100,
      teamSize,
      teamName: `Team ${team1Id}`,
      members: team1Members,
      stable: { id: 100 },
    },
    team2: team2Id
      ? {
          id: team2Id,
          stableId: 200,
          teamSize,
          teamName: `Team ${team2Id}`,
          members: team2Members,
          stable: { id: 200 },
        }
      : null,
  };
}

function makeBattleResult(teamSize: 2 | 3, winningSide: 1 | 2 | null = 1): TeamBattleResult {
  const participants = [];
  for (let i = 0; i < teamSize; i++) {
    participants.push({
      robotId: 10 + i,
      team: 1 as const,
      damageDealt: 50 + i * 10,
      damageTaken: 30 + i * 5,
      finalHP: winningSide === 1 ? 40 : 0,
      survivalSeconds: 120,
    });
  }
  for (let i = 0; i < teamSize; i++) {
    participants.push({
      robotId: 20 + i,
      team: 2 as const,
      damageDealt: 30 + i * 5,
      damageTaken: 50 + i * 10,
      finalHP: winningSide === 2 ? 40 : 0,
      survivalSeconds: winningSide === 2 ? 120 : 80,
    });
  }

  return {
    winningSide,
    winnerRobotId: winningSide === 1 ? 10 : winningSide === 2 ? 20 : null,
    isDraw: winningSide === null,
    isByeMatch: false,
    durationSeconds: 120.5,
    participants,
    battleLog: [],
    focusFireEvents: [],
    focusFireMetrics: { team1: 2, team2: 1 },
    allySupportMetrics: { team1: 5, team2: 3 },
    formationDefenceMetrics: { team1: 3, team2: 2 },
    detailedCombatEvents: [],
    arenaRadius: 20,
    startingPositions: {},
    endingPositions: {},
  };
}

function setupDefaultMocks(teamSize: 2 | 3 = 2) {
  mockGetCurrentCycleNumber.mockResolvedValue(42);
  mockSimulateTeamBattle.mockReturnValue(makeBattleResult(teamSize));
  mockCalculateTeamBattleReward.mockReturnValue(18000);
  mockDistributeTeamCredits.mockImplementation((_reward, participants) =>
    participants.map((p: { robotId: number }) => ({ robotId: p.robotId, credits: 9000 })),
  );
  mockCalculateTeamBattleFame.mockReturnValue(5);
  mockCalculateTeamBattlePrestige.mockReturnValue(10);
  mockCalculateTeamBattleELOChanges.mockReturnValue({ team1Change: 16, team2Change: -16 });
  mockCalculateTeamBattleLPDelta.mockReturnValue(3);
  mockGetByeTeamELO.mockReturnValue(2000);
  mockLogBattleAuditEvent.mockResolvedValue(undefined);
  mockAwardCreditsToUser.mockResolvedValue(undefined);
  mockAwardPrestigeToUser.mockResolvedValue(undefined);
  mockAwardStreamingRevenueForParticipant.mockResolvedValue(undefined);
  mockCheckAndAwardAchievements.mockResolvedValue(undefined);
  mockDidRobotLosePreviousBattle.mockResolvedValue(false);

  // Mock robot findMany for loadTeamRobotsWithWeapons
  mockPrisma.robot.findMany.mockImplementation(({ where }: any) => {
    const ids: number[] = where.id.in;
    return Promise.resolve(ids.map(id => makeRobotWithWeapons(id)));
  });

  // Mock teamBattle.findUnique for unified orchestrator team loading
  mockPrisma.teamBattle.findUnique.mockImplementation(({ where }: any) => {
    const teamId = where.id;
    const memberCount = teamSize;
    return Promise.resolve({
      id: teamId,
      stableId: teamId * 100,
      teamSize,
      teamName: `Team ${teamId}`,
      members: Array.from({ length: memberCount }, (_, i) => ({
        id: teamId * 100 + i,
        teamId,
        robotId: teamId * 10 + i,
        slotIndex: i,
        robot: makeRobotWithWeapons(teamId * 10 + i, 1000),
      })),
      stable: { id: teamId * 100, stableName: `Stable ${teamId}` },
    });
  });
}

/**
 * Helper: set up scheduledMatch.findMany mock from old-style match data.
 * Converts makeScheduledMatch output to the unified format the orchestrator now expects.
 */
function mockUnifiedScheduledMatches(matches: ReturnType<typeof makeScheduledMatch>[], teamSize: 2 | 3 = 2) {
  const unified = matches.map(m => ({
    id: m.id,
    matchType: teamSize === 2 ? 'league_2v2' : 'league_3v3',
    status: 'scheduled',
    scheduledFor: m.scheduledFor,
    leagueType: m.teamBattleLeague,
    leagueInstanceId: m.teamBattleLeagueId,
    cancelReason: null,
    createdAt: m.scheduledFor,
    battleId: null,
    participants: [
      { id: 1, participantType: 'team', participantId: m.team1Id, slot: 1 },
      ...(m.team2Id ? [{ id: 2, participantType: 'team', participantId: m.team2Id, slot: 2 }] : []),
    ],
  }));
  mockPrisma.scheduledMatch.findMany.mockResolvedValue(unified);
}

// ── Tests: Orchestrator ──────────────────────────────────────────────────────

describe('teamBattleOrchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  describe('executeScheduledTeamBattles — full execution flow', () => {
    it('should fetch scheduled matches, simulate, persist, reward, and audit (R1.4)', async () => {
      const match = makeScheduledMatch(1, 2);
      mockUnifiedScheduledMatches([match]);

      // Transaction mock: execute the callback and return a battle record
      mockTransaction.mockImplementation(async (cb: Function) => {
        const tx = {
          battle: { create: jest.fn().mockResolvedValue({ id: 99 }), update: jest.fn() },
          battleParticipant: { createMany: jest.fn(), updateMany: jest.fn() },
          robot: { update: jest.fn() },
          scheduledMatch: { update: jest.fn() },
        };
        return cb(tx);
      });

      const result = await executeScheduledTeamBattles(2);

      expect(result.matchesCompleted).toBe(1);
      expect(result.matchesCancelled).toBe(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].status).toBe('completed');
      expect(result.results[0].battleId).toBe(99);

      // Verify simulation was called
      expect(mockSimulateTeamBattle).toHaveBeenCalledTimes(1);

      // Verify reward calculation was called
      expect(mockCalculateTeamBattleReward).toHaveBeenCalled();

      // Verify audit logs emitted per robot (2 robots per team × 2 teams = 4)
      expect(mockLogBattleAuditEvent).toHaveBeenCalledTimes(4);
    });

    it('should set battleType to league_2v2 for 2v2 matches', async () => {
      const match = makeScheduledMatch(1, 2);
      mockUnifiedScheduledMatches([match]);

      let createdBattleData: any = null;
      mockTransaction.mockImplementation(async (cb: Function) => {
        const tx = {
          battle: {
            create: jest.fn().mockImplementation(({ data }) => {
              createdBattleData = data;
              return { id: 99 };
            }),
            update: jest.fn(),
          },
          battleParticipant: { createMany: jest.fn(), updateMany: jest.fn() },
          robot: { update: jest.fn() },
          scheduledMatch: { update: jest.fn() },
        };
        return cb(tx);
      });

      await executeScheduledTeamBattles(2);

      expect(createdBattleData.battleType).toBe('league_2v2');
    });

    it('should set battleType to league_3v3 for 3v3 matches', async () => {
      setupDefaultMocks(3);
      const match = makeScheduledMatch(1, 3);
      mockUnifiedScheduledMatches([match]);

      let createdBattleData: any = null;
      mockTransaction.mockImplementation(async (cb: Function) => {
        const tx = {
          battle: {
            create: jest.fn().mockImplementation(({ data }) => {
              createdBattleData = data;
              return { id: 99 };
            }),
            update: jest.fn(),
          },
          battleParticipant: { createMany: jest.fn(), updateMany: jest.fn() },
          robot: { update: jest.fn() },
          scheduledMatch: { update: jest.fn() },
        };
        return cb(tx);
      });

      await executeScheduledTeamBattles(3);

      expect(createdBattleData.battleType).toBe('league_3v3');
    });

    it('should persist exactly 2N BattleParticipant rows (R1.5)', async () => {
      const match = makeScheduledMatch(1, 2);
      mockUnifiedScheduledMatches([match]);

      let participantData: any[] = [];
      mockTransaction.mockImplementation(async (cb: Function) => {
        const tx = {
          battle: { create: jest.fn().mockResolvedValue({ id: 99 }), update: jest.fn() },
          battleParticipant: {
            createMany: jest.fn().mockImplementation(({ data }) => {
              participantData = data;
            }),
            updateMany: jest.fn(),
          },
          robot: { update: jest.fn() },
          scheduledMatch: { update: jest.fn() },
        };
        return cb(tx);
      });

      await executeScheduledTeamBattles(2);

      // 2v2 = 4 participants (2 per team)
      expect(participantData).toHaveLength(4);
      const team1Participants = participantData.filter((p: any) => p.team === 1);
      const team2Participants = participantData.filter((p: any) => p.team === 2);
      expect(team1Participants).toHaveLength(2);
      expect(team2Participants).toHaveLength(2);
    });

    it('should return empty results when no scheduled matches exist', async () => {
      mockUnifiedScheduledMatches([]);

      const result = await executeScheduledTeamBattles(2);

      expect(result.matchesCompleted).toBe(0);
      expect(result.matchesCancelled).toBe(0);
      expect(result.results).toHaveLength(0);
    });
  });

  describe('single-match failure handling (R10.5)', () => {
    it('should mark failed match as cancelled and continue remaining', async () => {
      const match1 = makeScheduledMatch(1, 2);
      const match2 = makeScheduledMatch(2, 2, { team1Id: 3, team2Id: 4 });
      mockUnifiedScheduledMatches([match1, match2]);

      let callCount = 0;
      mockTransaction.mockImplementation(async (cb: Function) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Simulation failed for match 1');
        }
        const tx = {
          battle: { create: jest.fn().mockResolvedValue({ id: 100 }), update: jest.fn() },
          battleParticipant: { createMany: jest.fn(), updateMany: jest.fn() },
          robot: { update: jest.fn() },
          scheduledMatch: { update: jest.fn() },
        };
        return cb(tx);
      });

      mockPrisma.scheduledMatch.update.mockResolvedValue({});

      const result = await executeScheduledTeamBattles(2);

      expect(result.matchesCompleted).toBe(1);
      expect(result.matchesCancelled).toBe(1);
      expect(result.results[0].status).toBe('cancelled');
      expect(result.results[0].error).toContain('Simulation failed');
      expect(result.results[1].status).toBe('completed');

      // Verify the failed match was marked as cancelled in DB
      expect(mockPrisma.scheduledMatch.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          status: 'cancelled',
          cancelReason: expect.stringContaining('Simulation failed'),
        }),
      });
    });

    it('should handle all matches failing gracefully', async () => {
      const match1 = makeScheduledMatch(1, 2);
      const match2 = makeScheduledMatch(2, 2, { team1Id: 3, team2Id: 4 });
      mockUnifiedScheduledMatches([match1, match2]);

      mockTransaction.mockRejectedValue(new Error('DB connection lost'));
      mockPrisma.scheduledMatch.update.mockResolvedValue({});

      const result = await executeScheduledTeamBattles(2);

      expect(result.matchesCompleted).toBe(0);
      expect(result.matchesCancelled).toBe(2);
    });
  });

  describe('transaction rollback on reward failure (R7.11)', () => {
    it('should rollback entire transaction when reward distribution fails', async () => {
      const match = makeScheduledMatch(1, 2);
      mockUnifiedScheduledMatches([match]);

      // Transaction throws (simulating rollback)
      mockTransaction.mockRejectedValue(new Error('Credit distribution failed'));
      mockPrisma.scheduledMatch.update.mockResolvedValue({});

      const result = await executeScheduledTeamBattles(2);

      expect(result.matchesCompleted).toBe(0);
      expect(result.matchesCancelled).toBe(1);
      expect(result.results[0].error).toContain('Credit distribution failed');
    });

    it('should not emit audit logs when transaction rolls back', async () => {
      const match = makeScheduledMatch(1, 2);
      mockUnifiedScheduledMatches([match]);

      mockTransaction.mockRejectedValue(new Error('Transaction failed'));
      mockPrisma.scheduledMatch.update.mockResolvedValue({});

      await executeScheduledTeamBattles(2);

      // Audit logs are emitted AFTER the transaction, so they should not fire
      expect(mockLogBattleAuditEvent).not.toHaveBeenCalled();
    });
  });

  describe('audit log emission per robot (R10.4)', () => {
    it('should emit one audit log per participating robot in 2v2', async () => {
      const match = makeScheduledMatch(1, 2);
      mockUnifiedScheduledMatches([match]);

      mockTransaction.mockImplementation(async (cb: Function) => {
        const tx = {
          battle: { create: jest.fn().mockResolvedValue({ id: 99 }), update: jest.fn() },
          battleParticipant: { createMany: jest.fn(), updateMany: jest.fn() },
          robot: { update: jest.fn() },
          scheduledMatch: { update: jest.fn() },
        };
        return cb(tx);
      });

      await executeScheduledTeamBattles(2);

      // 2 robots per team × 2 teams = 4 audit log calls
      expect(mockLogBattleAuditEvent).toHaveBeenCalledTimes(4);
    });

    it('should emit one audit log per participating robot in 3v3', async () => {
      setupDefaultMocks(3);
      const match = makeScheduledMatch(1, 3);
      mockUnifiedScheduledMatches([match]);

      mockTransaction.mockImplementation(async (cb: Function) => {
        const tx = {
          battle: { create: jest.fn().mockResolvedValue({ id: 99 }), update: jest.fn() },
          battleParticipant: { createMany: jest.fn(), updateMany: jest.fn() },
          robot: { update: jest.fn() },
          scheduledMatch: { update: jest.fn() },
        };
        return cb(tx);
      });

      await executeScheduledTeamBattles(3);

      // 3 robots per team × 2 teams = 6 audit log calls
      expect(mockLogBattleAuditEvent).toHaveBeenCalledTimes(6);
    });

    it('should include team battle metadata in audit log extras', async () => {
      const match = makeScheduledMatch(1, 2);
      mockUnifiedScheduledMatches([match]);

      mockTransaction.mockImplementation(async (cb: Function) => {
        const tx = {
          battle: { create: jest.fn().mockResolvedValue({ id: 99 }), update: jest.fn() },
          battleParticipant: { createMany: jest.fn(), updateMany: jest.fn() },
          robot: { update: jest.fn() },
          scheduledMatch: { update: jest.fn() },
        };
        return cb(tx);
      });

      await executeScheduledTeamBattles(2);

      // Check that the extras include team battle metadata
      const lastCall = mockLogBattleAuditEvent.mock.calls[0];
      const extras = lastCall[5]; // 6th argument is extras
      expect(extras).toEqual(expect.objectContaining({
        isTeamBattle: true,
        teamSize: 2,
        teamId: 1,
      }));
    });

    it('should include opponent team name and LP delta in audit log extras (R9.7)', async () => {
      const match = makeScheduledMatch(1, 2);
      mockUnifiedScheduledMatches([match]);
      mockCalculateTeamBattleLPDelta.mockReturnValue(3);

      mockTransaction.mockImplementation(async (cb: Function) => {
        const tx = {
          battle: { create: jest.fn().mockResolvedValue({ id: 99 }), update: jest.fn() },
          battleParticipant: { createMany: jest.fn(), updateMany: jest.fn() },
          robot: { update: jest.fn() },
          scheduledMatch: { update: jest.fn() },
        };
        return cb(tx);
      });

      await executeScheduledTeamBattles(2);

      // Team 1 robots should have opponent team name = "Team 2" and LP delta = 3 (win)
      const team1Call = mockLogBattleAuditEvent.mock.calls[0];
      const team1Extras = team1Call[5];
      expect(team1Extras).toEqual(expect.objectContaining({
        isTeamBattle: true,
        teamSize: 2,
        teamId: 1,
        opponentTeamId: 2,
        opponentTeamName: 'Team 2',
        teamLpDelta: 3,
      }));

      // Team 2 robots should have opponent team name = "Team 1" and LP delta = 3 (loss returns same mock value)
      const team2CallIndex = 2; // First 2 calls are for team1 robots
      const team2Call = mockLogBattleAuditEvent.mock.calls[team2CallIndex];
      const team2Extras = team2Call[5];
      expect(team2Extras).toEqual(expect.objectContaining({
        isTeamBattle: true,
        teamSize: 2,
        teamId: 2,
        opponentTeamId: 1,
        opponentTeamName: 'Team 1',
        teamLpDelta: 3,
      }));
    });

    it('should set opponent team name to "Bye" for bye matches (R9.7)', async () => {
      const match = makeScheduledMatch(1, 2, { isBye: true });
      mockUnifiedScheduledMatches([match]);
      mockCalculateTeamBattleLPDelta.mockReturnValue(3);

      mockTransaction.mockImplementation(async (cb: Function) => {
        const tx = {
          battle: { create: jest.fn().mockResolvedValue({ id: 99 }), update: jest.fn() },
          battleParticipant: { createMany: jest.fn(), updateMany: jest.fn() },
          robot: { update: jest.fn() },
          scheduledMatch: { update: jest.fn() },
        };
        return cb(tx);
      });

      await executeScheduledTeamBattles(2);

      // Team 1 robots should have opponent team name = "Bye"
      const team1Call = mockLogBattleAuditEvent.mock.calls[0];
      const team1Extras = team1Call[5];
      expect(team1Extras).toEqual(expect.objectContaining({
        opponentTeamName: 'Bye',
        teamLpDelta: 3,
      }));
    });

    it('should continue execution even if audit log fails for one robot', async () => {
      const match = makeScheduledMatch(1, 2);
      mockUnifiedScheduledMatches([match]);

      mockTransaction.mockImplementation(async (cb: Function) => {
        const tx = {
          battle: { create: jest.fn().mockResolvedValue({ id: 99 }), update: jest.fn() },
          battleParticipant: { createMany: jest.fn(), updateMany: jest.fn() },
          robot: { update: jest.fn() },
          scheduledMatch: { update: jest.fn() },
        };
        return cb(tx);
      });

      // First audit log call fails, rest succeed
      mockLogBattleAuditEvent
        .mockRejectedValueOnce(new Error('Audit log DB error'))
        .mockResolvedValue(undefined);

      const result = await executeScheduledTeamBattles(2);

      // Match should still be completed despite audit log failure
      expect(result.matchesCompleted).toBe(1);
      expect(result.matchesCancelled).toBe(0);
      // All 4 audit log calls should still be attempted
      expect(mockLogBattleAuditEvent).toHaveBeenCalledTimes(4);
    });
  });

  describe('bye-match handling', () => {
    it('should handle bye matches without team2 robots', async () => {
      const match = makeScheduledMatch(1, 2, { isBye: true });
      mockUnifiedScheduledMatches([match]);

      mockTransaction.mockImplementation(async (cb: Function) => {
        const tx = {
          battle: { create: jest.fn().mockResolvedValue({ id: 99 }), update: jest.fn() },
          battleParticipant: { createMany: jest.fn(), updateMany: jest.fn() },
          robot: { update: jest.fn() },
          scheduledMatch: { update: jest.fn() },
        };
        return cb(tx);
      });

      const result = await executeScheduledTeamBattles(2);

      expect(result.matchesCompleted).toBe(1);
      // Simulation should still be called
      expect(mockSimulateTeamBattle).toHaveBeenCalledTimes(1);
    });
  });
});

// ── Tests: Adapter ───────────────────────────────────────────────────────────

describe('teamBattleAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('configuration', () => {
    it('should have correct promotion/demotion percentages', () => {
      expect(TEAM_BATTLE_LEAGUE_CONFIG.promotionPercentage).toBe(0.10);
      expect(TEAM_BATTLE_LEAGUE_CONFIG.demotionPercentage).toBe(0.10);
    });

    it('should require 5 minimum cycles for rebalancing', () => {
      expect(TEAM_BATTLE_LEAGUE_CONFIG.minCyclesForRebalancing).toBe(5);
    });

    it('should require 4 minimum entities for rebalancing', () => {
      expect(TEAM_BATTLE_LEAGUE_CONFIG.minEntitiesForRebalancing).toBe(4);
    });

    it('should require 3 minimum cohort for new tier', () => {
      expect(TEAM_BATTLE_LEAGUE_CONFIG.minCohortForNewTier).toBe(3);
    });

    it('should use team_battle entity type', () => {
      expect(TEAM_BATTLE_LEAGUE_CONFIG.logPrefix).toBe('TeamBattleRebalancing');
      expect(teamBattleAdapter.entityType).toBe('team_battle');
    });

    it('should have six-tier structure matching 1v1', () => {
      expect(TEAM_BATTLE_LEAGUE_TIERS).toEqual([
        'bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion',
      ]);
    });
  });

  describe('adapter entity accessors', () => {
    // Mock entity as a standings record (unified Spec #40 shape)
    const mockStanding = {
      id: 1,
      entityId: 100,
      entityType: 'team',
      mode: 'league_2v2',
      tier: 'silver',
      leagueInstanceId: 'silver_2',
      cyclesInTier: 10,
      wins: 5,
      losses: 3,
      draws: 1,
    };

    it('should return correct current tier', () => {
      expect(teamBattleAdapter.getEntityCurrentTier(mockStanding as any)).toBe('silver');
    });

    it('should return correct league ID', () => {
      expect(teamBattleAdapter.getEntityLeagueId(mockStanding as any)).toBe('silver_2');
    });

    it('should return correct league points', () => {
      expect(teamBattleAdapter.getEntityLeaguePoints(mockStanding as any)).toBe(75);
    });

    it('should return correct owner ID (entityId)', () => {
      expect(teamBattleAdapter.getEntityOwnerId(mockStanding as any)).toBe(100);
    });

    it('should return descriptive display name', () => {
      const name = teamBattleAdapter.getEntityDisplayName(mockStanding as any);
      expect(name).toContain('team');
      expect(name).toContain('100');
    });
  });

  describe('adapter Prisma queries', () => {
    it('should query entities with min points ordered by LP desc', async () => {
      const standings = [
        { id: 1, entityId: 10, leaguePoints: 80 },
        { id: 2, entityId: 20, leaguePoints: 60 },
      ];
      mockPrisma.standing.findMany.mockResolvedValue(standings);

      const result = await teamBattleAdapter.getEntitiesWithMinPoints(
        'bronze_1', 50, 5, new Set([99]),
      );

      expect(mockPrisma.standing.findMany).toHaveBeenCalledWith({
        where: {
          mode: 'league_2v2',
          leagueInstanceId: 'bronze_1',
          cyclesInTier: { gte: 5 },
          NOT: { entityId: { in: [99] } },
        },
        orderBy: [{ leaguePoints: 'desc' }],
      });
      expect(result).toEqual(standings);
    });

    it('should count eligible entities in instance', async () => {
      mockPrisma.standing.count.mockResolvedValue(12);

      const result = await teamBattleAdapter.countEligibleInInstance(
        'silver_1', 5, new Set([1, 2]),
      );

      expect(mockPrisma.standing.count).toHaveBeenCalledWith({
        where: {
          mode: 'league_2v2',
          leagueInstanceId: 'silver_1',
          cyclesInTier: { gte: 5 },
          NOT: { entityId: { in: [1, 2] } },
        },
      });
      expect(result).toBe(12);
    });

    it('should query entities for demotion ordered by LP asc', async () => {
      const standings = [
        { id: 3, entityId: 30, leaguePoints: 10 },
        { id: 4, entityId: 40, leaguePoints: 20 },
      ];
      mockPrisma.standing.findMany.mockResolvedValue(standings);

      const result = await teamBattleAdapter.getEntitiesForDemotion(
        'gold_1', 5, new Set(),
      );

      expect(mockPrisma.standing.findMany).toHaveBeenCalledWith({
        where: {
          mode: 'league_2v2',
          leagueInstanceId: 'gold_1',
          cyclesInTier: { gte: 5 },
          NOT: { entityId: { in: [] } },
        },
        orderBy: [{ leaguePoints: 'asc' }],
      });
      expect(result).toEqual(standings);
    });

    it('should get instances for a tier', async () => {
      mockPrisma.standing.findMany.mockResolvedValue([
        { leagueInstanceId: 'bronze_1' },
        { leagueInstanceId: 'bronze_2' },
      ]);

      const result = await teamBattleAdapter.getInstancesForTier('bronze');

      expect(mockPrisma.standing.findMany).toHaveBeenCalledWith({
        where: { mode: 'league_2v2', tier: 'bronze' },
        distinct: ['leagueInstanceId'],
        select: { leagueInstanceId: true },
      });
      expect(result).toEqual([
        { leagueId: 'bronze_1' },
        { leagueId: 'bronze_2' },
      ]);
    });

    it('should count entities in tier', async () => {
      mockPrisma.standing.count.mockResolvedValue(45);

      const result = await teamBattleAdapter.countEntitiesInTier('diamond');

      expect(mockPrisma.standing.count).toHaveBeenCalledWith({
        where: { mode: 'league_2v2', tier: 'diamond' },
      });
      expect(result).toBe(45);
    });

    it('should update entity league on promotion/demotion', async () => {
      mockPrisma.standing.updateMany.mockResolvedValue({ count: 1 });

      await teamBattleAdapter.updateEntityLeague(5, 'gold', 'gold_1');

      expect(mockPrisma.standing.updateMany).toHaveBeenCalledWith({
        where: { entityType: 'team', entityId: 5, mode: 'league_2v2' },
        data: {
          tier: 'gold',
          leagueInstanceId: 'gold_1',
          cyclesInTier: 0,
        },
      });
    });
  });

  describe('promotion/demotion logic (R8.2–R8.8)', () => {
    it('should delegate promotions to leagueEngine determinePromotionsForInstance', async () => {
      const promotedTeams = [{ id: 1 }];
      mockDeterminePromotionsForInstance.mockResolvedValue(promotedTeams);

      const result = await determineTeamBattlePromotions('bronze_1');

      expect(mockDeterminePromotionsForInstance).toHaveBeenCalledWith(
        'bronze_1',
        TEAM_BATTLE_LEAGUE_CONFIG,
        teamBattleAdapter,
        new Set(),
      );
      expect(result).toEqual(promotedTeams);
    });

    it('should delegate demotions to leagueEngine determineDemotionsForInstance', async () => {
      const demotedTeams = [{ id: 2 }];
      mockDetermineDemotionsForInstance.mockResolvedValue(demotedTeams);

      const result = await determineTeamBattleDemotions('silver_1');

      expect(mockDetermineDemotionsForInstance).toHaveBeenCalledWith(
        'silver_1',
        TEAM_BATTLE_LEAGUE_CONFIG,
        teamBattleAdapter,
        new Set(),
      );
      expect(result).toEqual(demotedTeams);
    });

    it('should pass excludeTeamIds to promotion determination', async () => {
      mockDeterminePromotionsForInstance.mockResolvedValue([]);
      const excludeIds = new Set([10, 20, 30]);

      await determineTeamBattlePromotions('gold_1', excludeIds);

      expect(mockDeterminePromotionsForInstance).toHaveBeenCalledWith(
        'gold_1',
        TEAM_BATTLE_LEAGUE_CONFIG,
        teamBattleAdapter,
        excludeIds,
      );
    });

    it('should delegate promoteTeamBattle to leagueEngine promoteEntity', async () => {
      const team = { id: 1 };
      mockPromoteEntity.mockResolvedValue(undefined);

      await promoteTeamBattle(team as any);

      expect(mockPromoteEntity).toHaveBeenCalledWith(
        team,
        TEAM_BATTLE_LEAGUE_CONFIG,
        teamBattleAdapter,
      );
    });

    it('should delegate demoteTeamBattle to leagueEngine demoteEntity', async () => {
      const team = { id: 2 };
      mockDemoteEntity.mockResolvedValue(undefined);

      await demoteTeamBattle(team as any);

      expect(mockDemoteEntity).toHaveBeenCalledWith(
        team,
        TEAM_BATTLE_LEAGUE_CONFIG,
        teamBattleAdapter,
      );
    });
  });

  describe('league history recording via rebalanceTeamBattleLeagues', () => {
    it('should delegate to rebalanceAllTiers with correct config and adapter', async () => {
      mockRebalanceAllTiers.mockResolvedValue({
        totalEntities: 100,
        totalPromoted: 5,
        totalDemoted: 5,
        tierSummaries: [
          { tier: 'bronze', entitiesInTier: 50, promoted: 3, demoted: 0, eligibleEntities: 40 },
          { tier: 'silver', entitiesInTier: 30, promoted: 2, demoted: 3, eligibleEntities: 25 },
          { tier: 'gold', entitiesInTier: 20, promoted: 0, demoted: 2, eligibleEntities: 15 },
        ],
        errors: [],
      });

      const result = await rebalanceTeamBattleLeagues();

      expect(mockRebalanceAllTiers).toHaveBeenCalledWith(
        TEAM_BATTLE_LEAGUE_CONFIG,
        teamBattleAdapter,
      );
      expect(result.totalTeams).toBe(100);
      expect(result.totalPromoted).toBe(5);
      expect(result.totalDemoted).toBe(5);
      expect(result.tierSummaries).toHaveLength(3);
      expect(result.tierSummaries[0].tier).toBe('bronze');
      expect(result.tierSummaries[0].teamsInTier).toBe(50);
      expect(result.errors).toHaveLength(0);
    });

    it('should propagate errors from rebalanceAllTiers', async () => {
      mockRebalanceAllTiers.mockResolvedValue({
        totalEntities: 50,
        totalPromoted: 0,
        totalDemoted: 0,
        tierSummaries: [],
        errors: ['Failed to process gold tier'],
      });

      const result = await rebalanceTeamBattleLeagues();

      expect(result.errors).toContain('Failed to process gold tier');
    });
  });

  describe('instance assignment', () => {
    it('should assign to first instance when tier is empty', async () => {
      mockTransaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $executeRaw: jest.fn(),
          standing: {
            groupBy: jest.fn().mockResolvedValue([]),
          },
        };
        return cb(tx);
      });

      const result = await teamBattleAdapter.assignInstance('bronze');

      expect(result).toBe('bronze_1');
    });

    it('should assign to least-full instance when space available', async () => {
      mockTransaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $executeRaw: jest.fn(),
          standing: {
            groupBy: jest.fn().mockResolvedValue([
              { leagueInstanceId: 'bronze_1', _count: { id: 40 } },
              { leagueInstanceId: 'bronze_2', _count: { id: 20 } },
            ]),
          },
        };
        return cb(tx);
      });

      const result = await teamBattleAdapter.assignInstance('bronze');

      expect(result).toBe('bronze_2');
    });

    it('should create new instance when all are full (50 teams)', async () => {
      mockTransaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $executeRaw: jest.fn(),
          standing: {
            groupBy: jest.fn().mockResolvedValue([
              { leagueInstanceId: 'bronze_1', _count: { id: 50 } },
              { leagueInstanceId: 'bronze_2', _count: { id: 50 } },
            ]),
          },
        };
        return cb(tx);
      });

      const result = await teamBattleAdapter.assignInstance('bronze');

      expect(result).toBe('bronze_3');
    });
  });
});
