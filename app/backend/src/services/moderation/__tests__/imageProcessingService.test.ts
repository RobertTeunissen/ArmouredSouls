import sharp from 'sharp';
import { imageProcessingService } from '../imageProcessingService';

/**
 * Unit tests for ImageProcessingService
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4
 */

// Helper: create a real image buffer of given dimensions and format
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

describe('ImageProcessingService', () => {
  describe('output format and dimensions', () => {
    it('should produce 512×512 WebP output for JPEG input', async () => {
      const input = await createImageBuffer(800, 600, 'jpeg');
      const output = await imageProcessingService.processImage(input);
      const meta = await sharp(output).metadata();

      expect(meta.width).toBe(512);
      expect(meta.height).toBe(512);
      expect(meta.format).toBe('webp');
    });

    it('should produce 512×512 WebP output for PNG input', async () => {
      const input = await createImageBuffer(1024, 768, 'png');
      const output = await imageProcessingService.processImage(input);
      const meta = await sharp(output).metadata();

      expect(meta.width).toBe(512);
      expect(meta.height).toBe(512);
      expect(meta.format).toBe('webp');
    });

    it('should produce 512×512 WebP output for WebP input', async () => {
      const input = await createImageBuffer(640, 480, 'webp');
      const output = await imageProcessingService.processImage(input);
      const meta = await sharp(output).metadata();

      expect(meta.width).toBe(512);
      expect(meta.height).toBe(512);
      expect(meta.format).toBe('webp');
    });
  });

  describe('center-crop for non-square input', () => {
    it('should center-crop a wide non-square image to 512×512', async () => {
      const input = await createImageBuffer(1920, 600, 'jpeg');
      const output = await imageProcessingService.processImage(input);
      const meta = await sharp(output).metadata();

      expect(meta.width).toBe(512);
      expect(meta.height).toBe(512);
    });

    it('should center-crop a tall non-square image to 512×512', async () => {
      const input = await createImageBuffer(400, 1200, 'png');
      const output = await imageProcessingService.processImage(input);
      const meta = await sharp(output).metadata();

      expect(meta.width).toBe(512);
      expect(meta.height).toBe(512);
    });
  });

  describe('passthrough for already-correct input', () => {
    it('should still produce valid 512×512 WebP output when input is already 512×512 WebP', async () => {
      const input = await createImageBuffer(512, 512, 'webp');
      const output = await imageProcessingService.processImage(input);
      const meta = await sharp(output).metadata();

      expect(meta.width).toBe(512);
      expect(meta.height).toBe(512);
      expect(meta.format).toBe('webp');
    });
  });

  describe('WebP magic bytes', () => {
    it('should produce output buffer starting with WebP magic bytes (RIFF....WEBP)', async () => {
      const input = await createImageBuffer(256, 256, 'png');
      const output = await imageProcessingService.processImage(input);

      // WebP files start with "RIFF" at offset 0 and "WEBP" at offset 8
      const riff = output.slice(0, 4).toString('ascii');
      const webp = output.slice(8, 12).toString('ascii');

      expect(riff).toBe('RIFF');
      expect(webp).toBe('WEBP');
    });
  });
});
