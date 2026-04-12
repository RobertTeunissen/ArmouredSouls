import sharp from 'sharp';
import { fileValidationService } from '../fileValidationService';

/**
 * Unit tests for FileValidationService
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

// Helper: create a real image buffer of given dimensions and format
async function createImageBuffer(
  width: number,
  height: number,
  format: 'jpeg' | 'png' | 'webp'
): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3, 128); // grey pixels
  let pipeline = sharp(raw, { raw: { width, height, channels: 3 } });
  if (format === 'jpeg') pipeline = pipeline.jpeg({ quality: 50 });
  else if (format === 'png') pipeline = pipeline.png();
  else pipeline = pipeline.webp({ quality: 50 });
  return pipeline.toBuffer();
}

describe('FileValidationService', () => {
  describe('magic byte detection', () => {
    it('should detect JPEG format from magic bytes when given a valid JPEG buffer', async () => {
      const buffer = await createImageBuffer(100, 100, 'jpeg');
      const result = await fileValidationService.validateImage(buffer, 'image/jpeg');
      expect(result.valid).toBe(true);
      expect(result.detectedMimeType).toBe('image/jpeg');
    });

    it('should detect PNG format from magic bytes when given a valid PNG buffer', async () => {
      const buffer = await createImageBuffer(100, 100, 'png');
      const result = await fileValidationService.validateImage(buffer, 'image/png');
      expect(result.valid).toBe(true);
      expect(result.detectedMimeType).toBe('image/png');
    });

    it('should detect WebP format from magic bytes when given a valid WebP buffer', async () => {
      const buffer = await createImageBuffer(100, 100, 'webp');
      const result = await fileValidationService.validateImage(buffer, 'image/webp');
      expect(result.valid).toBe(true);
      expect(result.detectedMimeType).toBe('image/webp');
    });
  });

  describe('non-image file rejection', () => {
    it('should reject a plain text file when magic bytes do not match any image format', async () => {
      const textBuffer = Buffer.from('This is a plain text file, not an image.');
      const result = await fileValidationService.validateImage(textBuffer, 'text/plain');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/not supported/i);
    });

    it('should reject a buffer with random bytes when it does not start with known magic bytes', async () => {
      const randomBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09]);
      const result = await fileValidationService.validateImage(randomBuffer, 'application/octet-stream');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/not supported/i);
    });

    it('should reject a renamed executable when magic bytes are ELF, not an image', async () => {
      // ELF header magic bytes: 0x7F 'E' 'L' 'F'
      const elfBuffer = Buffer.alloc(64, 0);
      elfBuffer[0] = 0x7f;
      elfBuffer[1] = 0x45; // E
      elfBuffer[2] = 0x4c; // L
      elfBuffer[3] = 0x46; // F
      const result = await fileValidationService.validateImage(elfBuffer, 'image/jpeg');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/not supported/i);
    });
  });

  describe('dimension validation', () => {
    it('should reject an image when dimensions are below 64×64', async () => {
      const buffer = await createImageBuffer(63, 63, 'png');
      const result = await fileValidationService.validateImage(buffer, 'image/png');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/dimensions/i);
      expect(result.error).toContain('63×63');
    });

    it('should accept an image when dimensions are exactly 64×64', async () => {
      const buffer = await createImageBuffer(64, 64, 'png');
      const result = await fileValidationService.validateImage(buffer, 'image/png');
      expect(result.valid).toBe(true);
      expect(result.width).toBe(64);
      expect(result.height).toBe(64);
    });

    it('should accept an image when dimensions are exactly 4096×4096', async () => {
      const buffer = await createImageBuffer(4096, 4096, 'jpeg');
      const result = await fileValidationService.validateImage(buffer, 'image/jpeg');
      expect(result.valid).toBe(true);
      expect(result.width).toBe(4096);
      expect(result.height).toBe(4096);
    });

    it('should reject an image when dimensions exceed 4096×4096', async () => {
      const buffer = await createImageBuffer(4097, 4097, 'jpeg');
      const result = await fileValidationService.validateImage(buffer, 'image/jpeg');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/dimensions/i);
      expect(result.error).toContain('4097×4097');
    });

    it('should accept an image when dimensions are within the valid range', async () => {
      const buffer = await createImageBuffer(512, 512, 'webp');
      const result = await fileValidationService.validateImage(buffer, 'image/webp');
      expect(result.valid).toBe(true);
      expect(result.width).toBe(512);
      expect(result.height).toBe(512);
    });

    it('should reject an image when only width is below minimum', async () => {
      const buffer = await createImageBuffer(63, 100, 'png');
      const result = await fileValidationService.validateImage(buffer, 'image/png');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/dimensions/i);
    });

    it('should reject an image when only height is above maximum', async () => {
      const buffer = await createImageBuffer(100, 4097, 'png');
      const result = await fileValidationService.validateImage(buffer, 'image/png');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/dimensions/i);
    });
  });

  describe('MIME type mismatch handling', () => {
    it('should use magic-byte-detected format when declared MIME type is wrong for JPEG', async () => {
      const buffer = await createImageBuffer(100, 100, 'jpeg');
      const result = await fileValidationService.validateImage(buffer, 'image/png');
      expect(result.valid).toBe(true);
      expect(result.detectedMimeType).toBe('image/jpeg');
    });

    it('should use magic-byte-detected format when declared MIME type is wrong for PNG', async () => {
      const buffer = await createImageBuffer(100, 100, 'png');
      const result = await fileValidationService.validateImage(buffer, 'image/webp');
      expect(result.valid).toBe(true);
      expect(result.detectedMimeType).toBe('image/png');
    });

    it('should use magic-byte-detected format when declared MIME type is wrong for WebP', async () => {
      const buffer = await createImageBuffer(100, 100, 'webp');
      const result = await fileValidationService.validateImage(buffer, 'image/jpeg');
      expect(result.valid).toBe(true);
      expect(result.detectedMimeType).toBe('image/webp');
    });

    it('should use magic-byte-detected format when declared MIME type is a non-image type', async () => {
      const buffer = await createImageBuffer(100, 100, 'png');
      const result = await fileValidationService.validateImage(buffer, 'application/pdf');
      expect(result.valid).toBe(true);
      expect(result.detectedMimeType).toBe('image/png');
    });
  });
});
