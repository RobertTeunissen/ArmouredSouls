/**
 * Unit tests for Tag Team daily execution (Spec 36).
 *
 * Asserts Tag Team runs regardless of cycle parity (no odd/even check),
 * matchmaking lead time is 24h (not 48h), and `shouldRunTagTeamMatchmaking`
 * no longer exists as an export.
 *
 * _Requirements: R2.1, R2.2_
 */

// ── Mocks ────────────────────────────────────────────────────────────

// Mock node-cron to capture registered handlers
const mockSchedule = jest.fn().mockImplementation(() => ({
  stop: jest.fn(),
  start: jest.fn(),
  now: jest.fn(),
  on: jest.fn(),
  emit: jest.fn(),
}));
jest.mock('node-cron', () => ({
  __esModule: true,
  default: {
    schedule: (...args: any[]) => mockSchedule(...args),
  },
  schedule: (...args: any[]) => mockSchedule(...args),
}));

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

const mockPrisma = {
  cycleMetadata: { findUnique: jest.fn().mockResolvedValue({ id: 1, totalCycles: 42 }) },
  scheduledMatchParticipant: { findMany: jest.fn().mockResolvedValue([]) },
  standing: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
};
jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../../src/config/env', () => ({
  __esModule: true,
  getConfig: () => ({ appBaseUrl: '' }),
}));

jest.mock('../../../src/services/notifications/notification-service', () => ({
  __esModule: true,
  buildSuccessMessage: jest.fn(),
  buildErrorMessage: jest.fn(),
  getActiveIntegrations: jest.fn().mockReturnValue([]),
  dispatchNotification: jest.fn(),
}));

jest.mock('../../../src/services/notifications/integration', () => ({
  __esModule: true,
  JobContext: {},
}));

// Mock the tag team dependencies used by executeTagTeamCycle
const mockRepairAllRobots = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/services/economy/repairService', () => ({
  __esModule: true,
  repairAllRobots: (...args: unknown[]) => mockRepairAllRobots(...args),
}));

const mockExecuteScheduledTagTeamBattles = jest.fn().mockResolvedValue({ totalBattles: 5 });
jest.mock('../../../src/services/tag-team/tagTeamBattleOrchestrator', () => ({
  __esModule: true,
  executeScheduledTagTeamBattles: (...args: unknown[]) => mockExecuteScheduledTagTeamBattles(...args),
}));

const mockRebalanceTagTeamLeagues = jest.fn().mockResolvedValue({ totalPromoted: 2, totalDemoted: 1 });
jest.mock('../../../src/services/tag-team/tagTeamLeagueRebalancingService', () => ({
  __esModule: true,
  rebalanceTagTeamLeagues: (...args: unknown[]) => mockRebalanceTagTeamLeagues(...args),
}));

const mockRunTagTeamMatchmaking = jest.fn().mockResolvedValue(10);
jest.mock('../../../src/services/tag-team/tagTeamMatchmakingService', () => ({
  __esModule: true,
  runTagTeamMatchmaking: (...args: unknown[]) => mockRunTagTeamMatchmaking(...args),
}));

// Mock other scheduler dependencies to avoid DB calls
jest.mock('../../../src/utils/scheduleUtils', () => ({
  __esModule: true,
  getNextCronOccurrence: jest.fn().mockReturnValue(new Date()),
}));

jest.mock('../../../src/services/league/leagueBattleOrchestrator', () => ({
  __esModule: true,
  executeScheduledBattles: jest.fn().mockResolvedValue({ totalBattles: 0 }),
}));

jest.mock('../../../src/services/koth/kothBattleOrchestrator', () => ({
  __esModule: true,
  executeScheduledKothBattles: jest.fn().mockResolvedValue({ totalMatches: 0, successfulMatches: 0, failedMatches: 0 }),
}));

jest.mock('../../../src/services/league/leagueRebalancingService', () => ({
  __esModule: true,
  rebalanceLeagues: jest.fn().mockResolvedValue({ totalPromoted: 0, totalDemoted: 0 }),
  rebalanceKothLeagues: jest.fn().mockResolvedValue({ totalPromoted: 0, totalDemoted: 0 }),
  createStandingsAdapter: jest.fn().mockReturnValue({
    entityType: 'robot',
    getEntitiesWithMinPoints: jest.fn().mockResolvedValue([]),
    countEligibleInInstance: jest.fn().mockResolvedValue(0),
    getEntitiesForDemotion: jest.fn().mockResolvedValue([]),
    getInstancesForTier: jest.fn().mockResolvedValue([]),
    countEntitiesInTier: jest.fn().mockResolvedValue(0),
    countEntitiesInDestinationTier: jest.fn().mockResolvedValue(0),
    assignInstance: jest.fn().mockResolvedValue('bronze_1'),
    updateEntityLeague: jest.fn().mockResolvedValue(undefined),
    getEntityCurrentTier: jest.fn().mockReturnValue('bronze'),
    getEntityLeagueId: jest.fn().mockReturnValue('bronze_1'),
    getEntityLeaguePoints: jest.fn().mockReturnValue(0),
    getEntityOwnerId: jest.fn().mockReturnValue(1),
    getEntityDisplayName: jest.fn().mockReturnValue('entity#1'),
    onPromoted: jest.fn().mockResolvedValue(undefined),
    rebalanceInstances: jest.fn().mockResolvedValue(undefined),
    countAllEntities: jest.fn().mockResolvedValue(0),
  }),
}));

