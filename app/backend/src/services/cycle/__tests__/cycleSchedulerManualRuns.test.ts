/**
 * Manual runs from Cycle Controls: every one of the ten "Run" buttons reaches
 * its real handler, with the scheduler disabled (local / CI) as well as
 * enabled, and every run is recorded queued → running → success / failed /
 * skipped. Orchestrators and the history store are mocked; the DB-backed
 * end-to-end run of each job is the Heavy suite `schedulerManualRuns.test.ts`.
 */
const mockRecordQueued = jest.fn();
const mockMarkRunning = jest.fn();
const mockMarkFinished = jest.fn();
jest.mock('../schedulerRunStore', () => ({
  recordQueued: (...args: unknown[]) => mockRecordQueued(...args),
  markRunning: (...args: unknown[]) => mockMarkRunning(...args),
  markFinished: (...args: unknown[]) => mockMarkFinished(...args),
}));

const mockGetCurrentSeason = jest.fn();
jest.mock('../../season/seasonService', () => ({
  getCurrentSeason: () => mockGetCurrentSeason(),
  advancePreparationCycle: jest.fn(),
  advanceCompetitiveCycle: jest.fn(async () => ({ seasonNumber: 2, competitiveCyclesCompleted: 12, boundaryReached: false })),
}));

const calls = {
  repair: jest.fn(async () => ({ robotsRepaired: 0 })),
  leagueBattles: jest.fn(async () => ({ totalBattles: 7 })),
  rebalanceLeagues: jest.fn(async () => ({ totalPromoted: 0, totalDemoted: 0 })),
  matchmaking: jest.fn(async () => 0),
  activeTournaments: jest.fn(async () => [] as unknown[]),
  autoCreateTournament: jest.fn(async () => null),
  tagTeamBattles: jest.fn(async () => ({ totalBattles: 4, forfeits: 0 })),
  rebalanceTagTeam: jest.fn(async () => ({ totalPromoted: 0, totalDemoted: 0 })),
  tagTeamMatchmaking: jest.fn(async () => 0),
  kothBattles: jest.fn(async () => ({ successfulMatches: 3, failedMatches: 0, belowMinimumMatches: 0, forfeitedRobots: 0 })),
  rebalanceKoth: jest.fn(async () => ({ totalPromoted: 0, totalDemoted: 0 })),
  kothMatchmaking: jest.fn(async () => 0),
  teamBattles: jest.fn(async (size: number) => ({ matchesCompleted: size * 10, matchesCancelled: 0 })),
  rebalanceTeam: jest.fn(async () => ({ totalPromoted: 0, totalDemoted: 0 })),
  teamMatchmaking: jest.fn(async () => 0),
  autoCreateTeamTournament: jest.fn(async () => null),
  grandMeleeBattles: jest.fn(async () => ({ successfulMatches: 2, failedMatches: 0, belowMinimumMatches: 0, forfeitedRobots: 0 })),
  rebalanceGrandMelee: jest.fn(async () => ({ totalPromoted: 0, totalDemoted: 0 })),
  grandMeleeMatchmaking: jest.fn(async () => 0),
  settleCycle: jest.fn(async () => ({ totalPassiveIncome: 0, totalOperatingCosts: 0, usersProcessed: 5 })),
  dispatch: jest.fn(async () => []),
};

