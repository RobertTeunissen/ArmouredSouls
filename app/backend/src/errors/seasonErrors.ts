/**
 * Season-specific error codes and error class (Spec #45).
 *
 * Covers the Season_Service, Season_Rollover_Service, Admin_Season_Portal,
 * and Image_Library failure scenarios.
 *
 * @module errors/seasonErrors
 */

import { AppError } from './AppError';

/** All season error codes. */
export const SeasonErrorCode = {
  /** A Season_Rollover is already executing; a second cannot start. */
  ROLLOVER_IN_PROGRESS: 'ROLLOVER_IN_PROGRESS',
  /** Archive row counts did not match the pre-rollover counts — purge aborted. */
  ARCHIVE_VERIFICATION_FAILED: 'ARCHIVE_VERIFICATION_FAILED',
  /** A destructive admin action was requested without its confirmation value. */
  CONFIRMATION_REQUIRED: 'CONFIRMATION_REQUIRED',
  /**
   * The confirmed season number does not match the current season. Distinct
   * from CONFIRMATION_REQUIRED so a stale admin tab or wrong-season request is
   * distinguishable from a missing confirmation. See adminSeasons rollover.
   */
  SEASON_NUMBER_MISMATCH: 'SEASON_NUMBER_MISMATCH',
  /** The action is not permitted while the season is in its Preparation_Phase. */
  PREPARATION_PHASE_ACTIVE: 'PREPARATION_PHASE_ACTIVE',
  /** No Season record exists for the requested season number. */
  SEASON_NOT_FOUND: 'SEASON_NOT_FOUND',
  /** The stable already holds Retained_Images_Per_Stable images. */
  IMAGE_LIMIT_REACHED: 'IMAGE_LIMIT_REACHED',
  /** The image path does not resolve inside the caller's own upload directory. */
  IMAGE_NOT_OWNED: 'IMAGE_NOT_OWNED',
} as const;

export type SeasonErrorCodeType = typeof SeasonErrorCode[keyof typeof SeasonErrorCode];

/**
 * Structured error thrown by the season service, rollover, and image library
 * layers. Extends AppError so the centralized error middleware produces the
 * standard `{ error, code, details? }` response shape.
 */
export class SeasonError extends AppError {
  constructor(
    code: SeasonErrorCodeType,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(code, message, statusCode, details);
    this.name = 'SeasonError';
  }
}
