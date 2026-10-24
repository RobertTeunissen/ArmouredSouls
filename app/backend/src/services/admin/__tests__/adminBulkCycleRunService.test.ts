/**
 * The bulk runner's history row reflects what the cycles did: a cycle that
 * threw (`results[].error`) is not completed, and any such cycle makes the run
 * Failed with the cycle errors. The run itself under the lock is covered by
 * the Heavy suite `schedulerManualRuns.test.ts`.
 */
jest.mock('../../../config/logger', () => ({ __esModule: true, default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
jest.mock('../adminCycleService', () => ({ __esModule: true, executeBulkCycles: jest.fn() }));
jest.mock('../../cycle/cycleScheduler', () => ({
  __esModule: true,
  getActiveJobNames: () => [],
  runExclusive: (_name: string, work: () => Promise<unknown>) => work(),
}));
jest.mock('../../cycle/schedulerRunStore', () => ({
  __esModule: true,
  recordQueued: jest.fn(async () => 5),
  markRunning: jest.fn(),
  markFinished: jest.fn(),
}));

import { executeBulkCycles } from '../adminCycleService';
import { markFinished } from '../../cycle/schedulerRunStore';
import { runBulkCycles } from '../adminBulkCycleRunService';

const execute = executeBulkCycles as jest.Mock;
const finished = markFinished as jest.Mock;

function bulkResult(results: Array<{ cycle: number; error?: string }>): unknown {
  return {
    success: true, cyclesCompleted: results.length, totalCyclesInSystem: 90, includeTournaments: true, includeKoth: true,
    includeDailyFinances: true, generateUsersPerCycleEnabled: false, totalDuration: 3000, averageCycleDuration: 1000,
    results: results.map((entry) => ({ duration: 1000, ...entry })), timestamp: '2026-10-23T12:00:00.000Z',
  };
}

beforeEach(() => jest.clearAllMocks());

describe('runBulkCycles run record', () => {
  it('records Success with every cycle completed when none threw', async () => {
    execute.mockResolvedValue(bulkResult([{ cycle: 81 }, { cycle: 82 }]));
    await runBulkCycles({ cycles: 2 }, 1);
    expect(finished).toHaveBeenCalledWith(5, expect.objectContaining({
      status: 'success',
      error: null,
      summary: { bulk: expect.objectContaining({ cyclesRequested: 2, cyclesCompleted: 2, cyclesFailed: 0 }) },
    }));
  });

  it('records Failed, excludes failed cycles from the count and keeps their errors', async () => {
    execute.mockResolvedValue(bulkResult([{ cycle: 81 }, { cycle: 82, error: 'Canonical cycle identity changed' }, { cycle: 83, error: 'timeout' }]));
    await runBulkCycles({ cycles: 3 }, 1);
    const [, record] = finished.mock.calls.at(-1) as [number, { status: string; error: string; summary: { bulk: { cyclesCompleted: number; cyclesFailed: number } } }];
    expect(record.status).toBe('failed');
    expect(record.summary.bulk).toMatchObject({ cyclesCompleted: 1, cyclesFailed: 2 });
    expect(record.error).toBe('2 of 3 cycles failed — cycle 82: Canonical cycle identity changed; cycle 83: timeout');
  });
});
