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
  /** A robots Goal_Target would exceed the profile's buildable Robot_Blueprints, slots 1…k without a gap (R3.7). */
  AUTOMATON_BLUEPRINTS_TOO_FEW: 'AUTOMATON_BLUEPRINTS_TOO_FEW',
  /** Team_Names do not have the count the Team_Rule needs (R3.6). */
  AUTOMATON_TEAM_NAMES_MISMATCH: 'AUTOMATON_TEAM_NAMES_MISMATCH',
  /** A Catalogue_Entry or admin blueprint/profile input fails the catalogue rules, or an export cannot be built (R10.1, R10.7). */
  AUTOMATON_CATALOGUE_INVALID: 'AUTOMATON_CATALOGUE_INVALID',
  /** No Automaton_Profile has this Catalogue_Key (404). */
  AUTOMATON_NOT_FOUND: 'AUTOMATON_NOT_FOUND',
  /** The profile has no Robot_Blueprint in this Blueprint_Slot (404). */
  AUTOMATON_BLUEPRINT_NOT_FOUND: 'AUTOMATON_BLUEPRINT_NOT_FOUND',
  /** A Catalogue_Key is already used by another Automaton_Profile (409). */
  AUTOMATON_KEY_EXISTS: 'AUTOMATON_KEY_EXISTS',
  /** The stable name is taken by a stable or another Automaton_Profile (409, R2.3, R3.8). */
  AUTOMATON_STABLE_NAME_TAKEN: 'AUTOMATON_STABLE_NAME_TAKEN',
  /** Activation: the username `automaton_{catalogueKey}` already exists (409, R2.3). */
  AUTOMATON_USERNAME_TAKEN: 'AUTOMATON_USERNAME_TAKEN',
  /** The operation needs a Draft_Automaton; the profile is active (409, R2.4, R2.6). */
  AUTOMATON_NOT_DRAFT: 'AUTOMATON_NOT_DRAFT',
  /** A live robot is linked to the Robot_Blueprint (409, R3.12). */
  AUTOMATON_BLUEPRINT_IN_PLAY: 'AUTOMATON_BLUEPRINT_IN_PLAY',
  /** The Blueprint_Slot is taken, or no slot from 1 to 11 is free (409, R3.1). */
  AUTOMATON_SLOT_TAKEN: 'AUTOMATON_SLOT_TAKEN',
  /** An uploaded Robot_Blueprint image failed validation or processing (400, R11.6). */
  AUTOMATON_IMAGE_INVALID: 'AUTOMATON_IMAGE_INVALID',
  /** No Strategy_Definition_File has this strategy key or `key.vN` (404, R6.6, R6.9). */
  AUTOMATON_STRATEGY_NOT_FOUND: 'AUTOMATON_STRATEGY_NOT_FOUND',
  /** No Strategy_Draft has this id (404, R6.13). */
  AUTOMATON_STRATEGY_DRAFT_NOT_FOUND: 'AUTOMATON_STRATEGY_DRAFT_NOT_FOUND',
  /** Another Strategy_Draft already has this key and version (409, R6.11). */
  AUTOMATON_STRATEGY_DRAFT_EXISTS: 'AUTOMATON_STRATEGY_DRAFT_EXISTS',
  /** The Strategy_Draft fails the definition schema or a builder rule; export or preview refused (400, R6.11, R6.14). */
  AUTOMATON_STRATEGY_DRAFT_INVALID: 'AUTOMATON_STRATEGY_DRAFT_INVALID',
  /** A Strategy_Version upgrade names a profile that is not on an older version of the strategy (409, R6.6). */
  AUTOMATON_UPGRADE_NOT_APPLICABLE: 'AUTOMATON_UPGRADE_NOT_APPLICABLE',
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
