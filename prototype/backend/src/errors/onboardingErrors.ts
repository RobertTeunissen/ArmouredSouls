/**
 * Onboarding-specific error codes and error class.
 *
 * Provides structured, machine-readable error codes for all onboarding
 * failure scenarios. Frontend consumers can switch on `code` to display
 * context-appropriate messages and recovery actions.
 *
 * @module errors/onboardingErrors
 */

/** All onboarding error codes. */
export const OnboardingErrorCode = {
  TUTORIAL_STATE_NOT_FOUND: 'TUTORIAL_STATE_NOT_FOUND',
  INVALID_STEP_TRANSITION: 'INVALID_STEP_TRANSITION',
  INVALID_STRATEGY: 'INVALID_STRATEGY',
  INVALID_STEP_RANGE: 'INVALID_STEP_RANGE',
  RESET_BLOCKED: 'RESET_BLOCKED',
  RESET_INVALID_CONFIRMATION: 'RESET_INVALID_CONFIRMATION',
  TUTORIAL_ALREADY_COMPLETED: 'TUTORIAL_ALREADY_COMPLETED',
  INVALID_CHOICES: 'INVALID_CHOICES',
  ONBOARDING_INTERNAL_ERROR: 'ONBOARDING_INTERNAL_ERROR',
} as const;

export type OnboardingErrorCodeType = typeof OnboardingErrorCode[keyof typeof OnboardingErrorCode];

/**
 * Structured error thrown by onboarding service/route layer.
 * Carries an HTTP status and machine-readable code so the route handler
 * can produce a consistent JSON response without ad-hoc formatting.
 */
export class OnboardingError extends Error {
  public readonly code: OnboardingErrorCodeType;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    code: OnboardingErrorCodeType,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(message);
    this.name = 'OnboardingError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
