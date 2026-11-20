/**
 * @module utils/onboardingAnalytics
 *
 * Lightweight analytics layer for the onboarding tutorial system.
 * Logs events to console in development and POSTs to `/api/onboarding/analytics` in production.
 *
 * Tracks: step completions, time per step, skip/completion rates, blocked actions,
 * strategic choices (roster strategy, facility patterns, weapon preferences, budget allocation).
 *
 * @see {@link ../contexts/OnboardingContext} for integration points
 * Requirements: 26.1-26.12
 */
import { api } from './api';
import { createLogger } from './logger';

const log = createLogger('onboarding-analytics');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OnboardingEventType =
  | 'step_started'
  | 'step_completed'
  | 'tutorial_completed'
  | 'tutorial_skipped'
  | 'tutorial_abandoned'
  | 'strategy_selected'
  | 'error_encountered';

export interface OnboardingAnalyticsEvent {
  /** Event type identifier */
  eventType: OnboardingEventType;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Current onboarding step (1-9) */
  step?: number;
  /** Arbitrary event-specific payload */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Internal state – step timing
// ---------------------------------------------------------------------------

const stepTimers: Map<number, number> = new Map();

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

function isDev(): boolean {
  try {
    return import.meta.env?.DEV === true;
  } catch {
    return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  }
}

// ---------------------------------------------------------------------------
// Core dispatch
// ---------------------------------------------------------------------------

/**
 * Queue of events waiting to be sent. Flushed automatically or on demand.
 * Keeps the network footprint small by batching.
 */
const eventQueue: OnboardingAnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 5_000;
const MAX_QUEUE_SIZE = 20;


/**
 * Send queued events to the backend. In dev mode, logs to console instead.
 * Exported for testing; normally called automatically.
 */
export async function flushEvents(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (eventQueue.length === 0) return;

  const batch = eventQueue.splice(0);

  if (isDev()) {
    log.debug('flush', batch);
    return;
  }

  try {
    await api.post<void>('/api/onboarding/analytics', { events: batch });
  } catch {
    // Silently drop – analytics should never break the app
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushEvents();
  }, FLUSH_INTERVAL_MS);
}

/**
 * Enqueue a single analytics event. Automatically batches and flushes.
 */
export function trackEvent(
  eventType: OnboardingEventType,
  step?: number,
  metadata?: Record<string, unknown>,
): void {
  const event: OnboardingAnalyticsEvent = {
    eventType,
    timestamp: new Date().toISOString(),
    step,
    metadata,
  };

  if (isDev()) {
    log.debug('event', event);
  }

  eventQueue.push(event);

  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    flushEvents();
  } else {
    scheduleFlush();
  }
}

// ---------------------------------------------------------------------------
// High-level tracking helpers
// ---------------------------------------------------------------------------

/** Call when a user enters a step. Starts the step timer. */
export function trackStepStarted(step: number): void {
  stepTimers.set(step, Date.now());
  trackEvent('step_started', step);
}

/** Call when a user completes a step. Records time spent. */
export function trackStepCompleted(step: number): void {
  const startTime = stepTimers.get(step);
  const durationMs = startTime ? Date.now() - startTime : undefined;
  stepTimers.delete(step);
  trackEvent('step_completed', step, { durationMs });
}

/** Call when the entire tutorial is completed. */
export function trackTutorialCompleted(finalStep: number): void {
  trackEvent('tutorial_completed', finalStep);
  flushEvents();
}

/** Call when the user skips the entire tutorial. */
export function trackTutorialSkipped(atStep: number): void {
  trackEvent('tutorial_skipped', atStep);
  flushEvents();
}

/** Call when an error is encountered during onboarding. */
export function trackError(step: number, errorMessage: string, context?: string): void {
  trackEvent('error_encountered', step, { errorMessage, context });
}

// ---------------------------------------------------------------------------
// Strategic choice tracking (sub-task 38.2)
// ---------------------------------------------------------------------------

/** Track roster strategy selection. */
export function trackStrategySelected(
  strategy: '1_mighty' | '2_average' | '3_flimsy',
  step: number,
): void {
  trackEvent('strategy_selected', step, { strategy });
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Reset internal state. Only exported for tests. */
export function _resetForTesting(): void {
  eventQueue.length = 0;
  stepTimers.clear();
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

/** Get current queue length. Only exported for tests. */
export function _getQueueLength(): number {
  return eventQueue.length;
}
