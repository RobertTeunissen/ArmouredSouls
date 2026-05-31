/**
 * Event Registry
 *
 * Runtime singleton registry for all subscribable battle events.
 * Populated at app startup before the cycle scheduler initialises.
 * New event modes register themselves once via `registerSubscribableEvent`
 * and become subscribable through the Booking Office facility system.
 *
 * @module services/subscription/eventRegistry
 */

// ── Types ────────────────────────────────────────────────────────────

/** Stable string identifiers for all subscribable events. */
export type SubscribableEventType = 'league_1v1' | 'tournament_1v1' | 'tag_team' | 'koth' | 'league_2v2' | 'league_3v3';

export interface SubscribableEventDefinition {
  type: SubscribableEventType;
  label: string;
  /** Returns true if the given robot has an active obligation preventing unsubscribe. */
  lockingPredicate: (robotId: number) => Promise<boolean>;
}

// ── Registry Singleton ───────────────────────────────────────────────

/** Runtime registry — populated at app startup. */
const registry = new Map<SubscribableEventType, SubscribableEventDefinition>();

// ── Public API ───────────────────────────────────────────────────────

/**
 * Register a subscribable event. Called once per event type at startup.
 * Throws if the event type is already registered (developer error).
 */
export function registerSubscribableEvent(def: SubscribableEventDefinition): void {
  if (registry.has(def.type)) {
    throw new Error(`[EventRegistry] Duplicate registration for event type: ${def.type}`);
  }
  registry.set(def.type, def);
}

/** Get all registered events (for UI rendering). */
export function getRegisteredEvents(): SubscribableEventDefinition[] {
  return Array.from(registry.values());
}

/** Get a single event definition. Returns undefined if not registered. */
export function getEventDefinition(type: string): SubscribableEventDefinition | undefined {
  return registry.get(type as SubscribableEventType);
}

/** Check if a type is a valid registered event. */
export function isRegisteredEvent(type: string): type is SubscribableEventType {
  return registry.has(type as SubscribableEventType);
}

/** Get the locking predicate for an event type. Throws if not registered. */
export function getLockingPredicate(type: SubscribableEventType): (robotId: number) => Promise<boolean> {
  const def = registry.get(type);
  if (!def) throw new Error(`[EventRegistry] Unknown event type: ${type}`);
  return def.lockingPredicate;
}

// ── Test Helpers ─────────────────────────────────────────────────────

/**
 * Clear the registry. Only for use in tests to reset state between runs.
 * @internal
 */
export function _clearRegistryForTesting(): void {
  registry.clear();
}
