/**
 * Tag-team-specific error codes and error class.
 *
 * Provides structured, machine-readable error codes for all tag-team
 * management and battle failure scenarios. Frontend consumers can switch on `code`
 * to display context-appropriate messages and recovery actions.
 *
 * @module errors/tagTeamErrors
 */

import { AppError } from './AppError';

/** All tag-team error codes. */
export const TagTeamErrorCode = {
  TAG_TEAM_NOT_FOUND: 'TAG_TEAM_NOT_FOUND',
  INVALID_TEAM_COMPOSITION: 'INVALID_TEAM_COMPOSITION',
  TEAM_NOT_ELIGIBLE: 'TEAM_NOT_ELIGIBLE',
  TAG_TEAM_LEAGUE_NOT_FOUND: 'TAG_TEAM_LEAGUE_NOT_FOUND',
} as const;

export type TagTeamErrorCodeType = typeof TagTeamErrorCode[keyof typeof TagTeamErrorCode];

/**
 * Structured error thrown by tag-team service/route layer.
 * Extends AppError to integrate with the centralized error handling middleware.
 * Carries an HTTP status and machine-readable code so the route handler
 * can produce a consistent JSON response without ad-hoc formatting.
 */
export class TagTeamError extends AppError {
  constructor(
    code: TagTeamErrorCodeType,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(code, message, statusCode, details);
    this.name = 'TagTeamError';
  }
}
