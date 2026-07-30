/**
 * Zod schemas for the subscription routes.
 *
 * Kept in their own module so tests can import the real schemas instead of
 * re-declaring them. The previous validation test carried its own copy, which
 * meant it happily kept asserting `z.string().max(30)` after the route had moved
 * to a registry-backed enum — a passing test proving nothing.
 *
 * @module routes/schemas/subscriptionSchemas
 */

import { z } from 'zod';
import { positiveIntParam } from '../../utils/securityValidation';
import { SUBSCRIBABLE_EVENT_TYPES } from '../../services/subscription/eventRegistry';

export const robotIdParamSchema = z.object({
  robotId: positiveIntParam,
});

/**
 * Validated against the event registry rather than a loose string, so an unknown
 * mode is rejected at the boundary instead of deep inside the service.
 */
export const eventTypeSchema = z.enum(SUBSCRIBABLE_EVENT_TYPES);

export const subscribeBodySchema = z.object({
  eventType: eventTypeSchema,
});

/**
 * Bulk save. The array is bounded by the number of events that exist, which
 * doubles as the DoS control — a request cannot ask for more work than the game
 * has modes, however large a body it sends.
 */
export const setSubscriptionsBodySchema = z.object({
  eventTypes: z.array(eventTypeSchema).max(SUBSCRIBABLE_EVENT_TYPES.length),
});

export const adminAnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional(),
});
