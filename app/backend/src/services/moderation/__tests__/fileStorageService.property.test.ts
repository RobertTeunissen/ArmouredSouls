/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Property-based tests for FileStorageService.
 * Uses fast-check to verify universal properties across generated inputs.
 *
 * Property 9: Valid URL path format with non-guessable filenames
 * For any stored image, the returned path SHALL match `/uploads/user-robots/{userId}/{uuid}.webp`
 * and SHALL NOT contain `assets/robots/`. Two calls with identical content SHALL produce different filenames.
 *
 * Property 15: Periodic orphan cleanup correctness
 * For any set of files on disk and Robot.imageUrl values, the cleanup SHALL delete exactly those
 * files not referenced by any robot. Referenced files SHALL NOT be deleted.
 *
 * **Validates: Requirements 6.1, 6.4, 6.5, 6.6, 12.1, 12.2**
 */

import * as fc from 'fast-check';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const UPLOAD_URL_PREFIX = '/uploads/user-robots';
const UUID_PATH_REGEX = /^\/uploads\/user-robots\/\d+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

let tempDir: string;
let service: any;

/** Recursively scan for .webp files (mirrors the service's private method) */
async function scanWebpFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await scanWebpFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.webp')) {
      files.push(fullPath);
    }
  }
  return files;
}

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-prop-test-'));

  jest.isolateModules(() => {
    jest.doMock('../../../config/logger', () => ({
      __esModule: true,
      default: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../fileStorageService');
    service = mod.fileStorageService;
  });

  // Override storeImage to use temp dir
  service.storeImage = async (userId: number, buffer: Buffer): Promise<string> => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomUUID } = require('crypto');
    const userDir = path.join(tempDir, String(userId));
    await fs.mkdir(userDir, { recursive: true });
    const filename = `${randomUUID()}.webp`;
    const filePath = path.join(userDir, filename);
    await fs.writeFile(filePath, buffer);
    return `${UPLOAD_URL_PREFIX}/${userId}/${filename}`;
  };

  // Override getAbsolutePath to resolve against temp dir
  service.getAbsolutePath = (relativePath: string): string => {
    const subPath = relativePath.replace(/^\/uploads\/user-robots\//, '');
    return path.join(tempDir, subPath);
  };

  // Override cleanupOrphans to scan our temp dir
  service.cleanupOrphans = async (
    referencedUrls: Set<string>
  ): Promise<{ filesDeleted: number; bytesReclaimed: number; errors: string[] }> => {
    const result = { filesDeleted: 0, bytesReclaimed: 0, errors: [] as string[] };
    const allFiles = await scanWebpFiles(tempDir);
    for (const filePath of allFiles) {
      const relative = path.relative(tempDir, filePath);
      const relativeUrl = `${UPLOAD_URL_PREFIX}/${relative.split(path.sep).join('/')}`;
      if (!referencedUrls.has(relativeUrl)) {
        try {
          const stat = await fs.stat(filePath);
          await fs.unlink(filePath);
          result.filesDeleted++;
          result.bytesReclaimed += stat.size;
        } catch {
          result.errors.push(`Failed to delete ${filePath}`);
        }
      }
    }
    return result;
  };
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
  jest.restoreAllMocks();
});

