/**
 * @module routes/onboarding
 *
 * Express router for onboarding/tutorial endpoints.
 * Manages tutorial state, progression, and account reset functionality.
 *
 * @see {@link ../services/onboardingService} for tutorial state management
 * @see {@link ../services/resetService} for account reset logic
 */
import express, { Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  getTutorialState,
  initializeTutorialState,
  updateTutorialState,
  completeTutorial,
  skipTutorial,
  updatePlayerChoices,
  OnboardingChoices,
} from '../services/onboarding/onboardingService';
import { OnboardingError, OnboardingErrorCode } from '../errors/onboardingErrors';
import {
  validateResetEligibility,
  performAccountReset,
} from '../services/common/resetService';
import onboardingAnalyticsRouter from './onboardingAnalytics';
import logger from '../config/logger';
import { securityMonitor } from '../services/security/securityMonitor';

const router = express.Router();

/**
 * Strict rate limiter for account reset endpoints.
 * 3 requests per hour per authenticated user — resets are heavy DB operations.
 */
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    return `reset:${authReq.user?.userId?.toString() || req.ip || 'unknown'}`;
  },
  handler: (req, res) => {
    const authReq = req as AuthRequest;
    if (authReq.user?.userId) {
      securityMonitor.trackRateLimitViolation(authReq.user.userId, req.originalUrl);
    }
    res.status(429).json({
      error: 'Too many reset attempts. Try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 3600,
    });
  },
});

/**
 * Shared error handler for onboarding routes.
 * Produces a consistent JSON envelope with machine-readable `code`.
 */
function handleOnboardingError(
  res: Response,
  error: unknown,
  context: string,
  userId?: number,
): void {
  if (error instanceof OnboardingError) {
    logger.warn(`${context}: ${error.message}`, {
      code: error.code,
      userId,
      details: error.details,
    });
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
      ...(error.details !== undefined && { details: error.details }),
    });
    return;
  }

  logger.error(context, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    userId,
  });
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: OnboardingErrorCode.ONBOARDING_INTERNAL_ERROR,
  });
}

/**
 * GET /api/onboarding/state
 *
 * Get the current tutorial state for the authenticated user.
 * Returns onboarding progress, current step, strategy choice, and player choices.
 *
 * **Responses:**
 * - `200 OK` — `{ success: true, data: TutorialState }`
 * - `401 Unauthorized` — Not authenticated
 * - `404 Not Found` — Tutorial state not found
 * - `500 Internal Server Error` — Database error
 *
 * @example
 * GET /api/onboarding/state
 * Authorization: Bearer <token>
 * // → 200 { success: true, data: { currentStep: 3, strategy: "2_average", ... } }
 *
 * Requirements: 1.3, 1.4
 */
router.get('/state', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    let state = await getTutorialState(userId);

    // Auto-initialize if state not found (defensive recovery)
    if (!state) {
      logger.info('Auto-initializing tutorial state for user', { userId });
      state = await initializeTutorialState(userId);
    }

    res.json({
      success: true,
      data: {
        currentStep: state.onboardingStep,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        onboardingSkipped: state.onboardingSkipped,
        strategy: state.onboardingStrategy,
        choices: state.onboardingChoices,
        startedAt: state.onboardingStartedAt,
        completedAt: state.onboardingCompletedAt,
      },
    });
  } catch (error) {
    handleOnboardingError(res, error, 'Get onboarding state error', req.user?.userId);
  }
});

/**
 * POST /api/onboarding/state
 *
 * Update the tutorial state for the authenticated user.
 * Allows updating current step, strategy, and player choices.
 *
 * **Request body:**
 * - `step` (number, optional) — New step number (1-9)
 * - `strategy` (string, optional) — Roster strategy ("1_mighty", "2_average", "3_flimsy")
 * - `choices` (object, optional) — Player choices to merge with existing choices
 *
 * **Responses:**
 * - `200 OK` — `{ success: true, data: TutorialState }`
 * - `400 Bad Request` — Invalid step number or strategy
 * - `401 Unauthorized` — Not authenticated
 * - `500 Internal Server Error` — Database error
 *
 * @example
 * POST /api/onboarding/state
 * { "step": 2, "strategy": "2_average" }
 * // → 200 { success: true, data: { currentStep: 2, strategy: "2_average", ... } }
 *
 * Requirements: 1.3, 2.3, 2.6, 2.7
 */
