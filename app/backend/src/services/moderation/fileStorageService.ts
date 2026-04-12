import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import logger from '../../config/logger';

export interface OrphanCleanupResult {
  filesDeleted: number;
  bytesReclaimed: number;
  errors: string[];
}

const BACKEND_ROOT = path.resolve(__dirname, '../../..');
const UPLOAD_BASE_DIR = path.join(BACKEND_ROOT, 'uploads', 'user-robots');
const UPLOAD_URL_PREFIX = '/uploads/user-robots';

class FileStorageService {
  /**
   * Store a processed image buffer to disk under uploads/user-robots/{userId}/{uuid}.webp.
   * Creates the user directory if it doesn't exist.
   * Returns the relative URL path for database storage.
   */
  async storeImage(userId: number, buffer: Buffer): Promise<string> {
    const userDir = path.join(UPLOAD_BASE_DIR, String(userId));
    await fs.mkdir(userDir, { recursive: true });

    const filename = `${randomUUID()}.webp`;
    const filePath = path.join(userDir, filename);
    await fs.writeFile(filePath, buffer);

    return `${UPLOAD_URL_PREFIX}/${userId}/${filename}`;
  }

  /**
   * Delete an image file from disk given its relative URL path.
   * Logs errors but does not throw — deletion failures are non-fatal.
   */
  async deleteImage(relativePath: string): Promise<void> {
    try {
      const absolutePath = this.getAbsolutePath(relativePath);
      await fs.unlink(absolutePath);
    } catch (error) {
      logger.error(`Failed to delete image at ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Resolve a relative URL path (e.g. /uploads/user-robots/42/abc.webp)
   * to an absolute filesystem path.
   */
  getAbsolutePath(relativePath: string): string {
    // Strip leading /uploads/user-robots/ to get the sub-path, then join with UPLOAD_BASE_DIR
    const subPath = relativePath.replace(/^\/uploads\/user-robots\//, '');
    return path.join(UPLOAD_BASE_DIR, subPath);
  }

  /**
   * Scan uploads/user-robots/ for all .webp files and delete any not in the referenced set.
   * Returns counts of deleted files and bytes reclaimed.
   */
  async cleanupOrphans(referencedUrls: Set<string>): Promise<OrphanCleanupResult> {
    const result: OrphanCleanupResult = {
      filesDeleted: 0,
      bytesReclaimed: 0,
      errors: [],
    };

    try {
      const allFiles = await this.scanWebpFiles(UPLOAD_BASE_DIR);

      for (const filePath of allFiles) {
        const relativeUrl = this.toRelativeUrl(filePath);

        if (!referencedUrls.has(relativeUrl)) {
          try {
            const stat = await fs.stat(filePath);
            await fs.unlink(filePath);
            result.filesDeleted++;
            result.bytesReclaimed += stat.size;
          } catch (error) {
            const message = `Failed to delete orphan ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
            logger.error(message);
            result.errors.push(message);
          }
        }
      }
    } catch (error) {
      const message = `Failed to scan upload directory: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(message);
      result.errors.push(message);
    }

    return result;
  }

  /**
   * Recursively scan a directory for all .webp files.
   */
  private async scanWebpFiles(dir: string): Promise<string[]> {
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
        const subFiles = await this.scanWebpFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.webp')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Convert an absolute filesystem path to a relative URL path.
   */
  private toRelativeUrl(absolutePath: string): string {
    const relative = path.relative(UPLOAD_BASE_DIR, absolutePath);
    return `${UPLOAD_URL_PREFIX}/${relative.split(path.sep).join('/')}`;
  }
}

export const fileStorageService = new FileStorageService();
