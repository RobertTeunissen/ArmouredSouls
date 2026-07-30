/**
 * Event Registry
 *
 * Runtime singleton registry for all subscribable battle events.
 * Populated at app startup before the cycle scheduler initialises.
 * New event modes register themselves once via `registerSubscribableEvent`
 * and become subscribable through the Booking Office facility system.
 *
 * There are deliberately no per-event behaviour hooks here. Every event
 * follows the same subscription rule (see `subscriptionService`), so a
 * registration is nothing more than an identifier and a display label.
 *
 * @module services/subscription/eventRegistry
 */

// ── Types ────────────────────────────────────────────────────────────

/**
 * Every subscribable event, in display order.
 *
 * This tuple is the single source of truth: the `SubscribableEventType` union is
 * derived from it, and Zod schemas validate against it, so adding a mode in one
 * place makes it known everywhere.
 */
export const SUBSCRIBABLE_EVENT_TYPES = [
  'league_1v1',
  'league_2v2',
  'league_3v3',
  'tag_team',
  'koth',
  'grand_melee',
  'tournament_1v1',
  'tournament_2v2',
  'tournament_3v3',
] as const;

/** Stable string identifiers for all subscribable events. */
export type SubscribableEventType = (typeof SUBSCRIBABLE_EVENT_TYPES)[number];

export interface SubscribableEventDefinition {
  type: SubscribableEventType;
  label: string;
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

// ── Test Helpers ─────────────────────────────────────────────────────

/**
 * Clear the registry. Only for use in tests to reset state between runs.
 * @internal
 */
export function _clearRegistryForTesting(): void {
  registry.clear();
}
