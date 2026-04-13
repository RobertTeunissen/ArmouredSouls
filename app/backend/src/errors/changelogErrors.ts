/**
 * Changelog-specific error codes and error class.
 *
 * Provides structured, machine-readable error codes for all changelog
 * management failure scenarios. Frontend consumers can switch on `code`
 * to display context-appropriate messages and recovery actions.
 *
 * @module errors/changelogErrors
 */

import { AppError } from './AppError';

/** All changelog error codes. */
export const ChangelogErrorCode = {
  CHANGELOG_NOT_FOUND: 'CHANGELOG_NOT_FOUND',
  CHANGELOG_VALIDATION_ERROR: 'CHANGELOG_VALIDATION_ERROR',
  CHANGELOG_IMAGE_ERROR: 'CHANGELOG_IMAGE_ERROR',
} as const;

export type ChangelogErrorCodeType = typeof ChangelogErrorCode[keyof typeof ChangelogErrorCode];

/**
 * Structured error thrown by changelog service/route layer.
 * Extends AppError to integrate with the centralized error handling middleware.
 * Carries an HTTP status and machine-readable code so the route handler
 * can produce a consistent JSON response without ad-hoc formatting.
 */
export class ChangelogError extends AppError {
  constructor(
    code: ChangelogErrorCodeType,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(code, message, statusCode, details);
    this.name = 'ChangelogError';
  }
}