router.post('/state', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { step, strategy, choices } = req.body;

    // Validate step if provided (basic type check; service validates transitions)
    if (step !== undefined) {
      if (typeof step !== 'number' || step < 1 || step > 9) {
        throw new OnboardingError(
          OnboardingErrorCode.INVALID_STEP_RANGE,
          'Step must be a number between 1 and 9',
        );
      }
    }

    // Validate strategy if provided
    if (strategy !== undefined) {
      const validStrategies = ['1_mighty', '2_average', '3_flimsy'];
      if (!validStrategies.includes(strategy)) {
        throw new OnboardingError(
          OnboardingErrorCode.INVALID_STRATEGY,
          'Invalid strategy. Must be one of: 1_mighty, 2_average, 3_flimsy',
        );
      }
    }

    // Update tutorial state
    const updates: Record<string, unknown> = {};
    if (step !== undefined) {
      updates.onboardingStep = step;
    }
    if (strategy !== undefined) {
      updates.onboardingStrategy = strategy;
    }

    let state;
    if (Object.keys(updates).length > 0) {
      state = await updateTutorialState(userId, updates);
    }

    // Update choices if provided
    if (choices && typeof choices === 'object') {
      state = await updatePlayerChoices(userId, choices as Partial<OnboardingChoices>);
    }

    // If no updates, just get current state
    if (!state) {
      state = await getTutorialState(userId);
    }

    if (!state) {
      throw new OnboardingError(
        OnboardingErrorCode.TUTORIAL_STATE_NOT_FOUND,
        'Tutorial state not found',
        404,
      );
    }

    res.json({
      success: true,
      data: {
        currentStep: state.onboardingStep,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        onboardingSkipped: state.onboardingSkipped,
        strategy: state.onboardingStrategy,
        choices: state.onboardingChoices,
        startedAt: state.onboardingStartedAt,
        completedAt: state.onboardingCompletedAt,
      },
    });
  } catch (error) {
    handleOnboardingError(res, error, 'Update onboarding state error', req.user?.userId);
  }
});

/**
 * POST /api/onboarding/complete
 *
 * Mark the tutorial as completed for the authenticated user.
 * Sets hasCompletedOnboarding to true and records completion timestamp.
 *
 * **Responses:**
 * - `200 OK` — `{ success: true, data: { message: "Tutorial completed" } }`
 * - `401 Unauthorized` — Not authenticated
 * - `500 Internal Server Error` — Database error
 *
 * @example
 * POST /api/onboarding/complete
 * // → 200 { success: true, data: { message: "Tutorial completed" } }
 *
 * Requirements: 1.5, 2.3, 13.15
 */
router.post('/complete', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    await completeTutorial(userId);

    logger.info('Tutorial completed', { userId });

    res.json({
      success: true,
      data: {
        message: 'Tutorial completed',
      },
    });
  } catch (error) {
    handleOnboardingError(res, error, 'Complete tutorial error', req.user?.userId);
  }
});

/**
 * POST /api/onboarding/skip
 *
 * Skip the tutorial for the authenticated user.
 * Marks onboarding as completed and skipped.
 *
 * **Responses:**
 * - `200 OK` — `{ success: true, data: { message: "Tutorial skipped" } }`
 * - `401 Unauthorized` — Not authenticated
 * - `500 Internal Server Error` — Database error
 *
 * @example
 * POST /api/onboarding/skip
 * // → 200 { success: true, data: { message: "Tutorial skipped" } }
 *
 * Requirements: 1.6
 */
