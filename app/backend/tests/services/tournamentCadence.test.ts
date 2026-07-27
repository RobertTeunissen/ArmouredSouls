/**
 * Tournament Creation Cadence — Spec #46 Requirement 1
 *
 * Asserts that for every Participant_Type, the run which processes the final
 * round of a tournament also attempts Tournament_Auto_Creation, so no
 * Participant_Type loses a cycle waiting for the next bracket.
 *
 * Before this spec, `executeTeam2v2TournamentCycle` and
 * `executeTeam3v3TournamentCycle` returned from inside their
 * `if (activeTournament)` branch and never reached auto-creation on a run
 * that processed a round. The 1v1 handler always reached it.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**
 */

import {
  executeTournamentCycle,
  executeTeam2v2TournamentCycle,
  executeTeam3v3TournamentCycle,
  resetScheduler,
} from '../../src/services/cycle/cycleScheduler';

// --- Mocks ---

const mockSchedule = jest.fn().mockImplementation(() => ({
  stop: jest.fn(),
  start: jest.fn(),
  now: jest.fn(),
  on: jest.fn(),
  emit: jest.fn(),
}));
jest.mock('node-cron', () => ({
  __esModule: true,
  default: { schedule: (...args: unknown[]) => mockSchedule(...args) },
  schedule: (...args: unknown[]) => mockSchedule(...args),
}));

const logEntries: string[] = [];
jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: (msg: string) => logEntries.push(msg),
    error: (msg: string) => logEntries.push(msg),
    warn: (msg: string) => logEntries.push(msg),
    debug: (msg: string) => logEntries.push(msg),
  },
}));

jest.mock('../../src/services/economy/repairService', () => ({
  repairAllRobots: jest.fn().mockResolvedValue(undefined),
}));

const mockAutoCreateNextTournament = jest.fn().mockResolvedValue(null);
const mockAdvanceWinners = jest.fn().mockResolvedValue(undefined);
jest.mock('../../src/services/tournament/tournamentService', () => ({
  getActiveTournaments: jest.fn().mockResolvedValue([]),
  getCurrentRoundMatches: jest.fn().mockResolvedValue([]),
  advanceWinnersToNextRound: (...a: unknown[]) => mockAdvanceWinners(...a),
  autoCreateNextTournament: (...a: unknown[]) => mockAutoCreateNextTournament(...a),
}));
jest.mock('../../src/services/tournament/tournamentBattleOrchestrator', () => ({
  processTournamentBattle: jest.fn().mockResolvedValue(undefined),
}));

const mockAutoCreateNextTeamTournament = jest.fn().mockResolvedValue(null);
jest.mock('../../src/services/tournament/teamTournamentService', () => ({
  autoCreateNextTeamTournament: (...a: unknown[]) => mockAutoCreateNextTeamTournament(...a),
}));

const mockExecuteTeamTournamentRound = jest.fn().mockResolvedValue({ matchesExecuted: 0, matchesFailed: 0 });
jest.mock('../../src/services/tournament/teamTournamentBattleOrchestrator', () => ({
  executeTeamTournamentRound: (...a: unknown[]) => mockExecuteTeamTournamentRound(...a),
}));

const mockTournamentFindFirst = jest.fn().mockResolvedValue(null);
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    cycleMetadata: {
      findUnique: jest.fn().mockResolvedValue({ id: 1, totalCycles: 5 }),
      create: jest.fn().mockResolvedValue({ id: 1, totalCycles: 0 }),
      update: jest.fn().mockResolvedValue({ id: 1, totalCycles: 6 }),
    },
    tournament: {
      findFirst: (...a: unknown[]) => mockTournamentFindFirst(...a),
      findUnique: jest.fn().mockResolvedValue(null),
    },
  },
}));

// Unused by these jobs but imported by the scheduler module graph
jest.mock('../../src/services/league/leagueBattleOrchestrator', () => ({
  executeScheduledBattles: jest.fn().mockResolvedValue({ totalBattles: 0 }),
}));
jest.mock('../../src/services/koth/kothBattleOrchestrator', () => ({
  executeScheduledKothBattles: jest.fn().mockResolvedValue({ totalMatches: 0, successfulMatches: 0, failedMatches: 0 }),
}));
jest.mock('../../src/services/league/leagueRebalancingService', () => ({
  rebalanceLeagues: jest.fn().mockResolvedValue({ totalPromoted: 0, totalDemoted: 0 }),
  rebalanceKothLeagues: jest.fn().mockResolvedValue({ totalPromoted: 0, totalDemoted: 0 }),
  createStandingsAdapter: jest.fn().mockReturnValue({}),
}));
jest.mock('../../src/services/analytics/matchmakingService', () => ({
  runMatchmaking: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../src/services/tag-team/tagTeamBattleOrchestrator', () => ({
  executeScheduledTagTeamBattles: jest.fn().mockResolvedValue({ totalBattles: 0 }),
}));
jest.mock('../../src/services/tag-team/tagTeamLeagueRebalancingService', () => ({
  rebalanceTagTeamLeagues: jest.fn().mockResolvedValue({ totalPromoted: 0, totalDemoted: 0 }),
}));
jest.mock('../../src/services/tag-team/tagTeamMatchmakingService', () => ({
  runTagTeamMatchmaking: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../src/services/team-battle/teamBattleOrchestrator', () => ({
  executeScheduledTeamBattles: jest.fn().mockResolvedValue({ totalBattles: 0 }),
}));
jest.mock('../../src/services/team-battle/teamBattleMatchmakingService', () => ({
  runTeamBattleMatchmaking: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../src/services/grand-melee/grandMeleeBattleOrchestrator', () => ({
  executeScheduledGrandMeleeBattles: jest.fn().mockResolvedValue({ totalMatches: 0, successfulMatches: 0, failedMatches: 0 }),
}));
jest.mock('../../src/services/grand-melee/grandMeleeMatchmakingService', () => ({
  runGrandMeleeMatchmaking: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../src/services/common/eventLogger', () => ({
  EventLogger: jest.fn().mockImplementation(() => ({
    logPassiveIncome: jest.fn().mockResolvedValue(undefined),
    logOperatingCosts: jest.fn().mockResolvedValue(undefined),
    logCycleEndBalance: jest.fn().mockResolvedValue(undefined),
  })),
}));

