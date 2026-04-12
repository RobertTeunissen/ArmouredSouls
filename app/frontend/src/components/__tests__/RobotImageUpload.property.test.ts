// Property 11: Frontend file validation mirrors backend constraints
// **Validates: Requirement 9.2**
//
// For any file selected in the upload UI, the frontend SHALL reject files
// not JPEG/PNG/WebP and files > 2 MB before sending to server.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateUploadFile, type FileValidationResult } from '../RobotImageSelector';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

/**
 * Creates a mock File object with the given type and size.
 */
function createMockFile(type: string, size: number): File {
  // Create a minimal buffer of the requested size (capped for memory safety in tests)
  const actualSize = Math.min(size, 64);
  const buffer = new ArrayBuffer(actualSize);
  const blob = new Blob([buffer], { type });

  // Override the size property since Blob size is based on actual content
  const file = new File([blob], 'test-file', { type });
  Object.defineProperty(file, 'size', { value: size, writable: false });
  return file;
}

/**
 * Arbitrary for disallowed MIME types — anything that is NOT jpeg, png, or webp.
 */
const disallowedMimeType = fc.constantFrom(
  'text/plain',
  'application/pdf',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/svg+xml',
  'application/octet-stream',
  'video/mp4',
  'audio/mpeg',
  'application/zip',
  'text/html',
  'application/json',
  'image/x-icon',
);

/**
 * Arbitrary for allowed MIME types.
 */
const allowedMimeType = fc.constantFrom(...ALLOWED_TYPES);

/**
 * Arbitrary for file sizes that exceed the 2 MB limit.
 */
const oversizedFileSize = fc.integer({ min: MAX_SIZE + 1, max: MAX_SIZE * 10 });

/**
 * Arbitrary for file sizes within the 2 MB limit.
 */
const validFileSize = fc.integer({ min: 1, max: MAX_SIZE });

describe('Property 11: Frontend file validation mirrors backend constraints', () => {
  it('rejects files with non-JPEG/PNG/WebP MIME types regardless of size', () => {
    fc.assert(
      fc.property(
        disallowedMimeType,
        fc.integer({ min: 1, max: MAX_SIZE }),
        (mimeType: string, size: number) => {
          const file = createMockFile(mimeType, size);
          const result: FileValidationResult = validateUploadFile(file);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('JPEG');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('rejects files exceeding 2 MB regardless of MIME type', () => {
    fc.assert(
      fc.property(
        allowedMimeType,
        oversizedFileSize,
        (mimeType: string, size: number) => {
          const file = createMockFile(mimeType, size);
          const result: FileValidationResult = validateUploadFile(file);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('2 MB');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('accepts JPEG/PNG/WebP files under 2 MB', () => {
    fc.assert(
      fc.property(
        allowedMimeType,
        validFileSize,
        (mimeType: string, size: number) => {
          const file = createMockFile(mimeType, size);
          const result: FileValidationResult = validateUploadFile(file);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('rejects files with both invalid type AND oversized', () => {
    fc.assert(
      fc.property(
        disallowedMimeType,
        oversizedFileSize,
        (mimeType: string, size: number) => {
          const file = createMockFile(mimeType, size);
          const result: FileValidationResult = validateUploadFile(file);
          expect(result.valid).toBe(false);
          // Should fail on type check first (type is checked before size)
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
