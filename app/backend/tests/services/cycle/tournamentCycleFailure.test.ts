/**
 * T18 — the 1v1 tournament cycle job never fails on one bad match (rule 7).
 *
 * The job used to re-throw the first match error ("Re-throw to fail the job"),
 * which aborted the round before advancement and left every later match
 * queued. It now delegates the round to `executeSoloTournamentRound`, whose
 * failures are already handled by the shared policy, and always advances.
 */
import { executeTournamentCycle, resetScheduler } from '../../../src/services/cycle/cycleScheduler';

jest.mock('node-cron', () => ({
  __esModule: true,
  default: { schedule: jest.fn(() => ({ stop: jest.fn(), start: jest.fn() })) },
  schedule: jest.fn(() => ({ stop: jest.fn(), start: jest.fn() })),
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/services/economy/repairService', () => ({
  repairAllRobots: jest.fn().mockResolvedValue(undefined),
  repairRobotsForEvent: jest.fn().mockResolvedValue(undefined),
}));

const mockAdvanceWinners = jest.fn().mockResolvedValue(undefined);
const mockGetCurrentRoundMatches = jest.fn();
jest.mock('../../../src/services/tournament/tournamentService', () => ({
  getActiveTournaments: jest.fn().mockResolvedValue([
    { id: 9, name: 'Cup #9', currentRound: 1, maxRounds: 2, status: 'active' },
  ]),
  getCurrentRoundMatches: (...a: unknown[]) => mockGetCurrentRoundMatches(...a),
  advanceWinnersToNextRound: (...a: unknown[]) => mockAdvanceWinners(...a),
  autoCreateNextTournament: jest.fn().mockResolvedValue(null),
}));

const mockExecuteSoloRound = jest.fn();
const mockProcessTournamentBattle = jest.fn();
jest.mock('../../../src/services/tournament/tournamentBattleOrchestrator', () => ({
  processTournamentBattle: (...a: unknown[]) => mockProcessTournamentBattle(...a),
  executeSoloTournamentRound: (...a: unknown[]) => mockExecuteSoloRound(...a),
}));

jest.mock('../../../src/services/tournament/teamTournamentService', () => ({
  autoCreateNextTeamTournament: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../../src/services/tournament/teamTournamentBattleOrchestrator', () => ({
  executeTeamTournamentRound: jest.fn(),
}));

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    tournament: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue({ id: 9, status: 'active' }) },
  },
}));

// Imported by the scheduler module graph, unused by this job.
jest.mock('../../../src/services/league/leagueBattleOrchestrator', () => ({ executeScheduledBattles: jest.fn() }));
jest.mock('../../../src/services/koth/kothBattleOrchestrator', () => ({ executeScheduledKothBattles: jest.fn() }));
jest.mock('../../../src/services/league/leagueRebalancingService', () => ({
  rebalanceLeagues: jest.fn(),
  rebalanceKothLeagues: jest.fn(),
  createStandingsAdapter: jest.fn(),
}));
jest.mock('../../../src/services/analytics/matchmakingService', () => ({ runMatchmaking: jest.fn() }));
jest.mock('../../../src/services/tag-team/tagTeamBattleOrchestrator', () => ({ executeScheduledTagTeamBattles: jest.fn() }));
jest.mock('../../../src/services/tag-team/tagTeamLeagueRebalancingService', () => ({ rebalanceTagTeamLeagues: jest.fn() }));
jest.mock('../../../src/services/tag-team/tagTeamMatchmakingService', () => ({ runTagTeamMatchmaking: jest.fn() }));
jest.mock('../../../src/services/team-battle/teamBattleOrchestrator', () => ({ executeScheduledTeamBattles: jest.fn() }));
jest.mock('../../../src/services/team-battle/teamBattleMatchmakingService', () => ({ runTeamBattleMatchmaking: jest.fn() }));
jest.mock('../../../src/services/grand-melee/grandMeleeBattleOrchestrator', () => ({ executeScheduledGrandMeleeBattles: jest.fn() }));
jest.mock('../../../src/services/grand-melee/grandMeleeMatchmakingService', () => ({ runGrandMeleeMatchmaking: jest.fn() }));

describe('executeTournamentCycle with a failing match (T18)', () => {
  beforeEach(() => {
    resetScheduler();
    jest.clearAllMocks();
    mockGetCurrentRoundMatches.mockResolvedValue([
      { id: 1, tournamentId: 9, round: 1, matchNumber: 1, participant1Id: 11, participant2Id: 22, isByeMatch: false, battleId: null, status: 'pending' },
      { id: 2, tournamentId: 9, round: 1, matchNumber: 2, participant1Id: 33, participant2Id: 44, isByeMatch: false, battleId: null, status: 'pending' },
    ]);
    // A per-match engine failure in the old loop: the first battle throws.
    mockProcessTournamentBattle.mockRejectedValueOnce(new Error('engine exploded')).mockResolvedValue({ winnerId: 33 });
    mockExecuteSoloRound.mockResolvedValue({
      matchesExecuted: 1,
      byesResolved: 0,
      matchesResumed: 0,
      matchesCancelled: 1,
      winners: [33],
      errors: ['Match 1: Error: engine exploded'],
    });
  });

  it('resolves instead of failing the job', async () => {
    await expect(executeTournamentCycle()).resolves.toEqual(expect.objectContaining({ jobName: 'tournament' }));
  });

  it('runs the round through the shared executor and still advances the bracket', async () => {
    await executeTournamentCycle();
    expect(mockExecuteSoloRound).toHaveBeenCalledWith(9);
    expect(mockAdvanceWinners).toHaveBeenCalledWith(9);
  });
});