jest.mock('../../economy/repairService', () => ({ repairRobotsForEvent: () => calls.repair() }));
jest.mock('../../league/leagueBattleOrchestrator', () => ({ executeScheduledBattles: () => calls.leagueBattles() }));
jest.mock('../../league/leagueRebalancingService', () => ({
  rebalanceLeagues: () => calls.rebalanceLeagues(),
  rebalanceKothLeagues: () => calls.rebalanceKoth(),
  rebalanceGrandMeleeLeagues: () => calls.rebalanceGrandMelee(),
}));
jest.mock('../../analytics/matchmakingService', () => ({ runMatchmaking: () => calls.matchmaking() }));
jest.mock('../../tournament/tournamentService', () => ({
  getActiveTournaments: () => calls.activeTournaments(),
  getCurrentRoundMatches: jest.fn(async () => []),
  advanceWinnersToNextRound: jest.fn(async () => undefined),
  autoCreateNextTournament: () => calls.autoCreateTournament(),
}));
jest.mock('../../tournament/tournamentBattleOrchestrator', () => ({ executeSoloTournamentRound: jest.fn() }));
jest.mock('../../tag-team/tagTeamBattleOrchestrator', () => ({ executeScheduledTagTeamBattles: () => calls.tagTeamBattles() }));
jest.mock('../../tag-team/tagTeamLeagueRebalancingService', () => ({ rebalanceTagTeamLeagues: () => calls.rebalanceTagTeam() }));
jest.mock('../../tag-team/tagTeamMatchmakingService', () => ({ runTagTeamMatchmaking: () => calls.tagTeamMatchmaking() }));
jest.mock('../../koth/kothBattleOrchestrator', () => ({ executeScheduledKothBattles: () => calls.kothBattles() }));
jest.mock('../../koth/kothMatchmakingService', () => ({ runKothMatchmaking: () => calls.kothMatchmaking() }));
jest.mock('../../team-battle/teamBattleOrchestrator', () => ({ executeScheduledTeamBattles: (size: number) => calls.teamBattles(size) }));
jest.mock('../../team-battle/teamBattleAdapter', () => ({ rebalanceTeamBattleLeagues: () => calls.rebalanceTeam() }));
jest.mock('../../team-battle/teamBattleMatchmakingService', () => ({ runTeamBattleMatchmaking: () => calls.teamMatchmaking() }));
jest.mock('../../tournament/teamTournamentBattleOrchestrator', () => ({ executeTeamTournamentRound: jest.fn() }));
jest.mock('../../tournament/teamTournamentService', () => ({ autoCreateNextTeamTournament: () => calls.autoCreateTeamTournament() }));
jest.mock('../../grand-melee/grandMeleeBattleOrchestrator', () => ({ executeScheduledGrandMeleeBattles: () => calls.grandMeleeBattles() }));
jest.mock('../../grand-melee/grandMeleeMatchmakingService', () => ({ runGrandMeleeMatchmaking: () => calls.grandMeleeMatchmaking() }));
jest.mock('../../notifications/notification-service', () => ({
  buildSuccessMessage: jest.fn(() => null),
  buildErrorMessage: jest.fn(() => 'failed'),
  getActiveIntegrations: jest.fn(() => []),
  dispatchNotification: () => calls.dispatch(),
}));

// Settlement's collaborators (as in cycleSchedulerKpiSnapshot.test.ts).
jest.mock('../../admin/adminKpiSnapshotService', () => ({ recordKpiSnapshotNonFatal: jest.fn(async () => undefined) }));
jest.mock('../../season/seasonRolloverService', () => ({ executeSeasonRollover: jest.fn(async () => ({})) }));
jest.mock('../../automaton', () => ({ runTurnStepNonFatal: jest.fn(async () => ({ ok: true, summary: {} })) }));
jest.mock('../canonicalCycleIdentity', () => ({
  beginSerializedCycleCutover: jest.fn(async () => 81),
  getSerializedCycleCutoverUserIdWatermark: jest.fn(async () => 100),
  completeSerializedCycleCutover: jest.fn(async () => undefined),
  abortSerializedCycleCutover: jest.fn(async () => undefined),
  resolveCanonicalCycleIdentity: jest.fn(),
}));
jest.mock('../cycle-closing-evidence', () => ({ logCycleEndBalances: jest.fn(async () => 5) }));
jest.mock('../cycleSnapshotService', () => ({ cycleSnapshotService: { createSnapshot: jest.fn(async () => undefined) } }));
jest.mock('../../financial/settlementService', () => ({ settlementService: { settleCycle: () => calls.settleCycle() } }));
jest.mock('../../common/eventLogger', () => ({
  EventLogger: jest.fn().mockImplementation(() => ({
    logCycleStart: jest.fn(async () => undefined),
    logCycleComplete: jest.fn(async () => undefined),
  })),
}));
jest.mock('../../achievement', () => ({
  achievementService: { checkAndAward: jest.fn(async () => []), refreshRarityCache: jest.fn(async () => undefined) },
}));
jest.mock('../../../utils/userGeneration', () => ({ generateBattleReadyUsers: jest.fn(async () => ({ usersCreated: 0, robotsCreated: 0 })) }));
jest.mock('../../leaderboard/leaderboardService', () => ({ leaderboardService: { refreshAll: jest.fn(async () => undefined) } }));
jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    standing: { updateMany: jest.fn(async () => ({ count: 0 })) },
    user: { findMany: jest.fn(async () => []) },
    tournament: { findUnique: jest.fn(async () => null), findFirst: jest.fn(async () => null) },
  },
}));
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import {
  SCHEDULER_JOB_NAMES,
  getActiveJobNames,
  getSchedulerState,
  initScheduler,
  resetScheduler,
  runJob,
  startManualRun,
  toRunSummary,
  type SchedulerJobName,
} from '../cycleScheduler';
import { SchedulerError } from '../../../errors/schedulerErrors';

