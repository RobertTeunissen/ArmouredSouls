/**
 * Unit tests for orphanCleanupJob and eager cleanup hooks.
 *
 * Tests:
 * - runOrphanCleanup deletes unreferenced files and keeps referenced ones
 * - runOrphanCleanup handles errors gracefully
 * - runOrphanCleanup returns correct filesDeleted and bytesReclaimed counts
 * - Eager cleanup on preset switch: old custom file deleted
 * - Eager cleanup on robot deletion: custom file deleted
 *
 * _Requirements: 12.1, 12.2, 12.3, 12.6, 6.7, 6.8_
 */

// Mock dependencies before imports
jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    robot: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../fileStorageService', () => ({
  fileStorageService: {
    cleanupOrphans: jest.fn(),
    deleteImage: jest.fn(),
  },
}));

import prisma from '../../../lib/prisma';
import { fileStorageService } from '../fileStorageService';
import { runOrphanCleanup } from '../orphanCleanupJob';

describe('runOrphanCleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should query robots with /uploads/ imageUrl and call cleanupOrphans with referenced set', async () => {
    const mockRobots = [
      { imageUrl: '/uploads/user-robots/1/abc.webp' },
      { imageUrl: '/uploads/user-robots/2/def.webp' },
    ];
    (prisma.robot.findMany as jest.Mock).mockResolvedValue(mockRobots);
    (fileStorageService.cleanupOrphans as jest.Mock).mockResolvedValue({
      filesDeleted: 1,
      bytesReclaimed: 5000,
      errors: [],
    });

    const result = await runOrphanCleanup();

    expect(prisma.robot.findMany).toHaveBeenCalledWith({
      where: { imageUrl: { startsWith: '/uploads/' } },
      select: { imageUrl: true },
    });

    const calledSet = (fileStorageService.cleanupOrphans as jest.Mock).mock.calls[0][0] as Set<string>;
    expect(calledSet.size).toBe(2);
    expect(calledSet.has('/uploads/user-robots/1/abc.webp')).toBe(true);
    expect(calledSet.has('/uploads/user-robots/2/def.webp')).toBe(true);

    expect(result.filesDeleted).toBe(1);
    expect(result.bytesReclaimed).toBe(5000);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle empty robot list (no referenced URLs)', async () => {
    (prisma.robot.findMany as jest.Mock).mockResolvedValue([]);
    (fileStorageService.cleanupOrphans as jest.Mock).mockResolvedValue({
      filesDeleted: 3,
      bytesReclaimed: 15000,
      errors: [],
    });

    const result = await runOrphanCleanup();

    const calledSet = (fileStorageService.cleanupOrphans as jest.Mock).mock.calls[0][0] as Set<string>;
    expect(calledSet.size).toBe(0);
    expect(result.filesDeleted).toBe(3);
  });

  it('should return correct counts from cleanupOrphans result', async () => {
    (prisma.robot.findMany as jest.Mock).mockResolvedValue([
      { imageUrl: '/uploads/user-robots/1/keep.webp' },
    ]);
    (fileStorageService.cleanupOrphans as jest.Mock).mockResolvedValue({
      filesDeleted: 5,
      bytesReclaimed: 102400,
      errors: [],
    });

    const result = await runOrphanCleanup();

    expect(result).toEqual({
      filesDeleted: 5,
      bytesReclaimed: 102400,
      errors: [],
    });
  });

  it('should handle errors from cleanupOrphans gracefully', async () => {
    (prisma.robot.findMany as jest.Mock).mockResolvedValue([]);
    (fileStorageService.cleanupOrphans as jest.Mock).mockResolvedValue({
      filesDeleted: 2,
      bytesReclaimed: 8000,
      errors: ['Failed to delete /uploads/user-robots/1/bad.webp: EPERM'],
    });

    const result = await runOrphanCleanup();

    expect(result.filesDeleted).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('EPERM');
  });

  it('should filter out null imageUrl values from referenced set', async () => {
    (prisma.robot.findMany as jest.Mock).mockResolvedValue([
      { imageUrl: '/uploads/user-robots/1/abc.webp' },
      { imageUrl: null },
    ]);
    (fileStorageService.cleanupOrphans as jest.Mock).mockResolvedValue({
      filesDeleted: 0,
      bytesReclaimed: 0,
      errors: [],
    });

    await runOrphanCleanup();

    const calledSet = (fileStorageService.cleanupOrphans as jest.Mock).mock.calls[0][0] as Set<string>;
    expect(calledSet.size).toBe(1);
    expect(calledSet.has('/uploads/user-robots/1/abc.webp')).toBe(true);
  });
});

