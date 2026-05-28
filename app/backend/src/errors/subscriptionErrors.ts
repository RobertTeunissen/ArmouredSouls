/**
 * Subscription-specific error codes and error class.
 *
 * Provides structured, machine-readable error codes for all event subscription
 * management failure scenarios. Frontend consumers can switch on `code`
 * to display context-appropriate messages and recovery actions.
 *
 * @module errors/subscriptionErrors
 */

import { AppError } from './AppError';

/** All subscription error codes. */
export const SubscriptionErrorCode = {
  SUBSCRIPTION_CAP_EXCEEDED: 'SUBSCRIPTION_CAP_EXCEEDED',
  SUBSCRIPTION_DUPLICATE: 'SUBSCRIPTION_DUPLICATE',
  SUBSCRIPTION_UNKNOWN_EVENT: 'SUBSCRIPTION_UNKNOWN_EVENT',
  EVENT_SUBSCRIPTION_LOCKED: 'EVENT_SUBSCRIPTION_LOCKED',
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  ACCESS_DENIED: 'ACCESS_DENIED',
} as const;

export type SubscriptionErrorCodeType = typeof SubscriptionErrorCode[keyof typeof SubscriptionErrorCode];

/**
 * Structured error thrown by subscription service/route layer.
 * Extends AppError to integrate with the centralized error handling middleware.
 * Carries an HTTP status and machine-readable code so the route handler
 * can produce a consistent JSON response without ad-hoc formatting.
 */
export class SubscriptionError extends AppError {
  constructor(
    code: SubscriptionErrorCodeType,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(code, message, statusCode, details);
    this.name = 'SubscriptionError';
  }
}