jest.mock('../../../src/services/analytics/matchmakingService', () => ({
  __esModule: true,
  runMatchmaking: jest.fn().mockResolvedValue(0),
}));

jest.mock('../../../src/services/tournament/tournamentService', () => ({
  __esModule: true,
  getActiveTournaments: jest.fn().mockResolvedValue([]),
  getCurrentRoundMatches: jest.fn().mockResolvedValue([]),
  advanceWinnersToNextRound: jest.fn().mockResolvedValue(undefined),
  autoCreateNextTournament: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../src/services/tournament/tournamentBattleOrchestrator', () => ({
  __esModule: true,
  processTournamentBattle: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/services/koth/kothMatchmakingService', () => ({
  __esModule: true,
  runKothMatchmaking: jest.fn().mockResolvedValue(0),
}));

jest.mock('../../../src/services/practice-arena/practiceArenaMetrics', () => ({
  __esModule: true,
  practiceArenaMetrics: { flushAndReset: jest.fn() },
}));

jest.mock('../../../src/services/common/eventLogger', () => ({
  __esModule: true,
  EventLogger: jest.fn().mockImplementation(() => ({
    logCycleStart: jest.fn(),
    logCycleComplete: jest.fn(),
    logEventBatch: jest.fn(),
  })),
  EventType: { PASSIVE_INCOME: 'passive_income', OPERATING_COSTS: 'operating_costs', CYCLE_END_BALANCE: 'cycle_end_balance' },
}));

// ── Import under test ────────────────────────────────────────────────

import { initScheduler, resetScheduler, SchedulerConfig } from '../../../src/services/cycle/cycleScheduler';
import * as tagTeamExports from '../../../src/services/tag-team/index';

// ── Helpers ──────────────────────────────────────────────────────────

const defaultConfig: SchedulerConfig = {
  enabled: true,
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

/**
 * Finds the cron callback registered for a given job name by inspecting
 * the mockSchedule calls (node-cron mock). The third arg contains { name }.
 */
function getRegisteredHandler(jobName: string): (() => void) | undefined {
  const call = mockSchedule.mock.calls.find(
    (c: any[]) => c[2]?.name === jobName
  );
  return call?.[1];
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Tag Team daily execution (R2.1, R2.2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.cycleMetadata.findUnique.mockResolvedValue({ id: 1, totalCycles: 42 });
    resetScheduler();
    mockSchedule.mockClear();
  });

  afterEach(() => {
    resetScheduler();
  });

  test('shouldRunTagTeamMatchmaking is NOT exported from tag-team barrel', () => {
    expect(tagTeamExports).not.toHaveProperty('shouldRunTagTeamMatchmaking');
  });

  test('executeTagTeamCycle runs all steps regardless of cycle number', async () => {
    // Initialize scheduler to register the real executeTagTeamCycle handler
    initScheduler(defaultConfig);

    // Get the registered cron callback for tagTeam
    const tagTeamCallback = getRegisteredHandler('tagTeam');
    expect(tagTeamCallback).toBeDefined();

    // Invoke the handler (this triggers runJob → executeTagTeamCycle internally)
    await tagTeamCallback!();

    // Wait for the async runJob to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify all three core functions are called regardless of cycle number (42 = even)
    expect(mockExecuteScheduledTagTeamBattles).toHaveBeenCalled();
    expect(mockRebalanceTagTeamLeagues).toHaveBeenCalled();
    expect(mockRunTagTeamMatchmaking).toHaveBeenCalled();
  });

  test('matchmaking lead time is approximately 24h from now (within 1 minute tolerance)', async () => {
    // Initialize scheduler to register the real executeTagTeamCycle handler
    initScheduler(defaultConfig);

    // Get the registered cron callback for tagTeam
    const tagTeamCallback = getRegisteredHandler('tagTeam');
    expect(tagTeamCallback).toBeDefined();

    // Invoke the handler
    await tagTeamCallback!();

    // Wait for the async runJob to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify matchmaking was called without arguments
    // (service uses defaultScheduledFor() internally which computes 24h + rounded to hour)
    expect(mockRunTagTeamMatchmaking).toHaveBeenCalledTimes(1);
    expect(mockRunTagTeamMatchmaking).toHaveBeenCalledWith();

    // Verify defaultScheduledFor() produces correct result by importing it directly
    const { defaultScheduledFor } = await import('../../../src/services/matchmaking/teamMatchmakingUtils');
    const beforeTime = Date.now();
    const scheduledFor = defaultScheduledFor();

    // The implementation does: new Date(Date.now() + 24h) then setMinutes(0,0,0)
    const expected = new Date(beforeTime + 24 * 60 * 60 * 1000);
    expected.setMinutes(0, 0, 0);

    // Within 1 minute tolerance (accounts for test execution time)
    const diffMs = Math.abs(scheduledFor.getTime() - expected.getTime());
    expect(diffMs).toBeLessThan(60 * 1000);

    // Verify minutes/seconds/ms are zeroed (rounded to the hour)
    expect(scheduledFor.getMinutes()).toBe(0);
    expect(scheduledFor.getSeconds()).toBe(0);
    expect(scheduledFor.getMilliseconds()).toBe(0);

    // Verify it's approximately 24h from now (between 23h and 24h due to rounding)
    const hoursFromNow = (scheduledFor.getTime() - beforeTime) / (1000 * 60 * 60);
    expect(hoursFromNow).toBeGreaterThan(23);
    expect(hoursFromNow).toBeLessThanOrEqual(24);
  });
});
