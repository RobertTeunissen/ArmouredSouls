import sharp from 'sharp';

export interface FileValidationResult {
  valid: boolean;
  width?: number;
  height?: number;
  detectedMimeType?: string;
  error?: string;
}

interface MagicByteSignature {
  mimeType: string;
  check: (buffer: Buffer) => boolean;
}

const MIN_DIMENSION = 64;
const MAX_DIMENSION = 4096;

const MAGIC_BYTE_SIGNATURES: MagicByteSignature[] = [
  {
    mimeType: 'image/jpeg',
    check: (buffer: Buffer): boolean =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
  {
    mimeType: 'image/png',
    check: (buffer: Buffer): boolean =>
      buffer.length >= 4 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47,
  },
  {
    mimeType: 'image/webp',
    check: (buffer: Buffer): boolean =>
      buffer.length >= 12 &&
      buffer[0] === 0x52 && // R
      buffer[1] === 0x49 && // I
      buffer[2] === 0x46 && // F
      buffer[3] === 0x46 && // F
      buffer[8] === 0x57 && // W
      buffer[9] === 0x45 && // E
      buffer[10] === 0x42 && // B
      buffer[11] === 0x50, // P
  },
];

class FileValidationService {
  /**
   * Validates an image buffer by checking magic bytes and pixel dimensions.
   * The declared mimeType parameter is ignored — magic bytes are authoritative.
   */
  async validateImage(buffer: Buffer, _mimeType: string): Promise<FileValidationResult> {
    const detectedMimeType = this.detectMimeType(buffer);

    if (!detectedMimeType) {
      return {
        valid: false,
        error: 'File format not supported. Please upload a JPEG, PNG, or WebP image.',
      };
    }

    try {
      const metadata = await sharp(buffer).metadata();
      const width = metadata.width;
      const height = metadata.height;

      if (!width || !height) {
        return {
          valid: false,
          error: 'Unable to read image dimensions. The file may be corrupt.',
        };
      }

      if (
        width < MIN_DIMENSION ||
        height < MIN_DIMENSION ||
        width > MAX_DIMENSION ||
        height > MAX_DIMENSION
      ) {
        return {
          valid: false,
          error: `Image dimensions must be between ${MIN_DIMENSION}×${MIN_DIMENSION} and ${MAX_DIMENSION}×${MAX_DIMENSION} pixels. Got ${width}×${height}.`,
        };
      }

      return {
        valid: true,
        width,
        height,
        detectedMimeType,
      };
    } catch {
      return {
        valid: false,
        error: 'Unable to read image metadata. The file may be corrupt.',
      };
    }
  }

  private detectMimeType(buffer: Buffer): string | null {
    for (const signature of MAGIC_BYTE_SIGNATURES) {
      if (signature.check(buffer)) {
        return signature.mimeType;
      }
    }
    return null;
  }
}

export const fileValidationService = new FileValidationService();
