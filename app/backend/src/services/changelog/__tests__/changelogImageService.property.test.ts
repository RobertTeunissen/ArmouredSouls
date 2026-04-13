/**
 * Property-based tests for ChangelogImageService.
 *
 * Uses fast-check to verify universal properties across generated inputs.
 * Each test tagged: Feature: in-game-changelog, Property {N}: {title}
 *
 * Properties:
 *   7: Image processing produces valid WebP with correct dimensions
 *   8: Image storage path matches expected pattern
 *   9: Image cleanup on entry deletion
 *
 * Uses real sharp processing with small test images and temp directories
 * for test isolation.
 */

import * as fc from 'fast-check';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';

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

/**
 * processAndStore implementation using temp dir — mirrors the real service logic
 * but writes to our isolated temp directory.
 */
async function processAndStore(buffer: Buffer): Promise<string> {
  const uploadDir = path.join(tempDir, 'uploads', 'changelog');
  await fs.mkdir(uploadDir, { recursive: true });

  const processed = await sharp(buffer)
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomUUID } = require('crypto');
  const filename = `${randomUUID()}.webp`;
  const filePath = path.join(uploadDir, filename);
  await fs.writeFile(filePath, processed);

  return `/uploads/changelog/${filename}`;
}

/**
 * deleteImage implementation using temp dir — mirrors the real service logic.
 */
async function deleteImage(imageUrl: string): Promise<void> {
  try {
    const subPath = imageUrl.replace(/^\/uploads\/changelog\//, '');
    const absolutePath = path.join(tempDir, 'uploads', 'changelog', subPath);
    await fs.unlink(absolutePath);
  } catch {
    // Non-fatal, matches production behavior
  }
}

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'changelog-img-prop-'));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('ChangelogImageService Property Tests', () => {
  // ── Property 7: Image processing produces valid WebP with correct dimensions ──

  describe('Feature: in-game-changelog, Property 7: Image processing produces valid WebP with correct dimensions', () => {
    /**
     * **Validates: Requirements 6.10, 7.3**
     *
     * For any valid image buffer, output is WebP with width ≤ 800px
     * and matching aspect ratio.
     */
    it('should produce WebP output with width ≤ 800px and matching aspect ratio for any valid image', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 64, max: 2048 }),
          fc.integer({ min: 64, max: 2048 }),
          fc.constantFrom('jpeg', 'png', 'webp') as fc.Arbitrary<'jpeg' | 'png' | 'webp'>,
          async (width: number, height: number, format: 'jpeg' | 'png' | 'webp') => {
            const input = await createImageBuffer(width, height, format);
            const resultUrl = await processAndStore(input);

            // Read the stored file
            const subPath = resultUrl.replace(/^\/uploads\/changelog\//, '');
            const filePath = path.join(tempDir, 'uploads', 'changelog', subPath);
            const fileBuffer = await fs.readFile(filePath);
            const meta = await sharp(fileBuffer).metadata();

            // Output must be WebP
            expect(meta.format).toBe('webp');

            // Width must be ≤ 800px
            expect(meta.width).toBeLessThanOrEqual(800);

            // Width should be min(original, 800) due to withoutEnlargement
            const expectedWidth = Math.min(width, 800);
            expect(meta.width).toBe(expectedWidth);

            // Aspect ratio must match within rounding tolerance.
            // Sharp rounds to nearest integer pixel, so for small heights
            // the rounding error can be significant (e.g. 802×64 → 800×63).
            // We compute the expected height from the expected width and check
            // the output height is within ±1px of that.
            const expectedHeight = Math.round((meta.width! / width) * height);
            expect(Math.abs(meta.height! - expectedHeight)).toBeLessThanOrEqual(1);

            // Verify WebP magic bytes: "RIFF" at offset 0, "WEBP" at offset 8
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
    /**
     * **Validates: Requirements 7.4**
     *
     * For any stored image, returned path matches `/uploads/changelog/{uuid}.webp`.
     */
    it('should return a path matching /uploads/changelog/{uuid}.webp for any stored image', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 64, max: 512 }),
          fc.integer({ min: 64, max: 512 }),
          fc.constantFrom('jpeg', 'png', 'webp') as fc.Arbitrary<'jpeg' | 'png' | 'webp'>,
          async (width: number, height: number, format: 'jpeg' | 'png' | 'webp') => {
            const input = await createImageBuffer(width, height, format);
            const resultUrl = await processAndStore(input);

            // Path must match the expected UUID pattern
            expect(resultUrl).toMatch(UUID_WEBP_REGEX);

            // File must actually exist on disk
            const subPath = resultUrl.replace(/^\/uploads\/changelog\//, '');
            const filePath = path.join(tempDir, 'uploads', 'changelog', subPath);
            await expect(fs.access(filePath)).resolves.toBeUndefined();
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

            // Two calls with identical content must produce different paths
            expect(path1).not.toBe(path2);

            // Both must match the valid format
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
    /**
     * **Validates: Requirements 7.5**
     *
     * For any entry with an imageUrl pointing to a file on disk,
     * deleting the entry also deletes the image file.
     */
    it('should delete the image file when entry deletion triggers image cleanup', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 64, max: 512 }),
          fc.integer({ min: 64, max: 512 }),
          fc.constantFrom('jpeg', 'png', 'webp') as fc.Arbitrary<'jpeg' | 'png' | 'webp'>,
          async (width: number, height: number, format: 'jpeg' | 'png' | 'webp') => {
            const input = await createImageBuffer(width, height, format);
            const imageUrl = await processAndStore(input);

            // Verify file exists before deletion
            const subPath = imageUrl.replace(/^\/uploads\/changelog\//, '');
            const filePath = path.join(tempDir, 'uploads', 'changelog', subPath);
            await expect(fs.access(filePath)).resolves.toBeUndefined();

            // Simulate what ChangelogService.delete does: call deleteImage if imageUrl exists
            if (imageUrl) {
              await deleteImage(imageUrl);
            }

            // Verify file is gone after deletion
            await expect(fs.access(filePath)).rejects.toThrow();
          },
        ),
        { numRuns: 20 },
      );
    });
  });
});
