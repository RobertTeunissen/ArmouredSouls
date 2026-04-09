/**
 * King of the Hill (KotH) specific error codes and error class.
 *
 * Provides structured, machine-readable error codes for all KotH
 * game mode failure scenarios. Frontend consumers can switch on `code`
 * to display context-appropriate messages and recovery actions.
 *
 * @module errors/kothErrors
 */

import { AppError } from './AppError';

/** All KotH error codes. */
export const KothErrorCode = {
  KOTH_NOT_FOUND: 'KOTH_NOT_FOUND',
  KOTH_ALREADY_COMPLETED: 'KOTH_ALREADY_COMPLETED',
  INSUFFICIENT_KOTH_PARTICIPANTS: 'INSUFFICIENT_KOTH_PARTICIPANTS',
  INVALID_KOTH_STATE: 'INVALID_KOTH_STATE',
} as const;

export type KothErrorCodeType = typeof KothErrorCode[keyof typeof KothErrorCode];

/**
 * Structured error thrown by KotH service/route layer.
 * Extends AppError to integrate with the centralized error handling middleware.
 * Carries an HTTP status and machine-readable code so the route handler
 * can produce a consistent JSON response without ad-hoc formatting.
 */
export class KothError extends AppError {
  constructor(
    code: KothErrorCodeType,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(code, message, statusCode, details);
    this.name = 'KothError';
  }
}
