/**
 * Property-based tests for ChangelogImageService.
 *
 * Tests the REAL processAndStore and deleteImage functions using an
 * injectable temp directory for isolation.
 *
 * Properties:
 *   7: Image processing produces valid WebP with correct dimensions
 *   8: Image storage path matches expected pattern
 *   9: Image cleanup on entry deletion
 */

import * as fc from 'fast-check';
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
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'changelog-img-prop-'));
  setUploadDir(tempDir);
});

afterEach(async () => {
  resetUploadDir();
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('ChangelogImageService Property Tests', () => {
  // ── Property 7: Image processing produces valid WebP with correct dimensions ──

  describe('Feature: in-game-changelog, Property 7: Image processing produces valid WebP with correct dimensions', () => {
    it('should produce WebP output with width ≤ 800px and matching aspect ratio for any valid image', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 64, max: 2048 }),
          fc.integer({ min: 64, max: 2048 }),
          fc.constantFrom('jpeg', 'png', 'webp') as fc.Arbitrary<'jpeg' | 'png' | 'webp'>,
          async (width: number, height: number, format: 'jpeg' | 'png' | 'webp') => {
            const input = await createImageBuffer(width, height, format);
            const resultUrl = await processAndStore(input);

            const fileBuffer = await fs.readFile(resolveUrl(resultUrl));
            const meta = await sharp(fileBuffer).metadata();

            expect(meta.format).toBe('webp');
            expect(meta.width).toBeLessThanOrEqual(800);

            const expectedWidth = Math.min(width, 800);
            expect(meta.width).toBe(expectedWidth);

            const expectedHeight = Math.round((meta.width! / width) * height);
            expect(Math.abs(meta.height! - expectedHeight)).toBeLessThanOrEqual(1);

            const riff = fileBuffer.subarray(0, 4).toString('ascii');
            const webp = fileBuffer.subarray(8, 12).toString('ascii');
            expect(riff).toBe('RIFF');
            expect(webp).toBe('WEBP');
          },
        ),
        { numRuns: 20 },
      );
    });
  });

  // ── Property 8: Image storage path matches expected pattern ────────

  describe('Feature: in-game-changelog, Property 8: Image storage path matches expected pattern', () => {
    it('should return a path matching /uploads/changelog/{uuid}.webp for any stored image', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 64, max: 512 }),
          fc.integer({ min: 64, max: 512 }),
          fc.constantFrom('jpeg', 'png', 'webp') as fc.Arbitrary<'jpeg' | 'png' | 'webp'>,
          async (width: number, height: number, format: 'jpeg' | 'png' | 'webp') => {
            const input = await createImageBuffer(width, height, format);
            const resultUrl = await processAndStore(input);

            expect(resultUrl).toMatch(UUID_WEBP_REGEX);
            await expect(fs.access(resolveUrl(resultUrl))).resolves.toBeUndefined();
          },
        ),
        { numRuns: 20 },
      );
    });

    it('should produce different paths for two calls with identical content', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 64, max: 256 }),
          fc.integer({ min: 64, max: 256 }),
          fc.constantFrom('jpeg', 'png', 'webp') as fc.Arbitrary<'jpeg' | 'png' | 'webp'>,
          async (width: number, height: number, format: 'jpeg' | 'png' | 'webp') => {
            const input = await createImageBuffer(width, height, format);
            const path1 = await processAndStore(input);
            const path2 = await processAndStore(input);

            expect(path1).not.toBe(path2);
            expect(path1).toMatch(UUID_WEBP_REGEX);
            expect(path2).toMatch(UUID_WEBP_REGEX);
          },
        ),
        { numRuns: 20 },
      );
    });
  });

  // ── Property 9: Image cleanup on entry deletion ────────────────────

  describe('Feature: in-game-changelog, Property 9: Image cleanup on entry deletion', () => {
    it('should delete the image file when entry deletion triggers image cleanup', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 64, max: 512 }),
          fc.integer({ min: 64, max: 512 }),
          fc.constantFrom('jpeg', 'png', 'webp') as fc.Arbitrary<'jpeg' | 'png' | 'webp'>,
          async (width: number, height: number, format: 'jpeg' | 'png' | 'webp') => {
            const input = await createImageBuffer(width, height, format);
            const imageUrl = await processAndStore(input);
            const filePath = resolveUrl(imageUrl);

            await expect(fs.access(filePath)).resolves.toBeUndefined();
            await deleteImage(imageUrl);
            await expect(fs.access(filePath)).rejects.toThrow();
          },
        ),
        { numRuns: 20 },
      );
    });
  });
});