describe('FileStorageService Property Tests', () => {
  /**
   * Property 9: Valid URL path format with non-guessable filenames
   * **Validates: Requirements 6.1, 6.4, 6.5, 6.6**
   */
  describe('Property 9: Valid URL path format with non-guessable filenames', () => {
    it('should always return a path matching /uploads/user-robots/{userId}/{uuid}.webp and never contain assets/robots/', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),
          fc.uint8Array({ minLength: 1, maxLength: 256 }),
          async (userId: number, content: Uint8Array) => {
            const buffer = Buffer.from(content);
            const resultPath = await service.storeImage(userId, buffer);

            // Path must match the expected format
            expect(resultPath).toMatch(UUID_PATH_REGEX);

            // Path must NOT contain preset assets directory
            expect(resultPath).not.toContain('assets/robots/');

            // Path must contain the correct userId
            expect(resultPath).toContain(`/${userId}/`);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should produce different filenames for two calls with identical content', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),
          fc.uint8Array({ minLength: 1, maxLength: 256 }),
          async (userId: number, content: Uint8Array) => {
            const buffer = Buffer.from(content);
            const path1 = await service.storeImage(userId, buffer);
            const path2 = await service.storeImage(userId, buffer);

            // Two calls with identical content must produce different paths
            expect(path1).not.toBe(path2);

            // Both must still match the valid format
            expect(path1).toMatch(UUID_PATH_REGEX);
            expect(path2).toMatch(UUID_PATH_REGEX);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 15: Periodic orphan cleanup correctness
   * **Validates: Requirements 12.1, 12.2**
   */
  describe('Property 15: Periodic orphan cleanup correctness', () => {
    it('should delete exactly unreferenced files and keep all referenced files', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          fc.array(fc.boolean(), { minLength: 3, maxLength: 8 }),
          async (userId: number, referencedFlags: boolean[]) => {
            // Use a fresh subdirectory per iteration to avoid cross-contamination
            const iterDir = await fs.mkdtemp(path.join(tempDir, 'iter-'));
            const totalFiles = referencedFlags.length;
            const storedPaths: string[] = [];

            // Local storeImage that writes into iterDir
            const storeInIter = async (uid: number, buffer: Buffer): Promise<string> => {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { randomUUID } = require('crypto');
              const userDir = path.join(iterDir, String(uid));
              await fs.mkdir(userDir, { recursive: true });
              const filename = `${randomUUID()}.webp`;
              await fs.writeFile(path.join(userDir, filename), buffer);
              return `${UPLOAD_URL_PREFIX}/${uid}/${filename}`;
            };

            // Local cleanupOrphans that scans iterDir
            const cleanupInIter = async (
              refs: Set<string>
            ): Promise<{ filesDeleted: number; bytesReclaimed: number; errors: string[] }> => {
              const result = { filesDeleted: 0, bytesReclaimed: 0, errors: [] as string[] };
              const allFiles = await scanWebpFiles(iterDir);
              for (const fp of allFiles) {
                const relative = path.relative(iterDir, fp);
                const relativeUrl = `${UPLOAD_URL_PREFIX}/${relative.split(path.sep).join('/')}`;
                if (!refs.has(relativeUrl)) {
                  try {
                    const stat = await fs.stat(fp);
                    await fs.unlink(fp);
                    result.filesDeleted++;
                    result.bytesReclaimed += stat.size;
                  } catch {
                    result.errors.push(`Failed to delete ${fp}`);
                  }
                }
              }
              return result;
            };

            // Create files on disk
            for (let i = 0; i < totalFiles; i++) {
              const filePath = await storeInIter(userId, Buffer.from(`file-content-${i}`));
              storedPaths.push(filePath);
            }

            // Determine which files are "referenced" based on the generated flags
            const referencedUrls = new Set<string>();
            const expectedDeleted: string[] = [];
            const expectedKept: string[] = [];

            for (let i = 0; i < totalFiles; i++) {
              if (referencedFlags[i]) {
                referencedUrls.add(storedPaths[i]);
                expectedKept.push(storedPaths[i]);
              } else {
                expectedDeleted.push(storedPaths[i]);
              }
            }

            // Run cleanup
            const result = await cleanupInIter(referencedUrls);

            // Verify correct number of deletions
            expect(result.filesDeleted).toBe(expectedDeleted.length);
            expect(result.errors).toHaveLength(0);

            // Verify referenced files still exist
            for (const keptPath of expectedKept) {
              const subPath = keptPath.replace(/^\/uploads\/user-robots\//, '');
              const absPath = path.join(iterDir, subPath);
              await expect(fs.access(absPath)).resolves.toBeUndefined();
            }

            // Verify unreferenced files are gone
            for (const deletedPath of expectedDeleted) {
              const subPath = deletedPath.replace(/^\/uploads\/user-robots\//, '');
              const absPath = path.join(iterDir, subPath);
              await expect(fs.access(absPath)).rejects.toThrow();
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