const CONFIG = {
  leagueSchedule: '0 8 * * *',
  tournamentSchedule: '0 10 * * *',
  tagTeamSchedule: '0 11 * * *',
  settlementSchedule: '0 0 * * *',
  kothSchedule: '0 13 * * *',
  team2v2LeagueSchedule: '0 9 * * *',
  team3v3LeagueSchedule: '0 14 * * *',
  team2v2TournamentSchedule: '0 15 * * *',
  team3v3TournamentSchedule: '0 18 * * *',
  grandMeleeSchedule: '0 17 * * *',
};

/** The work each job must reach, and the summary it records. */
const JOB_CASES: Record<SchedulerJobName, { reaches: () => jest.Mock; summary: Record<string, unknown> | null }> = {
  league: { reaches: () => calls.leagueBattles, summary: { matchesCompleted: 7 } },
  team2v2League: { reaches: () => calls.teamBattles, summary: { matchesCompleted: 20 } },
  tournament: { reaches: () => calls.activeTournaments, summary: null },
  tagTeam: { reaches: () => calls.tagTeamBattles, summary: { matchesCompleted: 4 } },
  koth: { reaches: () => calls.kothBattles, summary: { matchesCompleted: 3 } },
  team3v3League: { reaches: () => calls.teamBattles, summary: { matchesCompleted: 30 } },
  team2v2Tournament: { reaches: () => calls.autoCreateTeamTournament, summary: null },
  grandMelee: { reaches: () => calls.grandMeleeBattles, summary: { matchesCompleted: 2 } },
  team3v3Tournament: { reaches: () => calls.autoCreateTeamTournament, summary: null },
  settlement: { reaches: () => calls.settleCycle, summary: { cycleNumber: 81 } },
};

