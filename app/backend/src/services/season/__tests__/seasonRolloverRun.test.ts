/**
 * executeSeasonRollover as a `seasonRollover` run (Season Control): the run it
 * records, the stage progress it reports, and how it ends on success, on a
 * failed verification and when the season changed while it was queued. Every
 * collaborator is mocked; the real archive and purge are covered by the Heavy
 * seasonRollover suite.
 */
jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: { user: { count: jest.fn() }, seasonStandingSnapshot: { count: jest.fn() }, seasonAccolade: { count: jest.fn() } },
}));
jest.mock('../../../config/logger', () => ({ __esModule: true, default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
jest.mock('../seasonService', () => ({
  __esModule: true,
  getCurrentSeason: jest.fn(),
  completeSeasonAndOpenNext: jest.fn(),
  recordGeneratedStableCount: jest.fn(),
}));
jest.mock('../seasonArchiveService', () => ({
  __esModule: true,
  writeSeasonArchive: jest.fn(),
  verifyArchive: jest.fn(),
  hasCompleteArchive: jest.fn(),
}));
jest.mock('../seasonPurgeService', () => ({
  __esModule: true,
  deleteGeneratedStables: jest.fn(),
  deleteDormantHumanStables: jest.fn(),
  resetCompetitiveAndEconomicState: jest.fn(),
  purgeHistory: jest.fn(),
  reclaimSpace: jest.fn(),
}));
jest.mock('../dormantStables', () => ({ __esModule: true, seasonStartedAt: jest.fn() }));
jest.mock('../../cycle/schedulerRunStore', () => ({
  __esModule: true,
  recordQueued: jest.fn(),
  markRunning: jest.fn(),
  markFinished: jest.fn(),
  updateRunSummary: jest.fn(),
}));
jest.mock('../../../utils/monitoringWebhook', () => ({ __esModule: true, sendMonitoringAlert: jest.fn() }));
jest.mock('../../moderation/imageLibraryService', () => ({ __esModule: true, cleanupSeasonOrphans: jest.fn(async () => ({ filesDeleted: 0, bytesReclaimed: 0 })) }));
jest.mock('../../achievement/preservedStateAchievements', () => ({ __esModule: true, reawardPreservedStateAchievements: jest.fn(async () => ({ achievementsAwarded: 0, stablesChecked: 0 })) }));
jest.mock('../../automaton', () => ({ __esModule: true, runTurnStepNonFatal: jest.fn() }));

import { getCurrentSeason, completeSeasonAndOpenNext } from '../seasonService';
import { writeSeasonArchive, verifyArchive, hasCompleteArchive } from '../seasonArchiveService';
import { seasonStartedAt } from '../dormantStables';
import { deleteGeneratedStables, deleteDormantHumanStables, resetCompetitiveAndEconomicState, purgeHistory, reclaimSpace } from '../seasonPurgeService';
import { markFinished, markRunning, recordQueued, updateRunSummary } from '../../cycle/schedulerRunStore';
import { executeSeasonRollover, getActiveRolloverProgress, isRolloverInProgress } from '../seasonRolloverService';
import type { RolloverRunSummary, SchedulerRunSummary } from '../../../types/schedulerTypes';

const mocked = <T extends (...args: never[]) => unknown>(fn: T): jest.MockedFunction<T> => fn as jest.MockedFunction<T>;

const SEASON = {
  seasonNumber: 1, phase: 'competitive', seasonCycle: 100, seasonLengthCycles: 100, remainingCompetitiveCycles: 0,
  preparationDay: 0, remainingPreparationCycles: 0, isLegacy: false,
};

let progressSeen: Array<ReturnType<typeof getActiveRolloverProgress>> = [];

beforeEach(() => {
  jest.clearAllMocks();
  progressSeen = [];
  mocked(getCurrentSeason).mockResolvedValue(SEASON as never);
  mocked(hasCompleteArchive).mockResolvedValue(false);
  mocked(writeSeasonArchive).mockResolvedValue({ stablesArchived: 81, robotsArchived: 809, snapshotRows: 3650, accoladeRows: 304, generatedStableCount: 120 } as never);
  mocked(verifyArchive).mockResolvedValue({ ok: true, expectedStables: 81, expectedRobots: 809, actualStables: 81, actualRobots: 809 } as never);
  mocked(deleteGeneratedStables).mockImplementation(async (onProgress) => {
    await onProgress?.(0, 120);
    progressSeen.push(getActiveRolloverProgress());
    await onProgress?.(120, 120);
    return 120;
  });
  mocked(seasonStartedAt).mockResolvedValue(new Date('2026-08-01T00:00:00Z'));
  mocked(deleteDormantHumanStables).mockImplementation(async (_startedAt, onProgress) => {
    await onProgress?.(7, 7);
    return 7;
  });
  mocked(resetCompetitiveAndEconomicState).mockResolvedValue({ rowsDeleted: { robots: 900 }, humanStablesReset: 81 });
  mocked(purgeHistory).mockResolvedValue({ battles: 1000 });
  mocked(reclaimSpace).mockResolvedValue(true);
  mocked(completeSeasonAndOpenNext).mockResolvedValue(2);
  mocked(recordQueued).mockResolvedValue(77);
});

function finishedSummary(): RolloverRunSummary {
  const call = mocked(markFinished).mock.calls.at(-1);
  return (call?.[1].summary as SchedulerRunSummary).rollover as RolloverRunSummary;
}

describe('executeSeasonRollover run recording', () => {
  it('records its own cron run from settlement and finishes it with every stage done and the result', async () => {
    const result = await executeSeasonRollover({ trigger: 'settlement' });

    expect(recordQueued).toHaveBeenCalledWith(expect.objectContaining({ jobName: 'seasonRollover', trigger: 'cron', triggeredByUserId: null }));
    expect(markRunning).toHaveBeenCalledWith(77, expect.any(Date));
    expect(mocked(markFinished).mock.calls.at(-1)?.[1]).toMatchObject({ status: 'success' });
    const summary = finishedSummary();
    expect(summary.stages.map((stage) => stage.status)).toEqual(['done', 'done', 'done', 'done', 'done']);
    expect(summary.stages[2].detail).toBe('120 generated and 7 dormant human stables deleted, 1,900 rows purged');
    expect(summary.newSeasonNumber).toBe(2);
    expect(summary.generatedStables).toEqual({ deleted: 120, total: 120 });
    expect(summary.result).toMatchObject({ stablesArchived: 81, robotsArchived: 809, generatedStablesDeleted: 120, dormantStablesDeleted: 7, totalRowsPurged: 1900 });
    expect(deleteDormantHumanStables).toHaveBeenCalledWith(new Date('2026-08-01T00:00:00Z'), expect.any(Function));
    expect(result.totalRowsPurged).toBe(1900);
    // Progress was written while it ran, and is visible in memory only while it runs.
    expect(updateRunSummary).toHaveBeenCalledWith(77, expect.objectContaining({ rollover: expect.any(Object) }));
    expect(progressSeen[0]).toMatchObject({ runId: 77, trigger: 'settlement', progress: { stages: expect.arrayContaining([expect.objectContaining({ stage: 'purge', status: 'running' })]) } });
    expect(getActiveRolloverProgress()).toBeNull();
    expect(isRolloverInProgress()).toBe(false);
  });

  it('uses the run an admin caller recorded and records a manual run otherwise', async () => {
    await executeSeasonRollover({ trigger: 'admin', adminUserId: 5, runId: 12 });
    expect(recordQueued).not.toHaveBeenCalled();
    expect(markRunning).toHaveBeenCalledWith(12, expect.any(Date));

    await executeSeasonRollover({ trigger: 'admin', adminUserId: 5 });
    expect(recordQueued).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'manual', triggeredByUserId: 5 }));
  });

  it('skips verification on an idempotent retry', async () => {
    mocked(hasCompleteArchive).mockResolvedValue(true);
    await executeSeasonRollover({ trigger: 'admin', adminUserId: 5, runId: 12 });
    const summary = finishedSummary();
    expect(summary.stages[0].detail).toBe('Already archived (retry): 81 stables, 809 robots');
    expect(summary.stages[1]).toMatchObject({ status: 'skipped' });
  });

  it('fails the run at the verify stage and deletes nothing when the counts do not match', async () => {
    mocked(verifyArchive).mockResolvedValue({ ok: false, expectedStables: 81, expectedRobots: 135, actualStables: 81, actualRobots: 269 } as never);

    await expect(executeSeasonRollover({ trigger: 'admin', adminUserId: 5, runId: 12 })).rejects.toMatchObject({ code: 'ARCHIVE_VERIFICATION_FAILED' });

    expect(deleteGeneratedStables).not.toHaveBeenCalled();
    const finished = mocked(markFinished).mock.calls.at(-1)?.[1];
    expect(finished).toMatchObject({ status: 'failed', error: expect.stringContaining('expected 81 stables / 135 robots') });
    const summary = finishedSummary();
    expect(summary.stages.map((stage) => stage.status)).toEqual(['done', 'failed', 'pending', 'pending', 'pending']);
    expect(isRolloverInProgress()).toBe(false);
  });

  it('refuses a season that changed while it was queued, and changes nothing', async () => {
    await expect(executeSeasonRollover({ trigger: 'admin', adminUserId: 5, runId: 12, expectedSeasonNumber: 0 }))
      .rejects.toMatchObject({ code: 'SEASON_NUMBER_MISMATCH', statusCode: 409 });
    expect(writeSeasonArchive).not.toHaveBeenCalled();
    // Kept on the season it targeted, with no stage marked, so the history files it under Season 0.
    const finished = mocked(markFinished).mock.calls.at(-1)?.[1];
    expect(finished).toMatchObject({ status: 'failed', error: expect.stringContaining('Season 0 is no longer current') });
    const summary = (finished?.summary as SchedulerRunSummary).rollover as RolloverRunSummary;
    expect(summary).toMatchObject({ seasonNumber: 0, newSeasonNumber: null, result: null });
    expect(summary.stages.every((stage) => stage.status === 'pending')).toBe(true);
  });

  it('rejects a second rollover while one runs and closes the run the caller recorded', async () => {
    let release: () => void = () => undefined;
    mocked(writeSeasonArchive).mockImplementation(() => new Promise((resolve) => {
      release = () => resolve({ stablesArchived: 1, robotsArchived: 1, snapshotRows: 0, accoladeRows: 0, generatedStableCount: 0 } as never);
    }));
    const first = executeSeasonRollover({ trigger: 'settlement' });
    await new Promise((resolve) => setImmediate(resolve));

    await expect(executeSeasonRollover({ trigger: 'admin', adminUserId: 5, runId: 99 })).rejects.toMatchObject({ code: 'ROLLOVER_IN_PROGRESS', statusCode: 409 });
    expect(markFinished).toHaveBeenCalledWith(99, expect.objectContaining({ status: 'failed', error: 'A season rollover is already running' }));

    release();
    await first;
  });
});
