/**
 * Automaton-specific error codes and error class (Spec #55).
 *
 * The admin endpoint codes (`AUTOMATON_BLUEPRINTS_TOO_FEW`,
 * `AUTOMATON_TEAM_NAMES_MISMATCH`, …) are added by the tasks that introduce
 * those endpoints. `AUTOMATON_ACCOUNT_LOCKED` lives in `authErrors.ts` because
 * the auth paths raise it.
 *
 * @module errors/automatonErrors
 */
import { AppError } from './AppError';

/** All Automaton error codes. */
export const AutomatonErrorCode = {
  /**
   * A Robot_Blueprint names a weapon that is not in the weapon catalogue at
   * turn time. The turn fails with this code and raises an alert (R7.8).
   */
  AUTOMATON_WEAPON_UNKNOWN: 'AUTOMATON_WEAPON_UNKNOWN',
} as const;

export type AutomatonErrorCodeType = typeof AutomatonErrorCode[keyof typeof AutomatonErrorCode];

/**
 * Structured error thrown by the Automaton engine and admin services. Extends
 * AppError so the centralized error middleware produces the standard
 * `{ error, code, details? }` response.
 */
export class AutomatonError extends AppError {
  constructor(code: AutomatonErrorCodeType, message: string, statusCode = 400, details?: unknown) {
    super(code, message, statusCode, details);
    this.name = 'AutomatonError';
  }
}
