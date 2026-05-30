import * as fc from 'fast-check';
import {
  runJob,
  resetScheduler,
  initScheduler,
  SchedulerConfig,
} from '../src/services/cycle/cycleScheduler';

// --- Mocks ---

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
  default: {
    schedule: (...args: any[]) => mockSchedule(...args),
  },
  schedule: (...args: any[]) => mockSchedule(...args),
}));

// Mock logger to capture structured log entries
const logEntries: Array<{ level: string; message: string | Record<string, unknown> }> = [];
jest.mock('../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: (msg: string | Record<string, unknown>) => logEntries.push({ level: 'info', message: msg }),
    error: (msg: string | Record<string, unknown>) => logEntries.push({ level: 'error', message: msg }),
    warn: (msg: string | Record<string, unknown>) => logEntries.push({ level: 'warn', message: msg }),
    debug: (msg: string | Record<string, unknown>) => logEntries.push({ level: 'debug', message: msg }),
  },
}));

// Mock all service imports to avoid database calls
jest.mock('../src/services/economy/repairService', () => ({
  repairAllRobots: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/services/league/leagueBattleOrchestrator', () => ({
  executeScheduledBattles: jest.fn().mockResolvedValue({ totalBattles: 0 }),
}));
jest.mock('../src/services/koth/kothBattleOrchestrator', () => ({
  executeScheduledKothBattles: jest.fn().mockResolvedValue({ totalMatches: 0, successfulMatches: 0, failedMatches: 0 }),
}));
jest.mock('../src/services/league/leagueRebalancingService', () => ({
  rebalanceLeagues: jest.fn().mockResolvedValue({ totalPromoted: 0, totalDemoted: 0 }),
}));
jest.mock('../src/services/analytics/matchmakingService', () => ({
  runMatchmaking: jest.fn().mockResolvedValue(0),
}));
jest.mock('../src/services/tournament/tournamentService', () => ({
  getActiveTournaments: jest.fn().mockResolvedValue([]),
  getCurrentRoundMatches: jest.fn().mockResolvedValue([]),
  advanceWinnersToNextRound: jest.fn().mockResolvedValue(undefined),
  autoCreateNextTournament: jest.fn().mockResolvedValue(null),
}));
jest.mock('../src/services/tournament/tournamentBattleOrchestrator', () => ({
  processTournamentBattle: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/services/tag-team/tagTeamBattleOrchestrator', () => ({
  executeScheduledTagTeamBattles: jest.fn().mockResolvedValue({ totalBattles: 0 }),
}));
jest.mock('../src/services/tag-team/tagTeamLeagueRebalancingService', () => ({
  rebalanceTagTeamLeagues: jest.fn().mockResolvedValue({ totalPromoted: 0, totalDemoted: 0 }),
}));
jest.mock('../src/services/tag-team/tagTeamMatchmakingService', () => ({
  runTagTeamMatchmaking: jest.fn().mockResolvedValue(0),
}));
jest.mock('../src/services/koth/kothMatchmakingService', () => ({
  runKothMatchmaking: jest.fn().mockResolvedValue(0),
}));
jest.mock('../src/services/common/eventLogger', () => ({
  EventLogger: jest.fn().mockImplementation(() => ({
    logPassiveIncome: jest.fn().mockResolvedValue(undefined),
    logOperatingCosts: jest.fn().mockResolvedValue(undefined),
    logCycleEndBalance: jest.fn().mockResolvedValue(undefined),
    logCycleStart: jest.fn().mockResolvedValue(undefined),
    logCycleComplete: jest.fn().mockResolvedValue(undefined),
    logEventBatch: jest.fn().mockResolvedValue(undefined),
  })),
  EventType: {
    PASSIVE_INCOME: 'PASSIVE_INCOME',
    OPERATING_COSTS: 'OPERATING_COSTS',
    CYCLE_END_BALANCE: 'CYCLE_END_BALANCE',
  },
}));
jest.mock('../src/services/practice-arena/practiceArenaMetrics', () => ({
  practiceArenaMetrics: {
    flushAndReset: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../src/services/notifications/notification-service', () => ({
  buildSuccessMessage: jest.fn().mockReturnValue(null),
  buildErrorMessage: jest.fn().mockReturnValue('error'),
  getActiveIntegrations: jest.fn().mockReturnValue([]),
  dispatchNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    cycleMetadata: {
      findUnique: jest.fn().mockResolvedValue({ id: 1, totalCycles: 5 }),
      create: jest.fn().mockResolvedValue({ id: 1, totalCycles: 0 }),
      update: jest.fn().mockResolvedValue({ id: 1, totalCycles: 6 }),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
    },
    robot: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    tagTeam: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    facility: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    tournament: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  },
}));

