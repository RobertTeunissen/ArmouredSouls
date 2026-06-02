/**
 * Unit tests for team tournament cron handlers (Spec 38, Task 7.3).
 *
 * Tests `executeTeam2v2TournamentCycle` and `executeTeam3v3TournamentCycle`
 * handlers that run at 15:00 UTC and 18:00 UTC respectively.
 *
 * _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock node-cron to avoid actual scheduling
const mockSchedule = jest.fn().mockImplementation(() => ({
  stop: jest.fn(),
  start: jest.fn(),
  now: jest.fn(),
  on: jest.fn(),
  emit: jest.fn(),
}));
jest.mock('node-cron', () => ({
  __esModule: true,
  default: { schedule: (...args: any[]) => mockSchedule(...args) },
  schedule: (...args: any[]) => mockSchedule(...args),
}));

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

// Mock prisma
const mockPrisma = {
  tournament: {
    findFirst: jest.fn(),
  },
  cycleMetadata: {
    findUnique: jest.fn().mockResolvedValue({ id: 1, totalCycles: 10 }),
  },
};
jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../../src/config/env', () => ({
  __esModule: true,
  getConfig: () => ({ appBaseUrl: 'http://localhost:3000' }),
}));

// Mock notification service
jest.mock('../../../src/services/notifications/notification-service', () => ({
  __esModule: true,
  buildSuccessMessage: jest.fn(),
  buildErrorMessage: jest.fn(),
  getActiveIntegrations: jest.fn().mockReturnValue([]),
  dispatchNotification: jest.fn(),
}));

// Mock repairAllRobots
const mockRepairAllRobots = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/services/economy/repairService', () => ({
  repairAllRobots: (...args: unknown[]) => mockRepairAllRobots(...args),
}));

// Mock executeTeamTournamentRound
const mockExecuteTeamTournamentRound = jest.fn();
jest.mock('../../../src/services/tournament/teamTournamentBattleOrchestrator', () => ({
  __esModule: true,
  executeTeamTournamentRound: (...args: unknown[]) => mockExecuteTeamTournamentRound(...args),
}));

// Mock advanceWinnersToNextRound
const mockAdvanceWinnersToNextRound = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/services/tournament/tournamentService', () => ({
  __esModule: true,
  getActiveTournaments: jest.fn().mockResolvedValue([]),
  getCurrentRoundMatches: jest.fn().mockResolvedValue([]),
  advanceWinnersToNextRound: (...args: unknown[]) => mockAdvanceWinnersToNextRound(...args),
  autoCreateNextTournament: jest.fn().mockResolvedValue(null),
}));

// Mock autoCreateNextTeamTournament
const mockAutoCreateNextTeamTournament = jest.fn();
jest.mock('../../../src/services/tournament/teamTournamentService', () => ({
  __esModule: true,
  autoCreateNextTeamTournament: (...args: unknown[]) => mockAutoCreateNextTeamTournament(...args),
}));

// Mock remaining service dependencies
jest.mock('../../../src/services/league/leagueBattleOrchestrator', () => ({
  executeScheduledBattles: jest.fn().mockResolvedValue({ totalBattles: 0 }),
}));
jest.mock('../../../src/services/koth/kothBattleOrchestrator', () => ({
  executeScheduledKothBattles: jest.fn().mockResolvedValue({ totalMatches: 0, successfulMatches: 0, failedMatches: 0 }),
}));
jest.mock('../../../src/services/league/leagueRebalancingService', () => ({
  rebalanceLeagues: jest.fn().mockResolvedValue({ totalPromoted: 0, totalDemoted: 0 }),
}));
jest.mock('../../../src/services/analytics/matchmakingService', () => ({
  runMatchmaking: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../../src/services/tournament/tournamentBattleOrchestrator', () => ({
  processTournamentBattle: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/tag-team/tagTeamBattleOrchestrator', () => ({
  executeScheduledTagTeamBattles: jest.fn().mockResolvedValue({ totalBattles: 0 }),
}));
jest.mock('../../../src/services/tag-team/tagTeamLeagueRebalancingService', () => ({
  rebalanceTagTeamLeagues: jest.fn().mockResolvedValue({ totalPromoted: 0, totalDemoted: 0 }),
}));
jest.mock('../../../src/services/tag-team/tagTeamMatchmakingService', () => ({
  runTagTeamMatchmaking: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../../src/services/koth/kothMatchmakingService', () => ({
  runKothMatchmaking: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../../src/services/team-battle/teamBattleOrchestrator', () => ({
  executeScheduledTeamBattles: jest.fn().mockResolvedValue({ totalBattles: 0 }),
}));
jest.mock('../../../src/services/team-battle/teamBattleAdapter', () => ({
  rebalanceTeamBattleLeagues: jest.fn().mockResolvedValue({ totalPromoted: 0, totalDemoted: 0 }),
}));
jest.mock('../../../src/services/team-battle/teamBattleMatchmakingService', () => ({
  runTeamBattleMatchmaking: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../../src/services/common/eventLogger', () => ({
  EventLogger: jest.fn().mockImplementation(() => ({
    logCycleStart: jest.fn(),
    logCycleComplete: jest.fn(),
    logEventBatch: jest.fn(),
  })),
  EventType: { PASSIVE_INCOME: 'passive_income', OPERATING_COSTS: 'operating_costs', CYCLE_END_BALANCE: 'cycle_end_balance' },
}));
jest.mock('../../../src/services/practice-arena/practiceArenaMetrics', () => ({
  practiceArenaMetrics: { flushAndReset: jest.fn() },
}));
jest.mock('../../../src/services/notifications/integration', () => ({
  __esModule: true,
  JobContext: {},
}));
jest.mock('../../../src/utils/scheduleUtils', () => ({
  getNextCronOccurrence: jest.fn().mockReturnValue(new Date()),
}));

// ── Import under test ────────────────────────────────────────────────────────

import {
  executeTeam2v2TournamentCycle,
  executeTeam3v3TournamentCycle,
} from '../../../src/services/cycle/cycleScheduler';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('executeTeam2v2TournamentCycle (R7.1, R7.3–R7.7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepairAllRobots.mockResolvedValue(undefined);
    mockPrisma.tournament.findFirst.mockResolvedValue(null);
    mockAutoCreateNextTeamTournament.mockResolvedValue(null);
    mockExecuteTeamTournamentRound.mockResolvedValue({ matchesExecuted: 0, matchesFailed: 0 });
    mockAdvanceWinnersToNextRound.mockResolvedValue(undefined);
  });

  describe('active tournament → executes round and advances', () => {
    const activeTournament = {
      id: 1,
      name: '2v2 Tournament #3',
      participantType: 'team_2v2',
      status: 'active',
      currentRound: 2,
      maxRounds: 3,
    };

    beforeEach(() => {
      mockPrisma.tournament.findFirst.mockResolvedValue(activeTournament);
      mockExecuteTeamTournamentRound.mockResolvedValue({ matchesExecuted: 4, matchesFailed: 0 });
    });

    it('should call repairAllRobots before executing', async () => {
      await executeTeam2v2TournamentCycle();
      expect(mockRepairAllRobots).toHaveBeenCalledWith(true);
    });

    it('should query for active 2v2 tournament', async () => {
      await executeTeam2v2TournamentCycle();
      expect(mockPrisma.tournament.findFirst).toHaveBeenCalledWith({
        where: { participantType: 'team_2v2', status: 'active' },
      });
    });

    it('should execute the current round with teamSize 2', async () => {
      await executeTeam2v2TournamentCycle();
      expect(mockExecuteTeamTournamentRound).toHaveBeenCalledWith(activeTournament.id, 2);
    });

    it('should advance winners to next round after execution', async () => {
      await executeTeam2v2TournamentCycle();
      expect(mockAdvanceWinnersToNextRound).toHaveBeenCalledWith(activeTournament.id);
    });

    it('should return JobContext with correct fields', async () => {
      const result = await executeTeam2v2TournamentCycle();
      expect(result).toEqual({
        jobName: 'team2v2Tournament',
        matchesCompleted: 4,
        tournamentName: '2v2 Tournament #3',
        tournamentRound: 2,
        tournamentMaxRounds: 3,
      });
    });

    it('should not attempt to create a new tournament', async () => {
      await executeTeam2v2TournamentCycle();
      expect(mockAutoCreateNextTeamTournament).not.toHaveBeenCalled();
    });
  });

  describe('no active tournament + sufficient teams → creates tournament', () => {
    const newTournament = {
      id: 5,
      name: '2v2 Tournament #4',
      participantType: 'team_2v2',
      status: 'active',
      currentRound: 1,
      maxRounds: 3,
    };

    beforeEach(() => {
      mockPrisma.tournament.findFirst.mockResolvedValue(null);
      mockAutoCreateNextTeamTournament.mockResolvedValue(newTournament);
    });

    it('should attempt to auto-create a tournament with teamSize 2', async () => {
      await executeTeam2v2TournamentCycle();
      expect(mockAutoCreateNextTeamTournament).toHaveBeenCalledWith(2);
    });

    it('should return JobContext with tournamentScheduled flag', async () => {
      const result = await executeTeam2v2TournamentCycle();
      expect(result).toEqual({
        jobName: 'team2v2Tournament',
        tournamentName: '2v2 Tournament #4',
        tournamentScheduled: true,
      });
    });

    it('should not execute any round matches', async () => {
      await executeTeam2v2TournamentCycle();
      expect(mockExecuteTeamTournamentRound).not.toHaveBeenCalled();
      expect(mockAdvanceWinnersToNextRound).not.toHaveBeenCalled();
    });
  });

  describe('no active tournament + insufficient teams → skips gracefully', () => {
    beforeEach(() => {
      mockPrisma.tournament.findFirst.mockResolvedValue(null);
      mockAutoCreateNextTeamTournament.mockResolvedValue(null);
    });

    it('should return minimal JobContext without error', async () => {
      const result = await executeTeam2v2TournamentCycle();
      expect(result).toEqual({ jobName: 'team2v2Tournament' });
    });

    it('should log the skip reason', async () => {
      await executeTeam2v2TournamentCycle();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Skipped')
      );
    });

    it('should not execute any round matches', async () => {
      await executeTeam2v2TournamentCycle();
      expect(mockExecuteTeamTournamentRound).not.toHaveBeenCalled();
      expect(mockAdvanceWinnersToNextRound).not.toHaveBeenCalled();
    });
  });

  describe('match execution failure → logs, skips, continues remaining', () => {
    const activeTournament = {
      id: 1,
      name: '2v2 Tournament #3',
      participantType: 'team_2v2',
      status: 'active',
      currentRound: 1,
      maxRounds: 3,
    };

    beforeEach(() => {
      mockPrisma.tournament.findFirst.mockResolvedValue(activeTournament);
      // Simulate partial failure: some matches executed, some failed
      mockExecuteTeamTournamentRound.mockResolvedValue({ matchesExecuted: 3, matchesFailed: 1 });
    });

    it('should not throw when executeTeamTournamentRound reports failures', async () => {
      await expect(executeTeam2v2TournamentCycle()).resolves.not.toThrow();
    });

    it('should still advance winners after partial failure', async () => {
      await executeTeam2v2TournamentCycle();
      expect(mockAdvanceWinnersToNextRound).toHaveBeenCalledWith(activeTournament.id);
    });

    it('should return JobContext with matchesCompleted reflecting executed count', async () => {
      const result = await executeTeam2v2TournamentCycle();
      expect(result.matchesCompleted).toBe(3);
    });
  });

  describe('final round completion → marks completed, awards prizes', () => {
    const finalRoundTournament = {
      id: 1,
      name: '2v2 Tournament #3',
      participantType: 'team_2v2',
      status: 'active',
      currentRound: 3,
      maxRounds: 3,
    };

    beforeEach(() => {
      mockPrisma.tournament.findFirst.mockResolvedValue(finalRoundTournament);
      mockExecuteTeamTournamentRound.mockResolvedValue({ matchesExecuted: 1, matchesFailed: 0 });
    });

    it('should execute the final round', async () => {
      await executeTeam2v2TournamentCycle();
      expect(mockExecuteTeamTournamentRound).toHaveBeenCalledWith(finalRoundTournament.id, 2);
    });

    it('should call advanceWinnersToNextRound which handles completion internally', async () => {
      await executeTeam2v2TournamentCycle();
      expect(mockAdvanceWinnersToNextRound).toHaveBeenCalledWith(finalRoundTournament.id);
    });

    it('should return JobContext indicating final round', async () => {
      const result = await executeTeam2v2TournamentCycle();
      expect(result.tournamentRound).toBe(3);
      expect(result.tournamentMaxRounds).toBe(3);
    });
  });
});

describe('executeTeam3v3TournamentCycle (R7.2, R7.3–R7.7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepairAllRobots.mockResolvedValue(undefined);
    mockPrisma.tournament.findFirst.mockResolvedValue(null);
    mockAutoCreateNextTeamTournament.mockResolvedValue(null);
    mockExecuteTeamTournamentRound.mockResolvedValue({ matchesExecuted: 0, matchesFailed: 0 });
    mockAdvanceWinnersToNextRound.mockResolvedValue(undefined);
  });

  describe('active tournament → executes round and advances', () => {
    const activeTournament = {
      id: 2,
      name: '3v3 Tournament #5',
      participantType: 'team_3v3',
      status: 'active',
      currentRound: 1,
      maxRounds: 4,
    };

    beforeEach(() => {
      mockPrisma.tournament.findFirst.mockResolvedValue(activeTournament);
      mockExecuteTeamTournamentRound.mockResolvedValue({ matchesExecuted: 8, matchesFailed: 0 });
    });

    it('should call repairAllRobots before executing', async () => {
      await executeTeam3v3TournamentCycle();
      expect(mockRepairAllRobots).toHaveBeenCalledWith(true);
    });

    it('should query for active 3v3 tournament', async () => {
      await executeTeam3v3TournamentCycle();
      expect(mockPrisma.tournament.findFirst).toHaveBeenCalledWith({
        where: { participantType: 'team_3v3', status: 'active' },
      });
    });

    it('should execute the current round with teamSize 3', async () => {
      await executeTeam3v3TournamentCycle();
      expect(mockExecuteTeamTournamentRound).toHaveBeenCalledWith(activeTournament.id, 3);
    });

    it('should advance winners to next round after execution', async () => {
      await executeTeam3v3TournamentCycle();
      expect(mockAdvanceWinnersToNextRound).toHaveBeenCalledWith(activeTournament.id);
    });

    it('should return JobContext with correct fields', async () => {
      const result = await executeTeam3v3TournamentCycle();
      expect(result).toEqual({
        jobName: 'team3v3Tournament',
        matchesCompleted: 8,
        tournamentName: '3v3 Tournament #5',
        tournamentRound: 1,
        tournamentMaxRounds: 4,
      });
    });
  });

  describe('no active tournament + sufficient teams → creates tournament', () => {
    const newTournament = {
      id: 10,
      name: '3v3 Tournament #6',
      participantType: 'team_3v3',
      status: 'active',
      currentRound: 1,
      maxRounds: 3,
    };

    beforeEach(() => {
      mockPrisma.tournament.findFirst.mockResolvedValue(null);
      mockAutoCreateNextTeamTournament.mockResolvedValue(newTournament);
    });

    it('should attempt to auto-create a tournament with teamSize 3', async () => {
      await executeTeam3v3TournamentCycle();
      expect(mockAutoCreateNextTeamTournament).toHaveBeenCalledWith(3);
    });

    it('should return JobContext with tournamentScheduled flag', async () => {
      const result = await executeTeam3v3TournamentCycle();
      expect(result).toEqual({
        jobName: 'team3v3Tournament',
        tournamentName: '3v3 Tournament #6',
        tournamentScheduled: true,
      });
    });
  });

  describe('no active tournament + insufficient teams → skips gracefully', () => {
    beforeEach(() => {
      mockPrisma.tournament.findFirst.mockResolvedValue(null);
      mockAutoCreateNextTeamTournament.mockResolvedValue(null);
    });

    it('should return minimal JobContext without error', async () => {
      const result = await executeTeam3v3TournamentCycle();
      expect(result).toEqual({ jobName: 'team3v3Tournament' });
    });

    it('should log the skip reason', async () => {
      await executeTeam3v3TournamentCycle();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Skipped')
      );
    });
  });

  describe('match execution failure → handler does not throw', () => {
    const activeTournament = {
      id: 2,
      name: '3v3 Tournament #5',
      participantType: 'team_3v3',
      status: 'active',
      currentRound: 2,
      maxRounds: 4,
    };

    beforeEach(() => {
      mockPrisma.tournament.findFirst.mockResolvedValue(activeTournament);
      mockExecuteTeamTournamentRound.mockResolvedValue({ matchesExecuted: 2, matchesFailed: 2 });
    });

    it('should not throw when matches fail', async () => {
      await expect(executeTeam3v3TournamentCycle()).resolves.not.toThrow();
    });

    it('should still call advanceWinnersToNextRound', async () => {
      await executeTeam3v3TournamentCycle();
      expect(mockAdvanceWinnersToNextRound).toHaveBeenCalledWith(activeTournament.id);
    });

    it('should report executed count in JobContext', async () => {
      const result = await executeTeam3v3TournamentCycle();
      expect(result.matchesCompleted).toBe(2);
    });
  });

  describe('final round completion → marks completed, awards prizes', () => {
    const finalRoundTournament = {
      id: 2,
      name: '3v3 Tournament #5',
      participantType: 'team_3v3',
      status: 'active',
      currentRound: 4,
      maxRounds: 4,
    };

    beforeEach(() => {
      mockPrisma.tournament.findFirst.mockResolvedValue(finalRoundTournament);
      mockExecuteTeamTournamentRound.mockResolvedValue({ matchesExecuted: 1, matchesFailed: 0 });
    });

    it('should execute the final round with teamSize 3', async () => {
      await executeTeam3v3TournamentCycle();
      expect(mockExecuteTeamTournamentRound).toHaveBeenCalledWith(finalRoundTournament.id, 3);
    });

    it('should call advanceWinnersToNextRound which handles completion internally', async () => {
      await executeTeam3v3TournamentCycle();
      expect(mockAdvanceWinnersToNextRound).toHaveBeenCalledWith(finalRoundTournament.id);
    });

    it('should return JobContext indicating final round', async () => {
      const result = await executeTeam3v3TournamentCycle();
      expect(result.tournamentRound).toBe(4);
      expect(result.tournamentMaxRounds).toBe(4);
    });
  });
});
