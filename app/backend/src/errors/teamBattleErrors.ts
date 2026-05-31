/**
 * Team Battle error codes and error class.
 *
 * Provides structured, machine-readable error codes for all team battle
 * management failure scenarios. Frontend consumers can switch on `code`
 * to display context-appropriate messages and recovery actions.
 *
 * @module errors/teamBattleErrors
 */

import { AppError } from './AppError';

/** All team battle error codes. */
export const TeamBattleErrorCode = {
  TEAM_INVALID_SIZE: 'TEAM_INVALID_SIZE',
  TEAM_INVALID_COMPOSITION: 'TEAM_INVALID_COMPOSITION',
  TEAM_OWNERSHIP_VIOLATION: 'TEAM_OWNERSHIP_VIOLATION',
  TEAM_MEMBER_CONFLICT: 'TEAM_MEMBER_CONFLICT',
  TEAM_INSUFFICIENT_ROBOTS: 'TEAM_INSUFFICIENT_ROBOTS',
  TEAM_NAME_INVALID: 'TEAM_NAME_INVALID',
  TEAM_LOCKED_FOR_BATTLE: 'TEAM_LOCKED_FOR_BATTLE',
  TEAM_NOT_FOUND: 'TEAM_NOT_FOUND',
} as const;

export type TeamBattleErrorCodeType = typeof TeamBattleErrorCode[keyof typeof TeamBattleErrorCode];

/**
 * Structured error thrown by team battle service/route layer.
 * Extends AppError to integrate with the centralized error handling middleware.
 * Carries an HTTP status and machine-readable code so the route handler
 * can produce a consistent JSON response without ad-hoc formatting.
 */
export class TeamBattleError extends AppError {
  constructor(
    code: TeamBattleErrorCodeType,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(code, message, statusCode, details);
    this.name = 'TeamBattleError';
  }
}
