/**
 * @module services/onboardingAnalyticsService
 *
 * Onboarding events received from the frontend are written to the application
 * log (one info line per event). The log is the only record; nothing is stored.
 *
 * Requirements: 26.1-26.12
 */
import logger from '../../config/logger';

export interface OnboardingEventRecord {
  eventType: string;
  timestamp: string;
  step?: number;
  metadata?: Record<string, unknown>;
}

/** Log a batch of onboarding events from a single user. */
export function recordEvents(userId: number, batch: OnboardingEventRecord[]): void {
  for (const event of batch) {
    logger.info('Onboarding analytics event', {
      userId,
      eventType: event.eventType,
      step: event.step,
      metadata: event.metadata,
    });
  }
}
