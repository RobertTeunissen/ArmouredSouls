/**
 * Automaton-specific error codes and error class (Spec #55).
 *
 * Further admin endpoint codes are added by the tasks that introduce those
 * endpoints. `AUTOMATON_ACCOUNT_LOCKED` lives in `authErrors.ts` because
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
  /**
   * A Turn_Step was requested while a Serialized_Cycle_Cutover is in progress
   * (R7.5). Defensive: every call site runs after the cutover completed.
   */
  AUTOMATON_CUTOVER_IN_PROGRESS: 'AUTOMATON_CUTOVER_IN_PROGRESS',
  /** The profile's stored Team_Names or Event_Order fail their shape; the turn fails. */
  AUTOMATON_PROFILE_INVALID: 'AUTOMATON_PROFILE_INVALID',
  /** An executed action changed nothing (planner/executor defect); the turn fails instead of looping. */
  AUTOMATON_NO_PROGRESS: 'AUTOMATON_NO_PROGRESS',
  /** A robots Goal_Target would exceed the profile's number of Robot_Blueprints (R3.7). */
  AUTOMATON_BLUEPRINTS_TOO_FEW: 'AUTOMATON_BLUEPRINTS_TOO_FEW',
  /** Team_Names do not have the count the Team_Rule needs (R3.6). */
  AUTOMATON_TEAM_NAMES_MISMATCH: 'AUTOMATON_TEAM_NAMES_MISMATCH',
  /** A Catalogue_Entry or admin blueprint/profile input fails the catalogue rules, or an export cannot be built (R10.1, R10.7). */
  AUTOMATON_CATALOGUE_INVALID: 'AUTOMATON_CATALOGUE_INVALID',
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
