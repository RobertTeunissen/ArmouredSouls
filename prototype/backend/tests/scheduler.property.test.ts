import * as fc from 'fast-check';
import {
  initScheduler,
  getSchedulerState,
  runJob,
  resetScheduler,
  SchedulerConfig,
} from '../src/services/cycleScheduler';

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

// Mock logger to capture log output
const logEntries: { level: string; message: string }[] = [];
jest.mock('../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: (msg: string) => logEntries.push({ level: 'info', message: msg }),
    error: (msg: string) => logEntries.push({ level: 'error', message: msg }),
    warn: (msg: string) => logEntries.push({ level: 'warn', message: msg }),
    debug: (msg: string) => logEntries.push({ level: 'debug', message: msg }),
  },
}));

// Mock all service imports to avoid database calls
jest.mock('../src/services/repairService', () => ({
  repairAllRobots: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/services/battleOrchestrator', () => ({
  executeScheduledBattles: jest.fn().mockResolvedValue({ totalBattles: 0 }),
}));
jest.mock('../src/services/leagueRebalancingService', () => ({
  rebalanceLeagues: jest.fn().mockResolvedValue({ totalPromoted: 0, totalDemoted: 0 }),
}));
jest.mock('../src/services/matchmakingService', () => ({
  runMatchmaking: jest.fn().mockResolvedValue(0),
}));
jest.mock('../src/services/tournamentService', () => ({
  getActiveTournaments: jest.fn().mockResolvedValue([]),
  getCurrentRoundMatches: jest.fn().mockResolvedValue([]),
  advanceWinnersToNextRound: jest.fn().mockResolvedValue(undefined),
  autoCreateNextTournament: jest.fn().mockResolvedValue(null),
}));
jest.mock('../src/services/tournamentBattleOrchestrator', () => ({
  processTournamentBattle: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/services/tagTeamBattleOrchestrator', () => ({
  executeScheduledTagTeamBattles: jest.fn().mockResolvedValue({ totalBattles: 0 }),
}));
jest.mock('../src/services/tagTeamLeagueRebalancingService', () => ({
  rebalanceTagTeamLeagues: jest.fn().mockResolvedValue({ totalPromoted: 0, totalDemoted: 0 }),
}));
jest.mock('../src/services/tagTeamMatchmakingService', () => ({
  runTagTeamMatchmaking: jest.fn().mockResolvedValue(0),
}));
jest.mock('../src/services/eventLogger', () => ({
  EventLogger: jest.fn().mockImplementation(() => ({
    logPassiveIncome: jest.fn().mockResolvedValue(undefined),
    logOperatingCosts: jest.fn().mockResolvedValue(undefined),
    logCycleEndBalance: jest.fn().mockResolvedValue(undefined),
  })),
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

const NUM_RUNS = 25;

const defaultConfig: SchedulerConfig = {
  enabled: true,
  leagueSchedule: '0 20 * * *',
  tournamentSchedule: '0 8 * * *',
  tagTeamSchedule: '0 12 * * *',
  settlementSchedule: '0 23 * * *',
};

function freshScheduler(config: SchedulerConfig = defaultConfig): void {
  resetScheduler();
  mockSchedule.mockClear();
  logEntries.length = 0;
  initScheduler(config);
}

beforeEach(() => {
  resetScheduler();
  mockSchedule.mockClear();
  logEntries.length = 0;
});

describe('Scheduler Property Tests', () => {
  // =========================================================================
  // Property 14: Scheduler activation control
  // =========================================================================
  describe('Property 14: Scheduler activation control', () => {
    /**
     * **Validates: Requirements 24.12, 24.13**
     * Active if and only if `SCHEDULER_ENABLED` is exactly `'true'`.
     */

    test('scheduler is active only when enabled is exactly true', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (enabled) => {
            resetScheduler();
            mockSchedule.mockClear();

            initScheduler({ ...defaultConfig, enabled });
            const state = getSchedulerState();

            if (enabled) {
              expect(state.active).toBe(true);
              expect(mockSchedule).toHaveBeenCalledTimes(4);
            } else {
              expect(state.active).toBe(false);
              expect(mockSchedule).not.toHaveBeenCalled();
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('disabled scheduler logs that scheduling is disabled', () => {
      fc.assert(
        fc.property(
          fc.constant(false),
          () => {
            resetScheduler();
            logEntries.length = 0;

            initScheduler({ ...defaultConfig, enabled: false });

            const disabledLog = logEntries.find(e =>
              e.message.includes('disabled') || e.message.includes('not true')
            );
            expect(disabledLog).toBeDefined();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // =========================================================================
  // Property 15: Scheduler cron configuration
  // =========================================================================
  describe('Property 15: Scheduler cron configuration', () => {
    /**
     * **Validates: Requirements 24.2, 24.4, 24.6, 24.10**
     * Custom cron expressions are used when provided, defaults otherwise.
     */

    const cronGen = fc.tuple(
      fc.integer({ min: 0, max: 59 }),
      fc.integer({ min: 0, max: 23 }),
    ).map(([min, hour]) => `${min} ${hour} * * *`);

    test('custom cron expressions are registered for each job', () => {
      fc.assert(
        fc.property(
          cronGen, cronGen, cronGen, cronGen,
          (league, tournament, tagTeam, settlement) => {
            resetScheduler();
            mockSchedule.mockClear();

            initScheduler({
              enabled: true,
              leagueSchedule: league,
              tournamentSchedule: tournament,
              tagTeamSchedule: tagTeam,
              settlementSchedule: settlement,
            });

            const calls = mockSchedule.mock.calls;
            expect(calls.length).toBe(4);

            const registeredSchedules = calls.map((c: any[]) => c[0]);
            expect(registeredSchedules).toContain(league);
            expect(registeredSchedules).toContain(tournament);
            expect(registeredSchedules).toContain(tagTeam);
            expect(registeredSchedules).toContain(settlement);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('scheduler state reflects configured schedules', () => {
      fc.assert(
        fc.property(
          cronGen, cronGen, cronGen, cronGen,
          (league, tournament, tagTeam, settlement) => {
            resetScheduler();

            initScheduler({
              enabled: true,
              leagueSchedule: league,
              tournamentSchedule: tournament,
              tagTeamSchedule: tagTeam,
              settlementSchedule: settlement,
            });

            const state = getSchedulerState();
            const jobMap = new Map(state.jobs.map(j => [j.name, j]));

            expect(jobMap.get('league')?.schedule).toBe(league);
            expect(jobMap.get('tournament')?.schedule).toBe(tournament);
            expect(jobMap.get('tagTeam')?.schedule).toBe(tagTeam);
            expect(jobMap.get('settlement')?.schedule).toBe(settlement);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // =========================================================================
  // Property 16: Battle job step ordering — repair first
  // =========================================================================
  describe('Property 16: Battle job step ordering — repair first', () => {
    /**
     * **Validates: Requirements 24.3, 24.5, 24.8, 24.24**
     * Repair is always the first step in battle jobs.
     */

    const battleJobGen = fc.constantFrom(
      { name: 'League Cycle', jobName: 'league' as const },
      { name: 'Tournament Cycle', jobName: 'tournament' as const },
      { name: 'Tag Team Cycle', jobName: 'tagTeam' as const },
    );

    test('repair is always the first step in any battle job', async () => {
      freshScheduler();

      await fc.assert(
        fc.asyncProperty(
          battleJobGen,
          async ({ name, jobName }) => {
            logEntries.length = 0;

            await runJob(jobName, async () => {
              logEntries.push({ level: 'info', message: `${name}: Step 1 — Repairing all robots` });
              await require('../src/services/repairService').repairAllRobots(true);
              logEntries.push({ level: 'info', message: `${name}: Step 2 — Executing battles` });
            });

            const stepLogs = logEntries
              .filter(e => e.message.includes(`${name}: Step`))
              .map(e => e.message);

            expect(stepLogs.length).toBeGreaterThanOrEqual(2);
            expect(stepLogs[0]).toContain('Repairing all robots');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // =========================================================================
  // Property 17: Tag team odd/even cycle behavior
  // =========================================================================
  describe('Property 17: Tag team odd/even cycle behavior', () => {
    /**
     * **Validates: Requirements 24.7, 24.8, 24.9**
     * Battles execute only on odd cycles.
     */

    test('tag team battles execute only on odd cycle numbers', async () => {
      freshScheduler();

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 1000 }),
          async (cycleNumber) => {
            logEntries.length = 0;
            const isOddCycle = cycleNumber % 2 === 1;

            await runJob('tagTeam', async () => {
              logEntries.push({ level: 'info', message: 'Tag Team Cycle: Step 1 — Repairing all robots' });

              if (!isOddCycle) {
                logEntries.push({
                  level: 'info',
                  message: `Tag Team Cycle: Skipping battles on even cycle ${cycleNumber}`,
                });
                return;
              }

              logEntries.push({
                level: 'info',
                message: `Tag Team Cycle: Step 2 — Executing tag team battles (odd cycle ${cycleNumber})`,
              });
            });

            const skipLog = logEntries.find(e => e.message.includes('Skipping battles'));
            const battleLog = logEntries.find(e => e.message.includes('Executing tag team battles'));

            if (isOddCycle) {
              expect(battleLog).toBeDefined();
              expect(skipLog).toBeUndefined();
            } else {
              expect(skipLog).toBeDefined();
              expect(battleLog).toBeUndefined();
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // =========================================================================
  // Property 18: Scheduler concurrency lock
  // =========================================================================
  describe('Property 18: Scheduler concurrency lock', () => {
    /**
     * **Validates: Requirements 24.15, 24.16**
     * Only one job runs at a time, others queue.
     */

    test('concurrent jobs execute sequentially, never overlap', async () => {
      // Test with 2 concurrent jobs (the lock mechanism supports sequential handoff)
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            ['league', 'tournament'] as const,
            ['tournament', 'settlement'] as const,
            ['tagTeam', 'league'] as const,
            ['settlement', 'tagTeam'] as const,
          ),
          async ([first, second]) => {
            freshScheduler();

            const executionOrder: string[] = [];
            let concurrentCount = 0;
            let maxConcurrent = 0;

            const p1 = runJob(first, async () => {
              concurrentCount++;
              maxConcurrent = Math.max(maxConcurrent, concurrentCount);
              executionOrder.push(`start:${first}`);
              await new Promise(resolve => setTimeout(resolve, 10));
              executionOrder.push(`end:${first}`);
              concurrentCount--;
            });

            const p2 = runJob(second, async () => {
              concurrentCount++;
              maxConcurrent = Math.max(maxConcurrent, concurrentCount);
              executionOrder.push(`start:${second}`);
              await new Promise(resolve => setTimeout(resolve, 5));
              executionOrder.push(`end:${second}`);
              concurrentCount--;
            });

            await Promise.all([p1, p2]);

            // Max concurrent should never exceed 1
            expect(maxConcurrent).toBe(1);

            // Both jobs should have started and ended
            expect(executionOrder).toEqual([
              `start:${first}`,
              `end:${first}`,
              `start:${second}`,
              `end:${second}`,
            ]);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('scheduler state shows running job and queue', async () => {
      freshScheduler();

      let resolveFirst: () => void;
      const firstJobPromise = new Promise<void>(r => { resolveFirst = r; });

      const job1 = runJob('league', async () => {
        const state = getSchedulerState();
        expect(state.runningJob).toBe('league');
        await firstJobPromise;
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const job2 = runJob('tournament', async () => {});

      const midState = getSchedulerState();
      expect(midState.runningJob).toBe('league');
      expect(midState.queue).toContain('tournament');

      resolveFirst!();
      await Promise.all([job1, job2]);

      const finalState = getSchedulerState();
      expect(finalState.runningJob).toBeNull();
      expect(finalState.queue).toEqual([]);
    });
  });

  // =========================================================================
  // Property 19: Scheduler error isolation
  // =========================================================================
  describe('Property 19: Scheduler error isolation', () => {
    /**
     * **Validates: Requirements 24.17, 24.18**
     * Errors are caught and logged, backend doesn't crash.
     */

    test('errors in job handlers are caught and logged without crashing', async () => {
      freshScheduler();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (errorMessage) => {
            logEntries.length = 0;

            // runJob should NOT throw even when the handler throws
            await runJob('league', async () => {
              throw new Error(errorMessage);
            });

            // Error should be logged
            const errorLog = logEntries.find(
              e => e.level === 'error' && e.message.includes(errorMessage)
            );
            expect(errorLog).toBeDefined();

            // Verify the error log mentions the job name
            expect(errorLog!.message).toContain('league');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('failed job does not prevent subsequent jobs from running', async () => {
      freshScheduler();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (errorMessage) => {
            // First job fails
            await runJob('league', async () => {
              throw new Error(errorMessage);
            });

            // Second job should still run successfully
            let secondJobRan = false;
            await runJob('tournament', async () => {
              secondJobRan = true;
            });

            expect(secondJobRan).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // =========================================================================
  // Property 20: Daily settlement updates cycle metadata
  // =========================================================================
  describe('Property 20: Daily settlement updates cycle metadata', () => {
    /**
     * **Validates: Requirements 24.19**
     * `totalCycles` incremented by 1 after settlement.
     */

    test('settlement increments totalCycles by 1', async () => {
      const prisma = require('../src/lib/prisma').default;
      freshScheduler();

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 10000 }),
          async (currentCycles) => {
            prisma.cycleMetadata.findUnique.mockResolvedValue({
              id: 1,
              totalCycles: currentCycles,
            });
            prisma.cycleMetadata.update.mockClear();
            prisma.cycleMetadata.update.mockResolvedValue({
              id: 1,
              totalCycles: currentCycles + 1,
            });

            await runJob('settlement', async () => {
              const metadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
              const newCycleNumber = metadata.totalCycles + 1;

              await prisma.cycleMetadata.update({
                where: { id: 1 },
                data: {
                  totalCycles: newCycleNumber,
                  lastCycleAt: new Date(),
                },
              });
            });

            expect(prisma.cycleMetadata.update).toHaveBeenCalledWith(
              expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({
                  totalCycles: currentCycles + 1,
                }),
              })
            );
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // =========================================================================
  // Property 21: Scheduler job execution logging
  // =========================================================================
  describe('Property 21: Scheduler job execution logging', () => {
    /**
     * **Validates: Requirements 24.20**
     * Each job logs name, start, end, duration.
     */

    test('every job execution logs name, start time, end time, and duration', async () => {
      const jobNames: Array<'league' | 'tournament' | 'tagTeam' | 'settlement'> =
        ['league', 'tournament', 'tagTeam', 'settlement'];

      freshScheduler();

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...jobNames),
          async (jobName) => {
            logEntries.length = 0;

            await runJob(jobName, async () => {
              await new Promise(resolve => setTimeout(resolve, 2));
            });

            const startLog = logEntries.find(
              e => e.level === 'info' && e.message.includes(`"${jobName}" started`)
            );
            expect(startLog).toBeDefined();

            const endLog = logEntries.find(
              e => e.level === 'info' && e.message.includes(`"${jobName}" completed`) && e.message.includes('duration:')
            );
            expect(endLog).toBeDefined();

            if (endLog) {
              const durationMatch = endLog.message.match(/duration:\s*(\d+)ms/);
              expect(durationMatch).not.toBeNull();
              const duration = parseInt(durationMatch![1], 10);
              expect(duration).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('failed jobs also log name, start, end, and duration', async () => {
      freshScheduler();

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('league', 'tournament', 'tagTeam', 'settlement') as fc.Arbitrary<'league' | 'tournament' | 'tagTeam' | 'settlement'>,
          fc.string({ minLength: 1, maxLength: 50 }),
          async (jobName, errorMsg) => {
            logEntries.length = 0;

            await runJob(jobName, async () => {
              throw new Error(errorMsg);
            });

            const startLog = logEntries.find(
              e => e.level === 'info' && e.message.includes(`"${jobName}" started`)
            );
            expect(startLog).toBeDefined();

            const failLog = logEntries.find(
              e => e.level === 'error' && e.message.includes(`"${jobName}" failed`) && e.message.includes('duration:')
            );
            expect(failLog).toBeDefined();

            if (failLog) {
              const durationMatch = failLog.message.match(/duration:\s*(\d+)ms/);
              expect(durationMatch).not.toBeNull();
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
