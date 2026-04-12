import sharp from 'sharp';

class ImageProcessingService {
  /**
   * Resizes and converts an image buffer to 512×512 WebP.
   * Uses center-crop (fit: 'cover') for non-square inputs.
   * All images pass through this pipeline regardless of input format or dimensions.
   */
  async processImage(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize(512, 512, { fit: 'cover', position: 'centre' })
      .webp({ quality: 80 })
      .toBuffer();
  }
}

export const imageProcessingService = new ImageProcessingService();
