/**
 * Orphan sweep referenced set (Spec #45 R30.3).
 *
 * `cleanupSeasonOrphans` is the only orphan sweep: the season rollover, the
 * admin "Run Orphan Cleanup" button and the bulk cycle runner all call it. The
 * referenced set must keep every file a live robot, an archived season or a
 * live user's Image_Library holds. A sweep built from live robots only deleted
 * retained library images that were not on a current robot.
 */

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    robot: { findMany: jest.fn() },
    robotSeasonArchive: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

let uploadRoot = '';

jest.mock('../fileStorageService', () => ({
  fileStorageService: {
    getAbsolutePath: (relativePath: string): string =>
      path.join(uploadRoot, relativePath.replace(/^\/uploads\/user-robots\//, '')),
    cleanupOrphans: jest.fn(async () => ({ filesDeleted: 0, bytesReclaimed: 0, errors: [] })),
  },
}));

import prisma from '../../../lib/prisma';
import { fileStorageService } from '../fileStorageService';
import { cleanupSeasonOrphans } from '../imageLibraryService';

const mockPrisma = prisma as unknown as {
  robot: { findMany: jest.Mock };
  robotSeasonArchive: { findMany: jest.Mock };
  user: { findMany: jest.Mock };
};
const mockCleanup = fileStorageService.cleanupOrphans as jest.Mock;

const LIVE = '/uploads/user-robots/5/live.webp';
const KEPT = '/uploads/user-robots/5/kept.webp';
const ARCHIVED = '/uploads/user-robots/7/archived.webp';

async function writeUpload(relativePath: string): Promise<void> {
  const absolute = path.join(uploadRoot, relativePath.replace(/^\/uploads\/user-robots\//, ''));
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, 'webp');
}

/** Sweep queries filter on `imageUrl: { not: null }`; library queries filter on a path list. */
function isSweepQuery(args: { where?: { imageUrl?: unknown } }): boolean {
  const filter = args.where?.imageUrl as { not?: unknown } | undefined;
  return filter !== undefined && 'not' in filter;
}

beforeEach(async () => {
  jest.clearAllMocks();
  uploadRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'image-sweep-'));

  // User 5 is live: one image on a robot, one kept in the library only.
  await writeUpload(LIVE);
  await writeUpload(KEPT);
  // User 9 no longer exists; its unreferenced file is a true orphan.
  await writeUpload('/uploads/user-robots/9/gone.webp');

  mockPrisma.user.findMany.mockResolvedValue([{ id: 5 }]);
  mockPrisma.robot.findMany.mockImplementation(async (args: { where?: { imageUrl?: unknown } }) =>
    isSweepQuery(args) ? [{ imageUrl: LIVE }] : [],
  );
  mockPrisma.robotSeasonArchive.findMany.mockImplementation(async (args: { where?: { imageUrl?: unknown } }) =>
    isSweepQuery(args) ? [{ imageUrl: ARCHIVED }] : [],
  );
});

afterEach(async () => {
  await fs.rm(uploadRoot, { recursive: true, force: true });
});

describe('cleanupSeasonOrphans', () => {
  it('keeps live, archived and retained library images and nothing else', async () => {
    await cleanupSeasonOrphans();

    expect(mockCleanup).toHaveBeenCalledTimes(1);
    const referenced = mockCleanup.mock.calls[0][0] as Set<string>;
    expect([...referenced].sort()).toEqual([ARCHIVED, KEPT, LIVE].sort());
  });

  it('keeps a library image that no current robot or archive uses', async () => {
    mockPrisma.robot.findMany.mockResolvedValue([]);
    mockPrisma.robotSeasonArchive.findMany.mockResolvedValue([]);

    await cleanupSeasonOrphans();

    const referenced = mockCleanup.mock.calls[0][0] as Set<string>;
    expect(referenced.has(KEPT)).toBe(true);
    expect(referenced.has(LIVE)).toBe(true);
    expect(referenced.has('/uploads/user-robots/9/gone.webp')).toBe(false);
  });
});
