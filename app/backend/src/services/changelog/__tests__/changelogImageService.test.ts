/**
 * Unit tests for ChangelogImageService.
 *
 * Tests the real processAndStore and deleteImage functions using an
 * injectable temp directory for isolation.
 *
 * _Requirements: 6.10, 7.2, 7.3, 7.4, 7.5_
 */

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import {
  processAndStore,
  deleteImage,
  setUploadDir,
  resetUploadDir,
} from '../changelogImageService';

const UUID_WEBP_REGEX =
  /^\/uploads\/changelog\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

let tempDir: string;

/** Create a real image buffer of given dimensions and format via sharp. */
async function createImageBuffer(
  width: number,
  height: number,
  format: 'jpeg' | 'png' | 'webp',
): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3, 128);
  let pipeline = sharp(raw, { raw: { width, height, channels: 3 } });
  if (format === 'jpeg') pipeline = pipeline.jpeg({ quality: 50 });
  else if (format === 'png') pipeline = pipeline.png();
  else pipeline = pipeline.webp({ quality: 50 });
  return pipeline.toBuffer();
}

/** Resolve a URL path to the temp directory filesystem path. */
function resolveUrl(url: string): string {
  const filename = path.basename(url);
  return path.join(tempDir, filename);
}

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'changelog-img-test-'));
  setUploadDir(tempDir);
});

afterEach(async () => {
  resetUploadDir();
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('ChangelogImageService', () => {
  describe('processAndStore', () => {
    it('should produce WebP output from a JPEG input', async () => {
      const input = await createImageBuffer(1200, 800, 'jpeg');
      const resultUrl = await processAndStore(input);

      const fileBuffer = await fs.readFile(resolveUrl(resultUrl));
      const meta = await sharp(fileBuffer).metadata();
      expect(meta.format).toBe('webp');
    });

    it('should produce WebP output from a PNG input', async () => {
      const input = await createImageBuffer(600, 400, 'png');
      const resultUrl = await processAndStore(input);

      const fileBuffer = await fs.readFile(resolveUrl(resultUrl));
      const meta = await sharp(fileBuffer).metadata();
      expect(meta.format).toBe('webp');
    });

    it('should return URL matching /uploads/changelog/{uuid}.webp', async () => {
      const input = await createImageBuffer(400, 300, 'jpeg');
      const resultUrl = await processAndStore(input);

      expect(resultUrl).toMatch(UUID_WEBP_REGEX);
      await expect(fs.access(resolveUrl(resultUrl))).resolves.toBeUndefined();
    });

    it('should resize wide images to max 800px width', async () => {
      const input = await createImageBuffer(1600, 900, 'jpeg');
      const resultUrl = await processAndStore(input);

      const fileBuffer = await fs.readFile(resolveUrl(resultUrl));
      const meta = await sharp(fileBuffer).metadata();
      expect(meta.width).toBeLessThanOrEqual(800);
    });

    it('should not enlarge images smaller than 800px', async () => {
      const input = await createImageBuffer(400, 300, 'png');
      const resultUrl = await processAndStore(input);

      const fileBuffer = await fs.readFile(resolveUrl(resultUrl));
      const meta = await sharp(fileBuffer).metadata();
      expect(meta.width).toBe(400);
    });

    it('should maintain aspect ratio when resizing', async () => {
      const input = await createImageBuffer(1600, 900, 'jpeg');
      const resultUrl = await processAndStore(input);

      const fileBuffer = await fs.readFile(resolveUrl(resultUrl));
      const meta = await sharp(fileBuffer).metadata();
      const expectedRatio = 1600 / 900;
      const actualRatio = meta.width! / meta.height!;
      expect(Math.abs(expectedRatio - actualRatio)).toBeLessThan(0.02);
    });
  });

  describe('deleteImage', () => {
    it('should remove file from disk', async () => {
      const input = await createImageBuffer(200, 200, 'png');
      const resultUrl = await processAndStore(input);
      const filePath = resolveUrl(resultUrl);

      await expect(fs.access(filePath)).resolves.toBeUndefined();
      await deleteImage(resultUrl);
      await expect(fs.access(filePath)).rejects.toThrow();
    });

    it('should not throw when deleting a non-existent file', async () => {
      await expect(
        deleteImage('/uploads/changelog/00000000-0000-0000-0000-000000000000.webp'),
      ).resolves.toBeUndefined();
    });

    it('should refuse to delete paths that do not match the safe pattern', async () => {
      // Create a file outside the expected pattern
      const evilPath = path.join(tempDir, 'important.txt');
      await fs.writeFile(evilPath, 'do not delete');

      await deleteImage('/uploads/changelog/../important.txt');

      // File should still exist — deleteImage refused the unsafe path
      await expect(fs.access(evilPath)).resolves.toBeUndefined();
    });
  });
});
