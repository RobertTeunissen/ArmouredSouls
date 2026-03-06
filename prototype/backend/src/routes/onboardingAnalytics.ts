/**
 * @module routes/onboardingAnalytics
 *
 * Express router for onboarding analytics endpoints.
 * Receives batched analytics events from the frontend and stores them via the analytics service.
 *
 * @see {@link ../services/onboardingAnalyticsService} for event storage
 * Requirements: 26.1-26.12
 */
import express from 'express';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { recordEvents, OnboardingAnalyticsEvent } from '../services/onboardingAnalyticsService';
import logger from '../config/logger';

const router = express.Router();

/**
 * POST /api/onboarding/analytics
 *
 * Receive a batch of onboarding analytics events from the frontend.
 *
 * **Request body:**
 * - `events` (array, required) — Array of analytics event objects
 *   - `eventType` (string, required) — Event type identifier
 *   - `timestamp` (string, required) — ISO-8601 timestamp
 *   - `step` (number, optional) — Current onboarding step (1-9)
 *   - `metadata` (object, optional) — Event-specific payload
 *
 * **Responses:**
 * - `200 OK` — `{ success: true, data: { received: number } }`
 * - `400 Bad Request` — Invalid or missing events array
 * - `401 Unauthorized` — Not authenticated
 * - `500 Internal Server Error` — Server error
 */
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request body must contain a non-empty "events" array',
      });
    }

    // Basic validation: each event must have eventType and timestamp
    const validEvents: OnboardingAnalyticsEvent[] = [];
    for (const event of events) {
      if (typeof event.eventType !== 'string' || typeof event.timestamp !== 'string') {
        continue; // Skip malformed events silently
      }
      validEvents.push({
        eventType: event.eventType,
        timestamp: event.timestamp,
        step: typeof event.step === 'number' ? event.step : undefined,
        metadata: typeof event.metadata === 'object' && event.metadata !== null
          ? event.metadata
          : undefined,
      });
    }

    if (validEvents.length > 0) {
      recordEvents(userId, validEvents);
    }

    res.json({
      success: true,
      data: { received: validEvents.length },
    });
  } catch (error) {
    logger.error('Onboarding analytics error', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.userId,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/onboarding/analytics/summary
 *
 * Get aggregated onboarding analytics summary.
 * Admin-only endpoint for viewing analytics dashboard.
 *
 * **Responses:**
 * - `200 OK` — `{ success: true, data: { totalEvents, uniqueUsers, completions, skips, stepCompletionCounts } }`
 * - `401 Unauthorized` — Not authenticated
 * - `403 Forbidden` — Not admin
 * - `500 Internal Server Error` — Server error
 */
router.get('/summary', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { getSummary } = await import('../services/onboardingAnalyticsService');
    const summary = getSummary();

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('Onboarding analytics summary error', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.userId,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
