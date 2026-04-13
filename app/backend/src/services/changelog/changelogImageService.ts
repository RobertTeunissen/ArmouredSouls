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
const UPLOAD_DIR = path.join(BACKEND_ROOT, 'uploads', 'changelog');
const UPLOAD_URL_PREFIX = '/uploads/changelog';

/**
 * Process an image buffer (resize to max 800px width, convert to WebP)
 * and store it in uploads/changelog/{uuid}.webp.
 *
 * Creates the uploads/changelog/ directory if it doesn't exist.
 *
 * @returns The relative URL path for database storage (e.g. /uploads/changelog/abc-123.webp)
 */
export async function processAndStore(buffer: Buffer): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const processed = await sharp(buffer)
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const filename = `${randomUUID()}.webp`;
  const filePath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(filePath, processed);

  return `${UPLOAD_URL_PREFIX}/${filename}`;
}

/**
 * Delete an image file from disk given its relative URL path.
 * Logs errors but does not throw — deletion failures are non-fatal.
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  try {
    const subPath = imageUrl.replace(/^\/uploads\/changelog\//, '');
    const absolutePath = path.join(UPLOAD_DIR, subPath);
    await fs.unlink(absolutePath);
  } catch (error) {
    logger.error(
      `Failed to delete changelog image at ${imageUrl}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
