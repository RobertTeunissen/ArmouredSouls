/**
 * @module routes/onboardingAnalytics
 *
 * Express router for onboarding analytics endpoints.
 * Receives batched analytics events from the frontend and stores them via the analytics service.
 *
 * @see {@link ../services/onboardingAnalyticsService} for event storage
 * Requirements: 26.1-26.12
 */
import express, { Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { recordEvents, OnboardingAnalyticsEvent } from '../services/analytics/onboardingAnalyticsService';
import { AppError } from '../errors';
import { validateRequest } from '../middleware/schemaValidator';

const router = express.Router();

// --- Zod schemas for onboarding analytics routes ---

const analyticsEventsBodySchema = z.object({
  events: z.array(z.object({
    eventType: z.string().min(1).max(100),
    timestamp: z.string().min(1).max(50),
    step: z.number().int().min(1).max(9).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })).min(1).max(100),
});

/**
 * POST /api/onboarding/analytics
 *
 * Receive a batch of onboarding analytics events from the frontend.
 */
router.post('/', authenticateToken, validateRequest({ body: analyticsEventsBodySchema }), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { events } = req.body;

  if (!Array.isArray(events) || events.length === 0) {
    throw new AppError('INVALID_EVENTS', 'Request body must contain a non-empty "events" array', 400);
  }

  const validEvents: OnboardingAnalyticsEvent[] = [];
  for (const event of events) {
    if (typeof event.eventType !== 'string' || typeof event.timestamp !== 'string') {
      continue;
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
});

/**
 * GET /api/onboarding/analytics/summary
 *
 * Get aggregated onboarding analytics summary. Admin-only.
 */
router.get('/summary', authenticateToken, requireAdmin, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const { getSummary } = await import('../services/analytics/onboardingAnalyticsService');
  const summary = getSummary();

  res.json({
    success: true,
    data: summary,
  });
});

export default router;
