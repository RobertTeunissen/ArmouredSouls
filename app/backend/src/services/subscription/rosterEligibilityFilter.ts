/**
 * Roster Eligibility Filter
 *
 * Typed predicate that, for a given Subscribable Event and a given Stable's
 * robot count, returns whether a robot in that Stable can participate in that event.
 *
 * v1 rules:
 * - `league_1v1` and `tournament_1v1` always eligible (minRobots: 1)
 * - `koth` always eligible (minRobots: 1)
 * - `tag_team` requires the Stable to own ≥ 2 robots
 *
 * Used by the Onboarding Subscription Picker, the seeded user generator's
 * random subscription pick, and the subscription management surface.
 *
 * @module services/subscription/rosterEligibilityFilter
 */

import { SubscribableEventType, getRegisteredEvents } from './eventRegistry';

// ── Types ────────────────────────────────────────────────────────────

interface EligibilityRule {
  eventType: SubscribableEventType;
  /** Minimum robots the Stable must own for this event to be eligible. */
  minRobots: number;
  /** Human-readable reason when filtered out. */
  reason: string;
}

export interface EligibleEvent {
  type: SubscribableEventType;
  label: string;
  eligible: boolean;
  reason?: string;
}

// ── Rules ────────────────────────────────────────────────────────────

const ELIGIBILITY_RULES: EligibilityRule[] = [
  { eventType: 'league_1v1', minRobots: 1, reason: '' },
  { eventType: 'tournament_1v1', minRobots: 1, reason: '' },
  { eventType: 'koth', minRobots: 1, reason: '' },
  { eventType: 'tag_team', minRobots: 2, reason: 'Tag Team requires 2 or more robots in your Stable' },
  { eventType: 'league_2v2', minRobots: 2, reason: '2v2 League requires 2 or more robots in your Stable' },
  { eventType: 'league_3v3', minRobots: 3, reason: '3v3 League requires 3 or more robots in your Stable' },
  { eventType: 'tournament_2v2', minRobots: 2, reason: '2v2 Tournament requires 2 or more robots in your Stable' },
  { eventType: 'tournament_3v3', minRobots: 3, reason: '3v3 Tournament requires 3 or more robots in your Stable' },
];

// ── Public API ───────────────────────────────────────────────────────

/**
 * Filter the Event Registry by the Stable's robot count.
 * Returns all registered events with their eligibility status.
 */
export function getEligibleEvents(robotCount: number): EligibleEvent[] {
  const registered = getRegisteredEvents();
  return registered.map((event) => {
    const rule = ELIGIBILITY_RULES.find((r) => r.eventType === event.type);
    const eligible = !rule || robotCount >= rule.minRobots;
    return {
      type: event.type,
      label: event.label,
      eligible,
      reason: eligible ? undefined : rule?.reason,
    };
  });
}