/** A tournament sitting on its final round — the case that previously skipped auto-creation. */
const finalRoundTournament = (participantType: string) => ({
  id: 42,
  name: `${participantType} Tournament #7`,
  participantType,
  status: 'active',
  currentRound: 3,
  maxRounds: 3,
  totalParticipants: 8,
});

beforeEach(() => {
  resetScheduler();
  logEntries.length = 0;
  mockSchedule.mockClear();
  mockAutoCreateNextTournament.mockClear().mockResolvedValue(null);
  mockAutoCreateNextTeamTournament.mockClear().mockResolvedValue(null);
  mockExecuteTeamTournamentRound.mockClear().mockResolvedValue({ matchesExecuted: 4, matchesFailed: 0 });
  mockTournamentFindFirst.mockClear().mockResolvedValue(null);
  mockAdvanceWinners.mockClear();
});

describe('Tournament creation cadence (Spec #46 R1)', () => {
  describe.each([
    ['team_2v2', executeTeam2v2TournamentCycle, 2, 'team2v2Tournament'],
    ['team_3v3', executeTeam3v3TournamentCycle, 3, 'team3v3Tournament'],
  ] as const)('%s', (participantType, handler, teamSize, jobName) => {
    it('attempts auto-creation on the run that processes the final round', async () => {
      mockTournamentFindFirst.mockResolvedValue(finalRoundTournament(participantType));

      await handler();

      expect(mockExecuteTeamTournamentRound).toHaveBeenCalledWith(42, teamSize);
      expect(mockAutoCreateNextTeamTournament).toHaveBeenCalledWith(teamSize);
    });

    it('creates the next tournament in the same run that completed the previous one', async () => {
      mockTournamentFindFirst.mockResolvedValue(finalRoundTournament(participantType));
      mockAutoCreateNextTeamTournament.mockResolvedValue({
        id: 43,
        name: `${participantType} Tournament #8`,
      });

      await handler();

      expect(mockAutoCreateNextTeamTournament).toHaveBeenCalledTimes(1);
      expect(logEntries.some((m) => m.includes('Tournament #8'))).toBe(true);
    });

    it('attempts auto-creation when no tournament is active', async () => {
      mockTournamentFindFirst.mockResolvedValue(null);

      await handler();

      expect(mockExecuteTeamTournamentRound).not.toHaveBeenCalled();
      expect(mockAutoCreateNextTeamTournament).toHaveBeenCalledWith(teamSize);
    });

    it('reports the processed tournament in JobContext, not the newly created one', async () => {
      mockTournamentFindFirst.mockResolvedValue(finalRoundTournament(participantType));
      mockAutoCreateNextTeamTournament.mockResolvedValue({ id: 43, name: 'Newly Created' });

      const context = await handler();

      expect(context).toEqual({
        jobName,
        matchesCompleted: 4,
        tournamentName: `${participantType} Tournament #7`,
        tournamentRound: 3,
        tournamentMaxRounds: 3,
      });
    });

    it('reports the created tournament in JobContext when no round was processed', async () => {
      mockTournamentFindFirst.mockResolvedValue(null);
      mockAutoCreateNextTeamTournament.mockResolvedValue({ id: 43, name: 'Fresh Bracket' });

      const context = await handler();

      expect(context).toEqual({
        jobName,
        tournamentName: 'Fresh Bracket',
        tournamentScheduled: true,
      });
    });

    it('creates nothing and returns a bare context when auto-creation declines', async () => {
      mockTournamentFindFirst.mockResolvedValue(null);
      mockAutoCreateNextTeamTournament.mockResolvedValue(null);

      const context = await handler();

      expect(context).toEqual({ jobName });
      expect(logEntries.some((m) => m.includes('insufficient eligible teams'))).toBe(true);
    });
  });

  it('1v1 attempts auto-creation on every run, as it already did', async () => {
    await executeTournamentCycle();
    expect(mockAutoCreateNextTournament).toHaveBeenCalledTimes(1);
  });

  it('elapsed cycles to the next tournament are equal across all three participant types', async () => {
    // For each type, the run that completes a final round must also attempt
    // creation, so the gap between one tournament ending and the next being
    // created is zero cycles for every type (R1.5).
    const attempted: Record<string, boolean> = {};

    mockTournamentFindFirst.mockResolvedValue(finalRoundTournament('team_2v2'));
    await executeTeam2v2TournamentCycle();
    attempted.team_2v2 = mockAutoCreateNextTeamTournament.mock.calls.length > 0;

    mockAutoCreateNextTeamTournament.mockClear();
    mockTournamentFindFirst.mockResolvedValue(finalRoundTournament('team_3v3'));
    await executeTeam3v3TournamentCycle();
    attempted.team_3v3 = mockAutoCreateNextTeamTournament.mock.calls.length > 0;

    await executeTournamentCycle();
    attempted.robot = mockAutoCreateNextTournament.mock.calls.length > 0;

    expect(attempted).toEqual({ team_2v2: true, team_3v3: true, robot: true });
  });
});
