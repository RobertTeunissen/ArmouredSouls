/**
 * Tournament-specific error codes and error class.
 *
 * Provides structured, machine-readable error codes for all tournament
 * management and execution failure scenarios. Frontend consumers can switch on `code`
 * to display context-appropriate messages and recovery actions.
 *
 * @module errors/tournamentErrors
 */

import { AppError } from './AppError';

/** All tournament error codes. */
export const TournamentErrorCode = {
  TOURNAMENT_NOT_FOUND: 'TOURNAMENT_NOT_FOUND',
  TOURNAMENT_ALREADY_COMPLETED: 'TOURNAMENT_ALREADY_COMPLETED',
  TOURNAMENT_NOT_ACTIVE: 'TOURNAMENT_NOT_ACTIVE',
  INSUFFICIENT_PARTICIPANTS: 'INSUFFICIENT_PARTICIPANTS',
  ROUND_NOT_READY: 'ROUND_NOT_READY',
  INVALID_TOURNAMENT_STATE: 'INVALID_TOURNAMENT_STATE',
  MATCH_MISSING_ROBOTS: 'MATCH_MISSING_ROBOTS',
  INVALID_MATCH_STATE: 'INVALID_MATCH_STATE',
  BATTLE_RECORD_FAILED: 'BATTLE_RECORD_FAILED',
} as const;

export type TournamentErrorCodeType = typeof TournamentErrorCode[keyof typeof TournamentErrorCode];

/**
 * Structured error thrown by tournament service/route layer.
 * Extends AppError to integrate with the centralized error handling middleware.
 * Carries an HTTP status and machine-readable code so the route handler
 * can produce a consistent JSON response without ad-hoc formatting.
 */
export class TournamentError extends AppError {
  constructor(
    code: TournamentErrorCodeType,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(code, message, statusCode, details);
    this.name = 'TournamentError';
  }
}
