/**
 * The admin rollover as a background scheduler run: it takes the scheduler
 * lock under `seasonRollover`, refuses a second start while one is pending,
 * queued or executing (either trigger), and audits the outcome.
 */
jest.mock('../../../config/logger', () => ({ __esModule: true, default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));

const mockActiveJobs: string[] = [];
let releaseLock: (() => void) | null = null;
const mockRunExclusive = jest.fn(async <T>(name: string, work: () => Promise<T>): Promise<T> => {
  mockActiveJobs.push(name);
  // Holds the "lock" until the test releases it, like a job running ahead.
  if (mockHoldLock) await new Promise<void>((resolve) => { releaseLock = resolve; });
  try {
    return await work();
  } finally {
    mockActiveJobs.splice(mockActiveJobs.indexOf(name), 1);
  }
});
let mockHoldLock = false;
jest.mock('../../cycle/cycleScheduler', () => ({
  __esModule: true,
  getActiveJobNames: () => [...mockActiveJobs],
  runExclusive: (name: string, work: () => Promise<unknown>) => mockRunExclusive(name, work),
}));
jest.mock('../../cycle/schedulerRunStore', () => ({ __esModule: true, recordQueued: jest.fn(async () => 41) }));
jest.mock('../../admin/adminAuditLogService', () => ({ __esModule: true, recordAction: jest.fn() }));
let mockInProgress = false;
jest.mock('../seasonRolloverService', () => ({
  __esModule: true,
  executeSeasonRollover: jest.fn(),
  isRolloverInProgress: () => mockInProgress,
}));

import { recordAction } from '../../admin/adminAuditLogService';
import { recordQueued } from '../../cycle/schedulerRunStore';
import { executeSeasonRollover } from '../seasonRolloverService';
import { getQueuedAdminRollover, isRolloverActive, runAdminRollover, startAdminRollover } from '../adminSeasonRolloverRunService';

const execute = executeSeasonRollover as jest.MockedFunction<typeof executeSeasonRollover>;
const RESULT = {
  completedSeasonNumber: 1, newSeasonNumber: 2, stablesArchived: 81, robotsArchived: 809, snapshotRows: 0, accoladeRows: 0,
  generatedStablesDeleted: 120, totalRowsPurged: 5, durations: { archiveMs: 1, purgeMs: 1, postMs: 1, totalMs: 3 },
};

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  mockActiveJobs.length = 0;
  mockHoldLock = false;
  mockInProgress = false;
  releaseLock = null;
  execute.mockResolvedValue(RESULT);
});

describe('startAdminRollover', () => {
  it('records a queued manual run, returns at once and executes under the lock with the expected season', async () => {
    mockHoldLock = true;
    const run = await startAdminRollover(5, 1);

    expect(run).toMatchObject({ runId: 41, jobName: 'seasonRollover' });
    expect(recordQueued).toHaveBeenCalledWith(expect.objectContaining({
      jobName: 'seasonRollover',
      trigger: 'manual',
      triggeredByUserId: 5,
      // The target season is on the queued row from the start.
      summary: { rollover: expect.objectContaining({ seasonNumber: 1, newSeasonNumber: null, result: null }) },
    }));
    await flush();
    expect(mockRunExclusive).toHaveBeenCalledWith('seasonRollover', expect.any(Function));
    // Waiting behind the lock: queued, and a second start is refused.
    expect(getQueuedAdminRollover()).toMatchObject({ runId: 41, adminUserId: 5, seasonNumber: 1 });
    expect(isRolloverActive()).toBe(true);
    await expect(startAdminRollover(5, 1)).rejects.toMatchObject({ code: 'ROLLOVER_IN_PROGRESS', statusCode: 409 });

    releaseLock?.();
    await flush();
    await flush();
    expect(execute).toHaveBeenCalledWith({ trigger: 'admin', adminUserId: 5, runId: 41, expectedSeasonNumber: 1 });
    expect(getQueuedAdminRollover()).toBeNull();
    expect(recordAction).toHaveBeenCalledWith(5, 'season_rollover', 'success', expect.objectContaining({ newSeasonNumber: 2 }));
    expect(isRolloverActive()).toBe(false);
  });

  it('is refused while a settlement-triggered rollover executes', async () => {
    mockInProgress = true;
    await expect(startAdminRollover(5, 1)).rejects.toMatchObject({ code: 'ROLLOVER_IN_PROGRESS' });
    expect(recordQueued).not.toHaveBeenCalled();
  });

  it('audits a background failure without throwing to the caller', async () => {
    execute.mockRejectedValue(new Error('statement timeout'));
    await startAdminRollover(5, 1);
    await flush();
    await flush();
    expect(recordAction).toHaveBeenCalledWith(5, 'season_rollover', 'failure', { seasonNumber: 1, error: 'statement timeout' });
    expect(isRolloverActive()).toBe(false);
  });
});

describe('runAdminRollover', () => {
  it('waits for the result under the lock', async () => {
    await expect(runAdminRollover(5, 1)).resolves.toEqual(RESULT);
    expect(mockRunExclusive).toHaveBeenCalledWith('seasonRollover', expect.any(Function));
  });

  it('rethrows a failure after auditing it', async () => {
    execute.mockRejectedValue(new Error('boom'));
    await expect(runAdminRollover(5, 1)).rejects.toThrow('boom');
    expect(recordAction).toHaveBeenCalledWith(5, 'season_rollover', 'failure', { seasonNumber: 1, error: 'boom' });
  });
});
