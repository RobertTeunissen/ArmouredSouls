/**
 * Deterministic request keys for Automaton charged actions (Spec #55, R7.7,
 * design §9.3).
 *
 * The key is passed as `requestKey` to the domain services, which derive the
 * `financialEventId` through `createEconomicRequestIdentity`. A replay with
 * the same key and facts returns the original result; a different action under
 * the same key fails closed with `EVENT_CONFLICT`.
 *
 * Separator: design §9.3 writes the key with `:`. The financial event id is
 * itself `:`-joined and `buildEconomicOperationEventId` rejects a request key
 * containing `:` (`INVALID_EVENT_IDENTITY`), so the same components are joined
 * with `.` instead.
 */
import type { AutomatonTurnTrigger } from '../../../generated/prisma';

export interface AutomatonRequestKeyParts {
  profileId: number;
  seasonNumber: number;
  trigger: AutomatonTurnTrigger;
  /** Turn_Slot (design D8). */
  slot: number;
  /** Turn_Record attempt, 1-based. */
  attempt: number;
  /** Charged step within the attempt, 1-based. */
  ordinal: number;
}

function assertNonNegativeInteger(value: number, label: string, min: number): void {
  if (!Number.isInteger(value) || value < min) {
    throw new RangeError(`${label} must be an integer ≥ ${min}`);
  }
}

/** `automaton.{profileId}.s{seasonNumber}.{trigger}.{slot}.a{attempt}.{ordinal}` */
export function buildAutomatonRequestKey(parts: AutomatonRequestKeyParts): string {
  assertNonNegativeInteger(parts.profileId, 'profileId', 1);
  assertNonNegativeInteger(parts.seasonNumber, 'seasonNumber', 0);
  assertNonNegativeInteger(parts.slot, 'slot', 0);
  assertNonNegativeInteger(parts.attempt, 'attempt', 1);
  assertNonNegativeInteger(parts.ordinal, 'ordinal', 1);
  return [
    'automaton',
    String(parts.profileId),
    `s${parts.seasonNumber}`,
    parts.trigger,
    String(parts.slot),
    `a${parts.attempt}`,
    String(parts.ordinal),
  ].join('.');
}
