/**
 * Property-based tests for ImageProcessingService.
 * Uses fast-check to verify universal properties across generated inputs.
 *
 * Property 8: Image processing output invariant
 * For any valid image buffer, the service SHALL produce a 512×512 WebP buffer
 * whose magic bytes match the WebP signature.
 *
 * **Validates: Requirements 5.1, 5.2**
 */

import * as fc from 'fast-check';
import sharp from 'sharp';
import { imageProcessingService } from '../imageProcessingService';

// Helper: create a test image buffer with given dimensions and format
async function createImageBuffer(
  width: number,
  height: number,
  format: 'jpeg' | 'png' | 'webp'
): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3, 128);
  let pipeline = sharp(raw, { raw: { width, height, channels: 3 } });
  if (format === 'jpeg') pipeline = pipeline.jpeg({ quality: 50 });
  else if (format === 'png') pipeline = pipeline.png();
  else pipeline = pipeline.webp({ quality: 50 });
  return pipeline.toBuffer();
}

describe('ImageProcessingService Property Tests', () => {
  /**
   * Property 8: Image processing output invariant
   * **Validates: Requirements 5.1, 5.2**
   */
  describe('Property 8: Image processing output invariant', () => {
    it('should always produce a 512×512 WebP buffer for any valid image of varying dimensions and formats', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 64, max: 2048 }),
          fc.integer({ min: 64, max: 2048 }),
          fc.constantFrom('jpeg', 'png', 'webp') as fc.Arbitrary<'jpeg' | 'png' | 'webp'>,
          async (width: number, height: number, format: 'jpeg' | 'png' | 'webp') => {
            const input = await createImageBuffer(width, height, format);
            const output = await imageProcessingService.processImage(input);

            // Verify output dimensions and format via sharp metadata
            const meta = await sharp(output).metadata();
            expect(meta.width).toBe(512);
            expect(meta.height).toBe(512);
            expect(meta.format).toBe('webp');

            // Verify WebP magic bytes: "RIFF" at offset 0, "WEBP" at offset 8
            const riff = output.slice(0, 4).toString('ascii');
            const webp = output.slice(8, 12).toString('ascii');
            expect(riff).toBe('RIFF');
            expect(webp).toBe('WEBP');
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
