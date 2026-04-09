/**
 * League-specific error codes and error class.
 *
 * Provides structured, machine-readable error codes for all league
 * management and ranking failure scenarios. Frontend consumers can switch on `code`
 * to display context-appropriate messages and recovery actions.
 *
 * @module errors/leagueErrors
 */

import { AppError } from './AppError';

/** All league error codes. */
export const LeagueErrorCode = {
  LEAGUE_NOT_FOUND: 'LEAGUE_NOT_FOUND',
  INVALID_LEAGUE_TIER: 'INVALID_LEAGUE_TIER',
  LEAGUE_INSTANCE_FULL: 'LEAGUE_INSTANCE_FULL',
  PROMOTION_BLOCKED: 'PROMOTION_BLOCKED',
  RELEGATION_BLOCKED: 'RELEGATION_BLOCKED',
  NO_ELIGIBLE_ROBOTS: 'NO_ELIGIBLE_ROBOTS',
} as const;

export type LeagueErrorCodeType = typeof LeagueErrorCode[keyof typeof LeagueErrorCode];

/**
 * Structured error thrown by league service/route layer.
 * Extends AppError to integrate with the centralized error handling middleware.
 * Carries an HTTP status and machine-readable code so the route handler
 * can produce a consistent JSON response without ad-hoc formatting.
 */
export class LeagueError extends AppError {
  constructor(
    code: LeagueErrorCodeType,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(code, message, statusCode, details);
    this.name = 'LeagueError';
  }
}