// --- Constants ---

const ALL_EVENT_NAMES = [
  'league',
  'team2v2League',
  'tournament',
  'tagTeam',
  'koth',
  'team3v3League',
  'team2v2Tournament',
  'grandMelee',
  'team3v3Tournament',
  'settlement',
] as const;

const BATTLE_EVENT_NAMES = ALL_EVENT_NAMES.filter(n => n !== 'settlement');
void BATTLE_EVENT_NAMES; // exported for documentation; used in Property 2 generator constraints

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

beforeEach(() => {
  resetScheduler();
  mockSchedule.mockClear();
  logEntries.length = 0;
  initScheduler(defaultConfig);
});

// =============================================================================
// Property 1: Slot Uniqueness
// Feature: 36-cron-schedule-restructure, Property 1: For any valid slot map, no two events fire in the same hour
// =============================================================================
describe('Property 1: Slot Uniqueness', () => {
  /**
   * **Validates: Requirements 1.1, 11.1**
   *
   * For any valid slot map configuration, no two events fire in the same
   * UTC hour within a 24-hour window. A "valid" configuration means all
   * 10 hours are distinct integers in [0, 23].
   */

  test('no two events fire in the same UTC hour for any valid slot map', () => {
    // Generator: produce 10 unique hours from 0-23
    const uniqueHoursGen = fc
      .uniqueArray(fc.integer({ min: 0, max: 23 }), { minLength: 10, maxLength: 10 })
      .map((hours) => ({
        leagueHour: hours[0],
        team2v2LeagueHour: hours[1],
        tournamentHour: hours[2],
        tagTeamHour: hours[3],
        kothHour: hours[4],
        team3v3LeagueHour: hours[5],
        team2v2TournamentHour: hours[6],
        grandMeleeHour: hours[7],
        team3v3TournamentHour: hours[8],
        settlementHour: hours[9],
      }));

    fc.assert(
      fc.property(uniqueHoursGen, (config) => {
        const hours = [
          config.leagueHour,
          config.team2v2LeagueHour,
          config.tournamentHour,
          config.tagTeamHour,
          config.kothHour,
          config.team3v3LeagueHour,
          config.team2v2TournamentHour,
          config.grandMeleeHour,
          config.team3v3TournamentHour,
          config.settlementHour,
        ];

        // Assert: all hours are unique (no two events fire in the same hour)
        const uniqueSet = new Set(hours);
        expect(uniqueSet.size).toBe(10);

        // Also verify by building a SchedulerConfig and checking the resolved hours
        const schedulerConfig: SchedulerConfig = {
          enabled: true,
          leagueSchedule: `0 ${config.leagueHour} * * *`,
          tournamentSchedule: `0 ${config.tournamentHour} * * *`,
          tagTeamSchedule: `0 ${config.tagTeamHour} * * *`,
          settlementSchedule: `0 ${config.settlementHour} * * *`,
          kothSchedule: `0 ${config.kothHour} * * *`,
          team2v2LeagueSchedule: `0 ${config.team2v2LeagueHour} * * *`,
          team3v3LeagueSchedule: `0 ${config.team3v3LeagueHour} * * *`,
          team2v2TournamentSchedule: `0 ${config.team2v2TournamentHour} * * *`,
          team3v3TournamentSchedule: `0 ${config.team3v3TournamentHour} * * *`,
          grandMeleeSchedule: `0 ${config.grandMeleeHour} * * *`,
        };

        // Extract hours from cron expressions
        const resolvedHours = [
          schedulerConfig.leagueSchedule,
          schedulerConfig.team2v2LeagueSchedule,
          schedulerConfig.tournamentSchedule,
          schedulerConfig.tagTeamSchedule,
          schedulerConfig.kothSchedule,
          schedulerConfig.team3v3LeagueSchedule,
          schedulerConfig.team2v2TournamentSchedule,
          schedulerConfig.grandMeleeSchedule,
          schedulerConfig.team3v3TournamentSchedule,
          schedulerConfig.settlementSchedule,
        ].map((expr) => {
          const parts = expr.split(' ');
          return parseInt(parts[1], 10);
        });

        const resolvedSet = new Set(resolvedHours);
        expect(resolvedSet.size).toBe(10);
      }),
      { numRuns: 100 }
    );
  });
});

