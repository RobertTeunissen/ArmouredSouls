// --- Client-side file validation ---
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUploadFile(file: File): FileValidationResult {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only JPEG, PNG, and WebP images are allowed.' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'File must be under 2 MB.' };
  }
  return { valid: true };
}
