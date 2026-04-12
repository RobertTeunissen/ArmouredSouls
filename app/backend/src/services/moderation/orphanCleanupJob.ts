import { fileStorageService } from './fileStorageService';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import type { OrphanCleanupResult } from './fileStorageService';

/**
 * Run orphan cleanup: query all Robot.imageUrl values starting with '/uploads/',
 * build a referenced set, then delegate to fileStorageService.cleanupOrphans()
 * to delete unreferenced files.
 *
 * Integrated as Step 15 in adminCycleService.executeBulkCycles and available
 * on-demand via POST /api/admin/uploads/cleanup.
 */
export async function runOrphanCleanup(): Promise<OrphanCleanupResult> {
  logger.info('[OrphanCleanup] Starting orphan image cleanup...');

  const robots = await prisma.robot.findMany({
    where: { imageUrl: { startsWith: '/uploads/' } },
    select: { imageUrl: true },
  });

  const referencedUrls = new Set<string>(
    robots.map((r) => r.imageUrl).filter((url): url is string => url !== null)
  );

  logger.info(`[OrphanCleanup] Found ${referencedUrls.size} referenced upload URLs in database`);

  const result = await fileStorageService.cleanupOrphans(referencedUrls);

  logger.info(
    `[OrphanCleanup] Cleanup complete: ${result.filesDeleted} files deleted, ${result.bytesReclaimed} bytes reclaimed, ${result.errors.length} errors`
  );

  return result;
}
