import { AppError } from './AppError';

/**
 * Error codes of the admin Image Uploads page (Security & Moderation).
 */
export const ModerationErrorCode = {
  /** No uploaded image with that id (deleted meanwhile, or never existed). */
  IMAGE_NOT_FOUND: 'IMAGE_NOT_FOUND',
} as const;

export type ModerationErrorCodeType = typeof ModerationErrorCode[keyof typeof ModerationErrorCode];

export class ModerationError extends AppError {
  constructor(
    code: ModerationErrorCodeType,
    message: string,
    statusCode: number = 400,
    details?: unknown,
  ) {
    super(code, message, statusCode, details);
    this.name = 'ModerationError';
  }
}