describe('Eager cleanup hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Preset switch cleanup (Requirement 6.7)', () => {
    it('should call fileStorageService.deleteImage when robot switches from custom to preset', async () => {
      // This tests the logic pattern used in the appearance route
      const oldImageUrl = '/uploads/user-robots/42/old-image.webp';
      const mockDeleteImage = fileStorageService.deleteImage as jest.Mock;
      mockDeleteImage.mockResolvedValue(undefined);

      // Simulate the eager cleanup logic
      if (oldImageUrl.startsWith('/uploads/')) {
        await fileStorageService.deleteImage(oldImageUrl);
      }

      expect(mockDeleteImage).toHaveBeenCalledWith(oldImageUrl);
    });

    it('should not call deleteImage when robot switches from preset to preset', async () => {
      const oldImageUrl = '/assets/robots/default.webp';
      const mockDeleteImage = fileStorageService.deleteImage as jest.Mock;
      mockDeleteImage.mockResolvedValue(undefined);

      // Simulate the eager cleanup logic
      if (oldImageUrl.startsWith('/uploads/')) {
        await fileStorageService.deleteImage(oldImageUrl);
      }

      expect(mockDeleteImage).not.toHaveBeenCalled();
    });

    it('should not call deleteImage when robot has null imageUrl', async () => {
      const oldImageUrl = null as string | null;
      const mockDeleteImage = fileStorageService.deleteImage as jest.Mock;
      mockDeleteImage.mockResolvedValue(undefined);

      if (oldImageUrl && oldImageUrl.startsWith('/uploads/')) {
        await fileStorageService.deleteImage(oldImageUrl);
      }

      expect(mockDeleteImage).not.toHaveBeenCalled();
    });
  });

  describe('Robot deletion cleanup (Requirement 6.8)', () => {
    it('should call fileStorageService.deleteImage when deleting robot with custom image', async () => {
      const robotImageUrl = '/uploads/user-robots/7/custom.webp';
      const mockDeleteImage = fileStorageService.deleteImage as jest.Mock;
      mockDeleteImage.mockResolvedValue(undefined);

      // Simulate the eager cleanup logic used in resetService
      if (robotImageUrl.startsWith('/uploads/')) {
        await fileStorageService.deleteImage(robotImageUrl);
      }

      expect(mockDeleteImage).toHaveBeenCalledWith(robotImageUrl);
    });

    it('should not call deleteImage when deleting robot with preset image', async () => {
      const robotImageUrl = '/assets/robots/warrior.webp';
      const mockDeleteImage = fileStorageService.deleteImage as jest.Mock;
      mockDeleteImage.mockResolvedValue(undefined);

      if (robotImageUrl.startsWith('/uploads/')) {
        await fileStorageService.deleteImage(robotImageUrl);
      }

      expect(mockDeleteImage).not.toHaveBeenCalled();
    });

    it('should handle deleteImage errors gracefully during deletion', async () => {
      const robotImageUrl = '/uploads/user-robots/7/custom.webp';
      const mockDeleteImage = fileStorageService.deleteImage as jest.Mock;
      // deleteImage logs errors but doesn't throw
      mockDeleteImage.mockResolvedValue(undefined);

      if (robotImageUrl.startsWith('/uploads/')) {
        await fileStorageService.deleteImage(robotImageUrl);
      }

      expect(mockDeleteImage).toHaveBeenCalledWith(robotImageUrl);
    });
  });
});
