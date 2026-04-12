/**
 * Property-based tests for FileValidationService.
 * Uses fast-check to verify universal properties across generated inputs.
 *
 * Property 3: Magic byte authority
 * For any uploaded file buffer, the File_Validation_Service SHALL determine
 * the file type from magic bytes, not from the declared MIME type.
 *
 * **Validates: Requirements 2.1, 2.3**
 */

import * as fc from 'fast-check';
import sharp from 'sharp';
import { fileValidationService } from '../fileValidationService';

// Pre-generated valid image buffers (populated in beforeAll)
let jpegBuffer: Buffer;
let pngBuffer: Buffer;
let webpBuffer: Buffer;

interface ImageSample {
  buffer: Buffer;
  expectedMime: string;
  label: string;
}

let imageSamples: ImageSample[];

beforeAll(async () => {
  // Create small valid images using sharp — 100×100 is within the valid dimension range
  const raw = Buffer.alloc(100 * 100 * 3, 128);
  const rawInput = { raw: { width: 100, height: 100, channels: 3 as const } };

  [jpegBuffer, pngBuffer, webpBuffer] = await Promise.all([
    sharp(raw, rawInput).jpeg({ quality: 50 }).toBuffer(),
    sharp(raw, rawInput).png().toBuffer(),
    sharp(raw, rawInput).webp({ quality: 50 }).toBuffer(),
  ]);

  imageSamples = [
    { buffer: jpegBuffer, expectedMime: 'image/jpeg', label: 'JPEG' },
    { buffer: pngBuffer, expectedMime: 'image/png', label: 'PNG' },
    { buffer: webpBuffer, expectedMime: 'image/webp', label: 'WebP' },
  ];
});

describe('FileValidationService Property Tests', () => {
  /**
   * Property 3: Magic byte authority
   * **Validates: Requirements 2.1, 2.3**
   */
  describe('Property 3: Magic byte authority', () => {
    it('should detect type from magic bytes regardless of any arbitrary declared MIME string', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...[0, 1, 2]),
          fc.string({ minLength: 1, maxLength: 60 }),
          async (sampleIndex: number, arbitraryMime: string) => {
            const sample = imageSamples[sampleIndex];
            const result = await fileValidationService.validateImage(
              sample.buffer,
              arbitraryMime
            );

            // The service must always report the magic-byte-detected MIME type,
            // never the declared one
            expect(result.valid).toBe(true);
            expect(result.detectedMimeType).toBe(sample.expectedMime);
          }
        ),
        { numRuns: 150 }
      );
    });

    it('should detect type from magic bytes when declared MIME is another valid image type', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...[0, 1, 2]),
          fc.constantFrom('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/svg+xml'),
          async (sampleIndex: number, declaredMime: string) => {
            const sample = imageSamples[sampleIndex];
            const result = await fileValidationService.validateImage(
              sample.buffer,
              declaredMime
            );

            // Magic bytes are authoritative — declared MIME is ignored
            expect(result.valid).toBe(true);
            expect(result.detectedMimeType).toBe(sample.expectedMime);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect type from magic bytes when declared MIME is a non-image type', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...[0, 1, 2]),
          fc.constantFrom(
            'application/pdf',
            'application/octet-stream',
            'text/plain',
            'text/html',
            'application/json',
            'application/zip',
            'video/mp4',
            'audio/mpeg'
          ),
          async (sampleIndex: number, declaredMime: string) => {
            const sample = imageSamples[sampleIndex];
            const result = await fileValidationService.validateImage(
              sample.buffer,
              declaredMime
            );

            // Even with completely wrong MIME types, magic bytes win
            expect(result.valid).toBe(true);
            expect(result.detectedMimeType).toBe(sample.expectedMime);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Invalid file rejection
   * **Validates: Requirements 2.2, 2.4**
   *
   * For any byte buffer whose magic bytes do not match JPEG, PNG, or WebP,
   * the service SHALL reject it. For any valid image outside [64, 4096]
   * dimension range, the service SHALL reject it.
   */
  describe('Property 4: Invalid file rejection', () => {
    // Magic byte prefixes checked inline in startsWithKnownMagicBytes below

    function startsWithKnownMagicBytes(bytes: Uint8Array): boolean {
      if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return true; // JPEG
      }
      if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        return true; // PNG
      }
      if (
        bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
      ) {
        return true; // WebP
      }
      return false;
    }

    it('should reject any byte buffer whose magic bytes do not match JPEG, PNG, or WebP', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ minLength: 1, maxLength: 100 }).filter(
            (bytes) => !startsWithKnownMagicBytes(bytes)
          ),
          async (randomBytes: Uint8Array) => {
            const buffer = Buffer.from(randomBytes);
            const result = await fileValidationService.validateImage(buffer, 'application/octet-stream');

            expect(result.valid).toBe(false);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should reject valid images with dimensions below 64 pixels', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate dimensions where at least one axis is below 64
          fc.integer({ min: 1, max: 63 }),
          fc.integer({ min: 1, max: 63 }),
          fc.constantFrom('jpeg', 'png', 'webp') as fc.Arbitrary<'jpeg' | 'png' | 'webp'>,
          async (width: number, height: number, format: 'jpeg' | 'png' | 'webp') => {
            const raw = Buffer.alloc(width * height * 3, 128);
            const rawInput = { raw: { width, height, channels: 3 as const } };
            const buffer = await sharp(raw, rawInput)[format]().toBuffer();

            const result = await fileValidationService.validateImage(buffer, `image/${format}`);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('dimensions');
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should reject valid images with dimensions above 4096 pixels', async () => {
      // Use a small set of specific over-limit dimensions to avoid memory issues
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(4097, 4200, 5000),
          async (dimension: number) => {
            // Create a minimal image at the over-limit dimension on one axis
            // Use 64 on the other axis to keep memory reasonable
            const width = dimension;
            const height = 64;
            const raw = Buffer.alloc(width * height * 3, 128);
            const rawInput = { raw: { width, height, channels: 3 as const } };
            const buffer = await sharp(raw, rawInput).png().toBuffer();

            const result = await fileValidationService.validateImage(buffer, 'image/png');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('dimensions');
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
