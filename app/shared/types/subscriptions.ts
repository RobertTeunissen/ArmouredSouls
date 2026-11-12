/**
 * Wire contracts for the Booking Office (`/api/subscriptions/*`, backend
 * `services/subscription`).
 */

/**
 * Subscribable event identifiers (`SUBSCRIBABLE_EVENT_TYPES` in backend
 * `services/subscription/eventRegistry.ts` must satisfy it).
 */
export type SubscribableEventType =
  | 'league_1v1'
  | 'league_2v2'
  | 'league_3v3'
  | 'tag_team'
  | 'koth'
  | 'tournament_1v1'
  | 'tournament_2v2'
  | 'tournament_3v3'
  | 'grand_melee';

/** One robot's row of `GET /api/subscriptions/overview`. */
export interface StableOverviewRobot {
  robotId: number;
  robotName: string;
  subscriptions: { eventType: string; status: string }[];
  /** Events this robot still owes a match to: the slot is not free yet. */
  heldSlots: string[];
  cap: number;
}

/** `GET /api/subscriptions/overview`: the stable-level matrix. */
export interface StableOverview {
  robots: StableOverviewRobot[];
  registeredEvents: { type: string; label: string }[];
  bookingOfficeLevel: number;
  /** Next moment each event books matches, ISO-8601 UTC, keyed by event type. */
  nextSchedulingMoments: Record<string, string>;
}

/** Outcome of a subscription change, single or bulk. */
export interface SubscriptionChangeResult {
  added: string[];
  removed: string[];
  /** Slots still occupied by a booked match after the change. */
  heldSlots: string[];
  /** Slots occupied afterwards: subscriptions plus held slots. */
  occupiedCount: number;
  cap: number;
  level: number;
}

/**
 * Response of the subscribe, unsubscribe and replace-set routes. Subscribe and
 * replace also carry `achievementUnlocks`, which the toast subscriber reads.
 */
export interface SubscriptionChangeResponse extends SubscriptionChangeResult {
  success: true;
  message?: string;
}

/** One event of `GET /api/subscriptions/registry`, with this stable's eligibility. */
export interface EligibleEvent {
  type: SubscribableEventType;
  label: string;
  eligible: boolean;
  reason?: string;
}

export interface RegistryResponse {
  events: EligibleEvent[];
}