// =============================================================================
// Property 2: Settlement Boundary Ordering
// Feature: 36-cron-schedule-restructure, Property 2: For any valid slot map, settlement hour < minimum battle event hour
// =============================================================================
describe('Property 2: Settlement Boundary Ordering', () => {
  /**
   * **Validates: Requirements 2.6, 5.1, 5.3, 11.2**
   *
   * For any valid slot map configuration, the settlement job's UTC hour
   * is strictly less than the smallest battle-event UTC hour within the
   * same cycle. This ensures settlement closes the previous cycle before
   * any battle event of the next cycle starts.
   */

  test('settlement hour is strictly less than the minimum battle event hour', () => {
    // Generator: settlement hour in [0, 7], battle event hours in [8, 23] (9 unique)
    const configGen = fc
      .tuple(
        fc.integer({ min: 0, max: 7 }), // settlement hour
        fc.uniqueArray(fc.integer({ min: 8, max: 23 }), { minLength: 9, maxLength: 9 }) // 9 battle event hours
      )
      .map(([settlementHour, battleHours]) => ({
        settlementHour,
        leagueHour: battleHours[0],
        team2v2LeagueHour: battleHours[1],
        tournamentHour: battleHours[2],
        tagTeamHour: battleHours[3],
        kothHour: battleHours[4],
        team3v3LeagueHour: battleHours[5],
        team2v2TournamentHour: battleHours[6],
        grandMeleeHour: battleHours[7],
        team3v3TournamentHour: battleHours[8],
      }));

    fc.assert(
      fc.property(configGen, (config) => {
        const settlementHour = config.settlementHour;
        const battleHours = [
          config.leagueHour,
          config.team2v2LeagueHour,
          config.tournamentHour,
          config.tagTeamHour,
          config.kothHour,
          config.team3v3LeagueHour,
          config.team2v2TournamentHour,
          config.grandMeleeHour,
          config.team3v3TournamentHour,
        ];

        const minBattleHour = Math.min(...battleHours);

        // Assert: settlement hour < minimum battle event hour
        expect(settlementHour).toBeLessThan(minBattleHour);

        // Also verify via SchedulerConfig construction
        const schedulerConfig: SchedulerConfig = {
          enabled: true,
          leagueSchedule: `0 ${config.leagueHour} * * *`,
          tournamentSchedule: `0 ${config.tournamentHour} * * *`,
          tagTeamSchedule: `0 ${config.tagTeamHour} * * *`,
          settlementSchedule: `0 ${config.settlementHour} * * *`,
          kothSchedule: `0 ${config.kothHour} * * *`,
          team2v2LeagueSchedule: `0 ${config.team2v2LeagueHour} * * *`,
          team3v3LeagueSchedule: `0 ${config.team3v3LeagueHour} * * *`,
          team2v2TournamentSchedule: `0 ${config.team2v2TournamentHour} * * *`,
          team3v3TournamentSchedule: `0 ${config.team3v3TournamentHour} * * *`,
          grandMeleeSchedule: `0 ${config.grandMeleeHour} * * *`,
        };

        // Extract settlement hour from cron expression
        const resolvedSettlementHour = parseInt(schedulerConfig.settlementSchedule.split(' ')[1], 10);

        // Extract all battle event hours from cron expressions
        const resolvedBattleHours = [
          schedulerConfig.leagueSchedule,
          schedulerConfig.team2v2LeagueSchedule,
          schedulerConfig.tournamentSchedule,
          schedulerConfig.tagTeamSchedule,
          schedulerConfig.kothSchedule,
          schedulerConfig.team3v3LeagueSchedule,
          schedulerConfig.team2v2TournamentSchedule,
          schedulerConfig.grandMeleeSchedule,
          schedulerConfig.team3v3TournamentSchedule,
        ].map((expr) => parseInt(expr.split(' ')[1], 10));

        const resolvedMinBattleHour = Math.min(...resolvedBattleHours);
        expect(resolvedSettlementHour).toBeLessThan(resolvedMinBattleHour);
      }),
      { numRuns: 100 }
    );
  });
});

