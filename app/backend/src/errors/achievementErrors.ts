/**
 * Achievement-specific error codes and error class.
 *
 * Provides structured, machine-readable error codes for all achievement
 * system failure scenarios. Frontend consumers can switch on `code`
 * to display context-appropriate messages and recovery actions.
 *
 * @module errors/achievementErrors
 */

import { AppError } from './AppError';

/** All achievement error codes. */
export const AchievementErrorCode = {
  INVALID_ACHIEVEMENT_ID: 'ACHIEVEMENT_INVALID_ID',
  ACHIEVEMENT_NOT_UNLOCKED: 'ACHIEVEMENT_NOT_UNLOCKED',
  TOO_MANY_PINNED: 'ACHIEVEMENT_TOO_MANY_PINNED',
} as const;

export type AchievementErrorCodeType = typeof AchievementErrorCode[keyof typeof AchievementErrorCode];

/**
 * Structured error thrown by achievement service/route layer.
 * Extends AppError to integrate with the centralized error handling middleware.
 * Carries an HTTP status and machine-readable code so the route handler
 * can produce a consistent JSON response without ad-hoc formatting.
 */
export class AchievementError extends AppError {
  constructor(
    code: AchievementErrorCodeType,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(code, message, statusCode, details);
    this.name = 'AchievementError';
  }
}
