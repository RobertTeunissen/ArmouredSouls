/**
 * Economy-specific error codes and error class.
 *
 * Provides structured, machine-readable error codes for all economy,
 * facility, and weapon transaction failure scenarios. Frontend consumers can switch on `code`
 * to display context-appropriate messages and recovery actions.
 *
 * @module errors/economyErrors
 */

import { AppError } from './AppError';

/** All economy error codes. */
export const EconomyErrorCode = {
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  FACILITY_MAX_LEVEL: 'FACILITY_MAX_LEVEL',
  INVALID_FACILITY_TYPE: 'INVALID_FACILITY_TYPE',
  FACILITY_NOT_FOUND: 'FACILITY_NOT_FOUND',
  WEAPON_NOT_FOUND: 'WEAPON_NOT_FOUND',
  WEAPON_NOT_AFFORDABLE: 'WEAPON_NOT_AFFORDABLE',
  INVALID_TRANSACTION: 'INVALID_TRANSACTION',
} as const;

export type EconomyErrorCodeType = typeof EconomyErrorCode[keyof typeof EconomyErrorCode];

/**
 * Structured error thrown by economy service/route layer.
 * Extends AppError to integrate with the centralized error handling middleware.
 * Carries an HTTP status and machine-readable code so the route handler
 * can produce a consistent JSON response without ad-hoc formatting.
 */
export class EconomyError extends AppError {
  constructor(
    code: EconomyErrorCodeType,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(code, message, statusCode, details);
    this.name = 'EconomyError';
  }
}