router.post('/skip', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    await skipTutorial(userId);

    logger.info('Tutorial skipped', { userId });

    res.json({
      success: true,
      data: {
        message: 'Tutorial skipped',
      },
    });
  } catch (error) {
    handleOnboardingError(res, error, 'Skip tutorial error', req.user?.userId);
  }
});

/**
 * POST /api/onboarding/reset-account
 *
 * Reset the user's account to starting state.
 * Deletes all robots, weapons, facilities, and resets credits to ₡3,000,000.
 * Validates that no scheduled battles exist before allowing reset.
 *
 * **Request body:**
 * - `confirmation` (string) — Must be "RESET" to confirm
 * - `reason` (string, optional) — Reason for reset (for analytics)
 *
 * **Responses:**
 * - `200 OK` — `{ success: true, data: { message: "Account reset successfully" } }`
 * - `400 Bad Request` — Invalid confirmation or reset blocked by constraints
 * - `401 Unauthorized` — Not authenticated
 * - `500 Internal Server Error` — Database error
 *
 * @example
 * POST /api/onboarding/reset-account
 * { "confirmation": "RESET", "reason": "Made poor initial choices" }
 * // → 200 { success: true, data: { message: "Account reset successfully" } }
 *
 * @example
 * // Blocked by scheduled battles
 * POST /api/onboarding/reset-account
 * { "confirmation": "RESET" }
 * // → 400 { success: false, error: "Cannot reset - you have scheduled battles" }
 *
 * Requirements: 14.1-14.15
 */
router.post('/reset-account', authenticateToken, resetLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { confirmation, reason } = req.body;

    // Validate confirmation
    if (confirmation !== 'RESET') {
      throw new OnboardingError(
        OnboardingErrorCode.RESET_INVALID_CONFIRMATION,
        'Invalid confirmation. Type "RESET" to confirm account reset',
      );
    }

    // Validate reset eligibility
    const eligibility = await validateResetEligibility(userId);

    if (!eligibility.eligible) {
      const blockerMessages = eligibility.blockers.map(b => b.message).join('; ');
      throw new OnboardingError(
        OnboardingErrorCode.RESET_BLOCKED,
        blockerMessages,
        400,
        { blockers: eligibility.blockers.map(b => b.type) },
      );
    }

    // Perform reset
    await performAccountReset(userId, reason);

    logger.info('Account reset', { userId, reason });

    res.json({
      success: true,
      data: {
        message: 'Account reset successfully',
      },
    });
  } catch (error) {
    handleOnboardingError(res, error, 'Reset account error', req.user?.userId);
  }
});

/**
 * GET /api/onboarding/reset-eligibility
 *
 * Check if the user is eligible to reset their account.
 * Returns whether reset is allowed and any blocking constraints.
 *
 * **Responses:**
 * - `200 OK` — `{ success: true, data: { canReset: boolean, reason?: string, blockers?: string[] } }`
 * - `401 Unauthorized` — Not authenticated
 * - `500 Internal Server Error` — Database error
 *
 * @example
 * GET /api/onboarding/reset-eligibility
 * // → 200 { success: true, data: { canReset: true } }
 *
 * @example
 * // Has scheduled battles
 * GET /api/onboarding/reset-eligibility
 * // → 200 { success: true, data: { canReset: false, reason: "...", blockers: ["scheduled_battles"] } }
 *
 * Requirements: 14.4-14.8
 */
router.get('/reset-eligibility', authenticateToken, resetLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const eligibility = await validateResetEligibility(userId);

    res.json({
      success: true,
      data: {
        canReset: eligibility.eligible,
        reason: eligibility.eligible ? undefined : eligibility.blockers.map(b => b.message).join('; '),
        blockers: eligibility.eligible ? undefined : eligibility.blockers.map(b => b.type),
      },
    });
  } catch (error) {
    handleOnboardingError(res, error, 'Check reset eligibility error', req.user?.userId);
  }
});

// Mount analytics sub-router at /api/onboarding/analytics
router.use('/analytics', onboardingAnalyticsRouter);

export default router;