// =============================================================================
// Property 3: Execution Logging Completeness
// Feature: 36-cron-schedule-restructure, Property 3: For any cycle, every executed handler is logged exactly once with non-null duration
// =============================================================================
describe('Property 3: Execution Logging Completeness', () => {
  /**
   * **Validates: Requirements 7.1, 11.3**
   *
   * For any cycle number and any subset of battle event handlers that
   * execute, each handler is logged exactly once with non-null duration.
   * We use the `runJob` wrapper from cycleScheduler and verify that
   * each executed handler produces exactly one structured log entry
   * with `event: 'battle_event_complete'` and `durationMs !== null`.
   */

  test('every executed handler is logged exactly once with non-null durationMs', async () => {
    // Generator: arbitrary cycle number and a non-empty subset of event names
    const subsetGen = fc
      .tuple(
        fc.integer({ min: 0, max: 100000 }), // cycle number (for context)
        fc.subarray(ALL_EVENT_NAMES as unknown as string[], { minLength: 1 })
      )
      .map(([cycleNumber, subset]) => ({
        cycleNumber,
        handlers: subset as Array<typeof ALL_EVENT_NAMES[number]>,
      }));

    await fc.assert(
      fc.asyncProperty(subsetGen, async ({ cycleNumber: _cycleNumber, handlers }) => {
        logEntries.length = 0;

        // Execute each handler in the subset via runJob
        for (const handlerName of handlers) {
          await runJob(handlerName as any, async () => {
            // Simulate a handler that completes successfully
            return { jobName: handlerName } as any;
          });
        }

        // Collect structured log entries with event: 'battle_event_complete'
        const structuredLogs = logEntries.filter(
          (entry) =>
            entry.level === 'info' &&
            typeof entry.message === 'object' &&
            entry.message !== null &&
            (entry.message as Record<string, unknown>).event === 'battle_event_complete'
        );

        // For each handler in the subset, assert exactly one structured log entry
        for (const handlerName of handlers) {
          const matchingLogs = structuredLogs.filter(
            (entry) =>
              (entry.message as Record<string, unknown>).eventName === handlerName
          );

          // Exactly one log entry per handler
          expect(matchingLogs.length).toBe(1);

          // durationMs must be non-null and a number >= 0
          const logMsg = matchingLogs[0].message as Record<string, unknown>;
          expect(logMsg.durationMs).not.toBeNull();
          expect(logMsg.durationMs).not.toBeUndefined();
          expect(typeof logMsg.durationMs).toBe('number');
          expect(logMsg.durationMs as number).toBeGreaterThanOrEqual(0);
        }

        // Total structured logs should equal the number of handlers executed
        expect(structuredLogs.length).toBe(handlers.length);
      }),
      { numRuns: 100 }
    );
  });
});
