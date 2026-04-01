/**
 * Auth-specific error codes and error class.
 *
 * Provides structured, machine-readable error codes for all authentication
 * and authorization failure scenarios. Frontend consumers can switch on `code`
 * to display context-appropriate messages and recovery actions.
 *
 * @module errors/authErrors
 */

import { AppError } from './AppError';

/** All auth error codes. */
export const AuthErrorCode = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
} as const;

export type AuthErrorCodeType = typeof AuthErrorCode[keyof typeof AuthErrorCode];

/**
 * Structured error thrown by auth service/route layer.
 * Extends AppError to integrate with the centralized error handling middleware.
 * Carries an HTTP status and machine-readable code so the route handler
 * can produce a consistent JSON response without ad-hoc formatting.
 */
export class AuthError extends AppError {
  constructor(
    code: AuthErrorCodeType,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(code, message, statusCode, details);
    this.name = 'AuthError';
  }
}
