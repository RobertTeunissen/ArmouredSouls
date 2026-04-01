/**
 * Battle-specific error codes and error class.
 *
 * Provides structured, machine-readable error codes for all battle
 * simulation and management failure scenarios. Frontend consumers can switch on `code`
 * to display context-appropriate messages and recovery actions.
 *
 * @module errors/battleErrors
 */

import { AppError } from './AppError';

/** All battle error codes. */
export const BattleErrorCode = {
  BATTLE_NOT_FOUND: 'BATTLE_NOT_FOUND',
  INVALID_BATTLE_STATE: 'INVALID_BATTLE_STATE',
  ROBOT_NOT_ELIGIBLE: 'ROBOT_NOT_ELIGIBLE',
  BATTLE_ALREADY_COMPLETED: 'BATTLE_ALREADY_COMPLETED',
  BATTLE_SIMULATION_FAILED: 'BATTLE_SIMULATION_FAILED',
} as const;

export type BattleErrorCodeType = typeof BattleErrorCode[keyof typeof BattleErrorCode];

/**
 * Structured error thrown by battle service/route layer.
 * Extends AppError to integrate with the centralized error handling middleware.
 * Carries an HTTP status and machine-readable code so the route handler
 * can produce a consistent JSON response without ad-hoc formatting.
 */
export class BattleError extends AppError {
  constructor(
    code: BattleErrorCodeType,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(code, message, statusCode, details);
    this.name = 'BattleError';
  }
}
