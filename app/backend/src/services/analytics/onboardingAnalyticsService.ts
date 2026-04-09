/**
 * @module services/onboardingAnalyticsService
 *
 * Lightweight in-memory analytics service for onboarding events.
 * Stores events received from the frontend and exposes simple aggregation helpers.
 *
 * This is intentionally minimal — a tracking layer, not a full analytics platform.
 * Events are stored in memory and logged via the application logger.
 * A future iteration could persist events to the database or an external analytics service.
 *
 * Requirements: 26.1-26.12
 */
import logger from '../../config/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnboardingAnalyticsEvent {
  eventType: string;
  timestamp: string;
  step?: number;
  metadata?: Record<string, unknown>;
}

export interface StoredEvent extends OnboardingAnalyticsEvent {
  userId: number;
  receivedAt: Date;
}

// ---------------------------------------------------------------------------
// In-memory store (capped to prevent unbounded growth)
// ---------------------------------------------------------------------------

const MAX_STORED_EVENTS = 10_000;
const events: StoredEvent[] = [];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record a batch of analytics events from a single user.
 * Events are stored in memory and logged at info level.
 */
export function recordEvents(userId: number, batch: OnboardingAnalyticsEvent[]): void {
  const now = new Date();

  for (const event of batch) {
    const stored: StoredEvent = {
      ...event,
      userId,
      receivedAt: now,
    };

    events.push(stored);

    logger.info('Onboarding analytics event', {
      userId,
      eventType: event.eventType,
      step: event.step,
      metadata: event.metadata,
    });
  }

  // Cap the store to prevent memory leaks
  if (events.length > MAX_STORED_EVENTS) {
    events.splice(0, events.length - MAX_STORED_EVENTS);
  }
}

/**
 * Get all stored events. Optionally filter by userId.
 */
export function getEvents(userId?: number): StoredEvent[] {
  if (userId !== undefined) {
    return events.filter((e) => e.userId === userId);
  }
  return [...events];
}

/**
 * Get a simple summary of onboarding funnel metrics.
 */
export function getSummary(): {
  totalEvents: number;
  uniqueUsers: number;
  completions: number;
  skips: number;
  stepCompletionCounts: Record<number, number>;
} {
  const uniqueUsers = new Set(events.map((e) => e.userId)).size;
  const completions = events.filter((e) => e.eventType === 'tutorial_completed').length;
  const skips = events.filter((e) => e.eventType === 'tutorial_skipped').length;

  const stepCompletionCounts: Record<number, number> = {};
  for (const e of events) {
    if (e.eventType === 'step_completed' && e.step !== undefined) {
      stepCompletionCounts[e.step] = (stepCompletionCounts[e.step] || 0) + 1;
    }
  }

  return {
    totalEvents: events.length,
    uniqueUsers,
    completions,
    skips,
    stepCompletionCounts,
  };
}

/**
 * Clear all stored events. Exported for testing.
 */
export function clearEvents(): void {
  events.length = 0;
}