/** Let the background run finish (it awaits mocked promises only). */
async function settle(): Promise<void> {
  for (let i = 0; i < 50 && getActiveJobNames().length > 0; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  await new Promise((resolve) => setImmediate(resolve));
}

let nextRunId = 1;

beforeEach(() => {
  jest.clearAllMocks();
  resetScheduler();
  nextRunId = 1;
  mockRecordQueued.mockImplementation(async () => nextRunId++);
  mockMarkRunning.mockResolvedValue(undefined);
  mockMarkFinished.mockResolvedValue(undefined);
  mockGetCurrentSeason.mockResolvedValue({ seasonNumber: 2, phase: 'competitive', preparationDay: 0, remainingPreparationCycles: 0 });
});

afterEach(() => resetScheduler());

describe('initScheduler registers every job for manual runs', () => {
  it('registers all ten jobs while automated scheduling is disabled', () => {
    initScheduler({ enabled: false, ...CONFIG });

    const state = getSchedulerState();
    expect(state.active).toBe(false);
    expect(state.jobs.map((job) => job.name).sort()).toEqual([...SCHEDULER_JOB_NAMES].sort());
    expect(state.jobs.every((job) => job.nextRunAt === null)).toBe(true);
  });
});

describe('startManualRun — every Run button', () => {
  beforeEach(() => initScheduler({ enabled: false, ...CONFIG }));

  for (const jobName of SCHEDULER_JOB_NAMES) {
    it(`starts ${jobName} in the background, reaches its handler and records success`, async () => {
      const result = await startManualRun(jobName, 7);

      expect(result).toMatchObject({ runId: 1, jobName });
      expect(mockRecordQueued).toHaveBeenCalledWith(expect.objectContaining({ jobName, trigger: 'manual', triggeredByUserId: 7 }));

      await settle();

      expect(JOB_CASES[jobName].reaches()).toHaveBeenCalled();
      expect(mockMarkRunning).toHaveBeenCalledWith(1, expect.any(Date));
      expect(mockMarkFinished).toHaveBeenCalledWith(1, expect.objectContaining({
        status: 'success',
        summary: JOB_CASES[jobName].summary,
      }));
      // The manual run records exactly one history row (no second one inside runJob).
      expect(mockRecordQueued).toHaveBeenCalledTimes(1);
    });
  }

  it('returns before the job finishes (the job waits behind the lock)', async () => {
    let release: () => void = () => undefined;
    calls.leagueBattles.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ totalBattles: 1 }); }));

    await startManualRun('league', 7);
    await new Promise((resolve) => setImmediate(resolve));

    expect(getActiveJobNames()).toEqual(['league']);
    expect(mockMarkFinished).not.toHaveBeenCalled();
    release();
    await settle();
    expect(mockMarkFinished).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'success' }));
  });

  it('refuses a second run of a job that is already queued or running (409)', async () => {
    let release: () => void = () => undefined;
    calls.kothBattles.mockImplementationOnce(() => new Promise((resolve) => {
      release = () => resolve({ successfulMatches: 1, failedMatches: 0, belowMinimumMatches: 0, forfeitedRobots: 0 });
    }));

    await startManualRun('koth', 7);
    await expect(startManualRun('koth', 7)).rejects.toMatchObject({ statusCode: 409, code: 'SCHEDULER_JOB_ALREADY_ACTIVE' });

    // Another job queues behind it instead.
    await expect(startManualRun('grandMelee', 7)).resolves.toMatchObject({ jobName: 'grandMelee' });
    expect(getActiveJobNames()).toEqual(['koth', 'grandMelee']);

    for (let i = 0; i < 50 && calls.kothBattles.mock.calls.length === 0; i += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    release();
    await settle();
    expect(mockMarkFinished).toHaveBeenCalledTimes(2);
    expect(calls.grandMeleeBattles).toHaveBeenCalled();
  });

  it('refuses two simultaneous starts of the same job', async () => {
    const [first, second] = await Promise.allSettled([startManualRun('tagTeam', 7), startManualRun('tagTeam', 7)]);
    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');
    await settle();
  });

  it('rejects an unknown job with 400', async () => {
    await expect(startManualRun('notAJob' as SchedulerJobName, 7)).rejects.toBeInstanceOf(SchedulerError);
    await expect(startManualRun('notAJob' as SchedulerJobName, 7)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('still runs the job when the history write fails', async () => {
    mockRecordQueued.mockResolvedValueOnce(null);

    const result = await startManualRun('grandMelee', 7);
    await settle();

    expect(result.runId).toBeNull();
    expect(calls.grandMeleeBattles).toHaveBeenCalled();
  });
});

describe('runJob records the outcome', () => {
  beforeEach(() => initScheduler({ enabled: false, ...CONFIG }));

  it('records a cron run with its trigger', async () => {
    await runJob('league', async () => ({ jobName: 'league', matchesCompleted: 3 }), { trigger: 'cron' });

    expect(mockRecordQueued).toHaveBeenCalledWith(expect.objectContaining({ jobName: 'league', trigger: 'cron' }));
    expect(mockMarkFinished).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'success', summary: { matchesCompleted: 3 } }));
  });

  it('records a failure with its error message', async () => {
    await runJob('koth', async () => { throw new Error('arena collapsed'); }, { trigger: 'cron' });

    expect(mockMarkFinished).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'failed', error: 'arena collapsed' }));
    expect(calls.dispatch).toHaveBeenCalled();
  });

  it('records a battle job skipped during preparation', async () => {
    mockGetCurrentSeason.mockResolvedValue({ seasonNumber: 3, phase: 'preparation', preparationDay: 1, remainingPreparationCycles: 1 });
    const handler = jest.fn();

    await runJob('grandMelee', handler, { trigger: 'cron' });

    expect(handler).not.toHaveBeenCalled();
    expect(mockMarkFinished).toHaveBeenCalledWith(1, expect.objectContaining({
      status: 'skipped',
      summary: { skippedReason: 'season_preparation' },
    }));
  });
});

describe('toRunSummary', () => {
  it('keeps only the fields the history shows', () => {
    expect(toRunSummary({ jobName: 'tournament', tournamentName: 'Cup #9', tournamentRound: 3, tournamentMaxRounds: 12, matchesCompleted: 512, tournamentScheduled: false }))
      .toEqual({ tournamentName: 'Cup #9', tournamentRound: 3, tournamentMaxRounds: 12, matchesCompleted: 512 });
    expect(toRunSummary({ jobName: 'settlement', cycleNumber: 81 })).toEqual({ cycleNumber: 81 });
    expect(toRunSummary({ jobName: 'league' })).toBeNull();
    expect(toRunSummary(undefined)).toBeNull();
  });
});
