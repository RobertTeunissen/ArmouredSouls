/**
 * Robot-specific error codes and error class.
 *
 * Provides structured, machine-readable error codes for all robot
 * management failure scenarios. Frontend consumers can switch on `code`
 * to display context-appropriate messages and recovery actions.
 *
 * @module errors/robotErrors
 */

import { AppError } from './AppError';

/** All robot error codes. */
export const RobotErrorCode = {
  ROBOT_NOT_FOUND: 'ROBOT_NOT_FOUND',
  ROBOT_NOT_OWNED: 'ROBOT_NOT_OWNED',
  ROBOT_DESTROYED: 'ROBOT_DESTROYED',
  ROBOT_NAME_TAKEN: 'ROBOT_NAME_TAKEN',
  INVALID_ROBOT_ATTRIBUTES: 'INVALID_ROBOT_ATTRIBUTES',
  MAX_ROBOTS_REACHED: 'MAX_ROBOTS_REACHED',
} as const;

export type RobotErrorCodeType = typeof RobotErrorCode[keyof typeof RobotErrorCode];

/**
 * Structured error thrown by robot service/route layer.
 * Extends AppError to integrate with the centralized error handling middleware.
 * Carries an HTTP status and machine-readable code so the route handler
 * can produce a consistent JSON response without ad-hoc formatting.
 */
export class RobotError extends AppError {
  constructor(
    code: RobotErrorCodeType,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(code, message, statusCode, details);
    this.name = 'RobotError';
  }
}
