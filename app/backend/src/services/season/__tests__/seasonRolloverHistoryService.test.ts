/**
 * Season Control's rollover history: runs and legacy audit rows merged per
 * season, failed attempts folded under the season they tried to close.
 */
jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    season: { findFirst: jest.fn() },
    schedulerJobRun: { findMany: jest.fn() },
    adminAuditLog: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));
jest.mock('../seasonQueryService', () => ({ __esModule: true, listSeasonsForBrowsing: jest.fn() }));

import prisma from '../../../lib/prisma';
import { listSeasonsForBrowsing } from '../seasonQueryService';
import { getSeasonRolloverHistory } from '../seasonRolloverHistoryService';
import { ROLLOVER_STAGES } from '../../../types/schedulerTypes';

const at = (iso: string): Date => new Date(iso);
const db = prisma as unknown as {
  season: { findFirst: jest.Mock };
  schedulerJobRun: { findMany: jest.Mock };
  adminAuditLog: { findMany: jest.Mock };
  user: { findMany: jest.Mock };
};

const stages = (failed: string | null) => ROLLOVER_STAGES.map((stage) => ({
  stage,
  status: failed === null ? 'done' : stage === failed ? 'failed' : ROLLOVER_STAGES.indexOf(stage) < ROLLOVER_STAGES.indexOf(failed as never) ? 'done' : 'pending',
  startedAt: null,
  finishedAt: null,
  detail: null,
}));

beforeEach(() => {
  jest.clearAllMocks();
  (listSeasonsForBrowsing as jest.Mock).mockResolvedValue([
    { seasonNumber: 1, isLegacy: false, competitiveCycles: 100, startedAt: at('2026-08-01T00:00:00Z'), endedAt: at('2026-11-10T00:03:00Z'), humanStableCount: 85, generatedStableCount: 3400 },
    { seasonNumber: 0, isLegacy: true, competitiveCycles: 122, startedAt: at('2026-03-01T00:00:00Z'), endedAt: at('2026-07-29T14:33:00Z'), humanStableCount: 81, generatedStableCount: 200 },
  ]);
  db.season.findFirst.mockResolvedValue({ seasonNumber: 2, startedAt: at('2026-11-10T00:03:00Z') });
  db.user.findMany.mockResolvedValue([{ id: 1, username: 'robert' }]);
});

it('merges runs with the audit rows older than the first run, per season, newest first', async () => {
  db.schedulerJobRun.findMany.mockResolvedValue([
    // A failed admin attempt on season 2 (current), a running one (excluded), the settlement rollover of season 1, and an earlier failed attempt on it.
    { id: 9, trigger: 'manual', triggeredByUserId: 1, status: 'running', queuedAt: at('2026-11-12T10:00:00Z'), startedAt: at('2026-11-12T10:00:00Z'), durationMs: null, summary: null, error: null },
    { id: 8, trigger: 'manual', triggeredByUserId: 1, status: 'failed', queuedAt: at('2026-11-11T10:00:00Z'), startedAt: at('2026-11-11T10:00:00Z'), durationMs: 900, summary: null, error: 'Season 1 is no longer current' },
    { id: 7, trigger: 'cron', triggeredByUserId: null, status: 'success', queuedAt: at('2026-11-10T00:01:00Z'), startedAt: at('2026-11-10T00:01:00Z'), durationMs: 120_000, summary: { rollover: { seasonNumber: 1, newSeasonNumber: 2, stages: stages(null), generatedStables: null, result: { stablesArchived: 85, robotsArchived: 900, snapshotRows: 1, accoladeRows: 1, generatedStablesDeleted: 3400, totalRowsPurged: 10, durations: { archiveMs: 1, purgeMs: 1, postMs: 1, totalMs: 120_000 } } } }, error: null },
    { id: 6, trigger: 'manual', triggeredByUserId: 1, status: 'interrupted', queuedAt: at('2026-11-09T12:00:00Z'), startedAt: at('2026-11-09T12:00:00Z'), durationMs: 5_000, summary: { rollover: { seasonNumber: 1, newSeasonNumber: null, stages: stages('purge'), generatedStables: { deleted: 50, total: 3400 }, result: null } }, error: 'The backend stopped before the run finished' },
  ]);
  db.adminAuditLog.findMany.mockResolvedValue([
    { id: 31, adminUserId: 1, operationResult: 'success', createdAt: at('2026-07-29T14:33:05Z'), resultSummary: { completedSeasonNumber: 0, newSeasonNumber: 1, stablesArchived: 81, robotsArchived: 809, snapshotRows: 3650, accoladeRows: 304, generatedStablesDeleted: 200, totalRowsPurged: 2125614, durations: { archiveMs: 68, purgeMs: 1303, postMs: 473, totalMs: 2289 } } },
    { id: 30, adminUserId: 1, operationResult: 'failure', createdAt: at('2026-07-29T13:00:00Z'), resultSummary: { seasonNumber: 0, error: 'prisma is not defined' } },
  ]);

  const history = await getSeasonRolloverHistory();

  // Only audit rows from before the first run are read.
  expect(db.adminAuditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { operationType: 'season_rollover', createdAt: { lt: at('2026-11-09T12:00:00Z') } },
  }));

  const [season1, season0] = history.seasons;
  expect(season1.rollover).toMatchObject({ source: 'run', id: 7, trigger: 'cron', durationMs: 120_000, result: { generatedStablesDeleted: 3400 } });
  expect(season1.failedAttempts).toEqual([expect.objectContaining({ id: 6, status: 'interrupted', failedStage: 'purge', triggeredBy: { userId: 1, username: 'robert' } })]);

  expect(season0.rollover).toMatchObject({ source: 'audit', id: 31, trigger: 'manual', durationMs: 2289, result: { totalRowsPurged: 2125614, durations: { archiveMs: 68 } } });
  expect(season0.failedAttempts).toEqual([expect.objectContaining({ source: 'audit', id: 30, status: 'failed', error: 'prisma is not defined', failedStage: null })]);

  // A failure without a summary is placed by time: season 2 was current.
  expect(history.currentSeasonAttempts).toEqual([expect.objectContaining({ id: 8, error: 'Season 1 is no longer current' })]);
});

it('reads every audit row when no run was ever recorded, and copes with missing fields', async () => {
  db.schedulerJobRun.findMany.mockResolvedValue([]);
  db.adminAuditLog.findMany.mockResolvedValue([
    { id: 31, adminUserId: 4, operationResult: 'success', createdAt: at('2026-07-29T14:33:05Z'), resultSummary: { completedSeasonNumber: 0 } },
  ]);
  db.user.findMany.mockResolvedValue([]);

  const history = await getSeasonRolloverHistory();

  expect(db.adminAuditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { operationType: 'season_rollover' } }));
  expect(history.seasons[1].rollover).toMatchObject({ durationMs: null, triggeredBy: { userId: 4, username: null }, result: { stablesArchived: 0 } });
  expect(history.seasons[0].rollover).toBeNull();
  expect(history.currentSeasonAttempts).toEqual([]);
});
