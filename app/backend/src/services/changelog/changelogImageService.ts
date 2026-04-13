/**
 * Changelog image service — handles image processing and storage for changelog entries.
 *
 * Resizes images to max 800px width (maintaining aspect ratio), converts to WebP,
 * and stores in uploads/changelog/ with UUID filenames.
 *
 * Adapted from the robot imageProcessingService + fileStorageService patterns,
 * but uses a flat directory (not per-user) and preserves aspect ratio instead of cropping.
 *
 * @module services/changelog/changelogImageService
 */

import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import logger from '../../config/logger';

const BACKEND_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_UPLOAD_DIR = path.join(BACKEND_ROOT, 'uploads', 'changelog');
const UPLOAD_URL_PREFIX = '/uploads/changelog';

/** Overridable upload directory — allows tests to inject a temp directory. */
let uploadDir = DEFAULT_UPLOAD_DIR;

/** Set a custom upload directory (for testing). */
export function setUploadDir(dir: string): void {
  uploadDir = dir;
}

/** Reset upload directory to the default (for testing teardown). */
export function resetUploadDir(): void {
  uploadDir = DEFAULT_UPLOAD_DIR;
}

/**
 * Process an image buffer (resize to max 800px width, convert to WebP)
 * and store it in the upload directory as {uuid}.webp.
 *
 * Creates the directory if it doesn't exist.
 *
 * @returns The relative URL path for database storage (e.g. /uploads/changelog/abc-123.webp)
 */
export async function processAndStore(buffer: Buffer): Promise<string> {
  await fs.mkdir(uploadDir, { recursive: true });

  const processed = await sharp(buffer)
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const filename = `${randomUUID()}.webp`;
  const filePath = path.join(uploadDir, filename);
  await fs.writeFile(filePath, processed);

  return `${UPLOAD_URL_PREFIX}/${filename}`;
}

/**
 * Delete an image file from disk given its relative URL path.
 * Logs errors but does not throw — deletion failures are non-fatal.
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  try {
    // Validate the imageUrl matches the expected pattern to prevent path traversal
    const safePattern = /^\/uploads\/changelog\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;
    if (!safePattern.test(imageUrl)) {
      logger.error(`Refusing to delete changelog image with unsafe path: ${imageUrl}`);
      return;
    }
    const filename = path.basename(imageUrl);
    const absolutePath = path.join(uploadDir, filename);
    await fs.unlink(absolutePath);
  } catch (error) {
    logger.error(
      `Failed to delete changelog image at ${imageUrl}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
