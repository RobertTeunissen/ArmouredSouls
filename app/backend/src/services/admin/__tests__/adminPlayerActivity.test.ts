/**
 * Unit tests for the dashboard human-player counts, KPI snapshots and the
 * one-decimal percentage helper.
 */
const mockUserCount = jest.fn();
const mockSnapshotUpsert = jest.fn();
const mockSnapshotFindFirst = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { count: (...args: unknown[]) => mockUserCount(...args) },
    adminKpiSnapshot: {
      upsert: (...args: unknown[]) => mockSnapshotUpsert(...args),
      findFirst: (...args: unknown[]) => mockSnapshotFindFirst(...args),
    },
  },
}));
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: (...args: unknown[]) => mockLoggerError(...args), debug: jest.fn() },
}));

import { buildUserFilter } from '../../../utils/buildUserFilter';
import { buildHumanActivityWhere, countHumanPlayerActivity } from '../adminPlayerActivityService';
import { findPreviousKpiSnapshot, recordKpiSnapshot, recordKpiSnapshotNonFatal } from '../adminKpiSnapshotService';
import { percentageOneDecimal } from '../adminDashboardService';

const NOW = new Date('2026-10-22T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number): Date => new Date(NOW.getTime() - ms);

describe('buildHumanActivityWhere', () => {
  const where = buildHumanActivityWhere(NOW);
  const human = buildUserFilter('real');

  it('scopes every count to human stables', () => {
    expect(where.total).toEqual(human);
    for (const key of ['active7d', 'new7d', 'newPrevious7d', 'inactive3d'] as const) {
      expect((where[key].AND as unknown[])[0]).toEqual(human);
    }
  });

  it('uses inclusive 7-day windows for active and new players', () => {
    expect((where.active7d.AND as unknown[])[1]).toEqual({ lastLoginAt: { gte: ago(7 * DAY) } });
    expect((where.new7d.AND as unknown[])[1]).toEqual({ createdAt: { gte: ago(7 * DAY) } });
  });

  it('uses the half-open previous window [now − 14d, now − 7d) for new players', () => {
    expect((where.newPrevious7d.AND as unknown[])[1]).toEqual({ createdAt: { gte: ago(14 * DAY), lt: ago(7 * DAY) } });
  });

  it('counts never-logged-in players as inactive by registration date', () => {
    expect((where.inactive3d.AND as unknown[])[1]).toEqual({
      OR: [
        { lastLoginAt: { lt: ago(3 * DAY) } },
        { lastLoginAt: null, createdAt: { lt: ago(3 * DAY) } },
      ],
    });
  });
});

describe('countHumanPlayerActivity', () => {
  it('maps the five counts in order', async () => {
    mockUserCount.mockReset()
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(38)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(9);

    await expect(countHumanPlayerActivity(NOW)).resolves.toEqual({
      total: 50, active7d: 38, new7d: 5, newPrevious7d: 7, inactive3d: 9,
    });
  });
});

describe('KPI snapshots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserCount.mockResolvedValue(4);
  });

  it('upserts one row per season and cycle', async () => {
    await recordKpiSnapshot(2, 40, NOW);

    expect(mockSnapshotUpsert).toHaveBeenCalledWith({
      where: { seasonNumber_cycleNumber: { seasonNumber: 2, cycleNumber: 40 } },
      create: { seasonNumber: 2, cycleNumber: 40, humanPlayers: 4, activePlayers7d: 4, inactivePlayers3d: 4, createdAt: NOW },
      update: { humanPlayers: 4, activePlayers7d: 4, inactivePlayers3d: 4, createdAt: NOW },
    });
  });

  it('never throws from the settlement wrapper', async () => {
    mockSnapshotUpsert.mockRejectedValue(new Error('table missing'));

    await expect(recordKpiSnapshotNonFatal(2, 40)).resolves.toBeUndefined();
    expect(mockLoggerError).toHaveBeenCalledWith(expect.stringContaining('table missing'));
  });

  it('looks up the snapshot between 8 days and 7 days − 1 h ago, newest first', async () => {
    mockSnapshotFindFirst.mockResolvedValue({ activePlayers7d: 30, inactivePlayers3d: 6, createdAt: ago(7 * DAY) });

    await expect(findPreviousKpiSnapshot(NOW)).resolves.toEqual({
      activePlayers7d: 30, inactivePlayers3d: 6, capturedAt: ago(7 * DAY),
    });
    expect(mockSnapshotFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { createdAt: { lte: new Date(ago(7 * DAY).getTime() + 60 * 60 * 1000), gte: ago(8 * DAY) } },
      orderBy: { createdAt: 'desc' },
    }));
  });

  it('returns null when no snapshot is old enough', async () => {
    mockSnapshotFindFirst.mockResolvedValue(null);
    await expect(findPreviousKpiSnapshot(NOW)).resolves.toBeNull();
  });
});

describe('percentageOneDecimal', () => {
  it('rounds to one decimal and is 0 for an empty population', () => {
    expect(percentageOneDecimal(124, 144)).toBe(86.1);
    expect(percentageOneDecimal(0, 0)).toBe(0);
    expect(percentageOneDecimal(3, 3)).toBe(100);
  });
});
