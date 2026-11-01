/**
 * Unit tests for the admin Image Uploads service: the weekly chart buckets and
 * the cleanup run (orphan sweep, clearing references to files that are gone,
 * the audit row). Database behaviour is in
 * tests/integration/adminSecurityModeration.test.ts.
 */

const mockRobotFindMany = jest.fn();
const mockArchiveFindMany = jest.fn();
const mockRobotUpdateMany = jest.fn();
const mockArchiveUpdateMany = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    robot: { findMany: (...a: unknown[]) => mockRobotFindMany(...a), updateMany: (...a: unknown[]) => mockRobotUpdateMany(...a) },
    robotSeasonArchive: { findMany: (...a: unknown[]) => mockArchiveFindMany(...a), updateMany: (...a: unknown[]) => mockArchiveUpdateMany(...a) },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));
jest.mock('../../../config/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const mockSweep = jest.fn();
jest.mock('../imageLibraryService', () => ({
  cleanupSeasonOrphans: () => mockSweep(),
  referencedUploadPaths: jest.fn(),
}));
const mockScan = jest.fn();
const mockSync = jest.fn();
jest.mock('../uploadedImageService', () => ({
  scanUploadFiles: () => mockScan(),
  syncUploadedImages: () => mockSync(),
}));
const mockRecordAction = jest.fn();
jest.mock('../../admin/adminAuditLogService', () => ({ recordAction: (...a: unknown[]) => mockRecordAction(...a) }));
jest.mock('../fileStorageService', () => ({ fileStorageService: { deleteImage: jest.fn() } }));
jest.mock('../contentModerationService', () => ({ MODERATION_THRESHOLDS: { porn: 0.3, hentai: 0.3, sexy: 0.5 }, ROBOT_LIKENESS_THRESHOLD: 0.6 }));

import { runCleanup, weeklyBuckets } from '../adminImagesService';

beforeEach(() => {
  jest.clearAllMocks();
  mockSweep.mockResolvedValue({ filesDeleted: 2, bytesReclaimed: 80_000, errors: [] });
  mockScan.mockResolvedValue([{ imageUrl: '/uploads/user-robots/3/live.webp', userId: 3, size: 1, mtime: new Date() }]);
  mockSync.mockResolvedValue({ added: 0, removed: 2 });
  mockRobotFindMany.mockResolvedValue([{ imageUrl: '/uploads/user-robots/3/live.webp' }, { imageUrl: '/uploads/user-robots/3/gone.webp' }]);
  mockArchiveFindMany.mockResolvedValue([{ imageUrl: '/uploads/user-robots/4/old.webp' }, { imageUrl: '/uploads/user-robots/4/old.webp' }]);
  mockRobotUpdateMany.mockReturnValue('robot-update');
  mockArchiveUpdateMany.mockReturnValue('archive-update');
  mockTransaction.mockResolvedValue([{ count: 1 }, { count: 2 }]);
});

describe('weeklyBuckets', () => {
  it('counts uploads per Monday-started week from the season start to now', () => {
    const start = new Date('2026-07-29T14:33:00Z'); // a Wednesday
    const now = new Date('2026-08-12T10:00:00Z');
    const weeks = weeklyBuckets(start, now, [
      new Date('2026-07-29T15:00:00Z'), new Date('2026-08-02T23:59:00Z'), new Date('2026-08-03T00:00:00Z'), new Date('2026-08-11T08:00:00Z'),
    ]);
    expect(weeks).toEqual([
      { start: '2026-07-27T00:00:00.000Z', uploads: 2 },
      { start: '2026-08-03T00:00:00.000Z', uploads: 1 },
      { start: '2026-08-10T00:00:00.000Z', uploads: 1 },
    ]);
  });
});

describe('runCleanup (Clean up button)', () => {
  it('sweeps orphans, clears references whose file is gone, resyncs and audits', async () => {
    const result = await runCleanup(7);

    expect(mockSweep).toHaveBeenCalledTimes(1);
    expect(mockRobotUpdateMany).toHaveBeenCalledWith({
      where: { imageUrl: { in: ['/uploads/user-robots/3/gone.webp', '/uploads/user-robots/4/old.webp'] } },
      data: { imageUrl: null },
    });
    expect(mockArchiveUpdateMany).toHaveBeenCalledWith({
      where: { imageUrl: { in: ['/uploads/user-robots/3/gone.webp', '/uploads/user-robots/4/old.webp'] } },
      data: { imageUrl: null },
    });
    expect(mockSync).toHaveBeenCalled();
    expect(result).toEqual({ filesDeleted: 2, bytesReclaimed: 80_000, referencesCleared: { robots: 1, archived: 2 }, errors: [] });
    expect(mockRecordAction).toHaveBeenCalledWith(7, 'image_cleanup', 'success', {
      filesDeleted: 2, bytesReclaimed: 80_000, referencesCleared: { robots: 1, archived: 2 }, errorCount: 0,
    });
  });

  it('only touches player uploads and leaves references alone when every file exists', async () => {
    mockRobotFindMany.mockResolvedValue([{ imageUrl: '/uploads/user-robots/3/live.webp' }]);
    mockArchiveFindMany.mockResolvedValue([]);
    const result = await runCleanup(7);
    expect(mockRobotFindMany).toHaveBeenCalledWith({ where: { imageUrl: { startsWith: '/uploads/user-robots/' } }, select: { imageUrl: true } });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(result.referencesCleared).toEqual({ robots: 0, archived: 0 });
  });

  it('reports sweep errors without file paths and audits a failure', async () => {
    mockSweep.mockResolvedValue({ filesDeleted: 0, bytesReclaimed: 0, errors: ['Failed to delete orphan /abs/path/x.webp: EPERM'] });
    const result = await runCleanup(7);
    expect(result.errors).toEqual(['A file could not be deleted; see the server log.']);
    expect(mockRecordAction).toHaveBeenCalledWith(7, 'image_cleanup', 'failure', expect.objectContaining({ errorCount: 1 }));
  });
});
