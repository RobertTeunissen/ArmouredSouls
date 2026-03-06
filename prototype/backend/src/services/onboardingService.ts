import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { OnboardingError, OnboardingErrorCode } from '../errors/onboardingErrors';
import logger from '../config/logger';

/**
 * Onboarding Service
 *
 * Manages tutorial state and progression for new players.
 * Tracks onboarding progress through 9 steps, stores player choices,
 * and handles completion/skip functionality.
 *
 * @module services/onboardingService
 */

const VALID_STRATEGIES = ['1_mighty', '2_average', '3_flimsy'] as const;
const MIN_STEP = 1;
const MAX_STEP = 9;

/**
 * Player choices made during onboarding
 */
export interface OnboardingChoices {
  rosterStrategy?: '1_mighty' | '2_average' | '3_flimsy';
  robotsCreated?: number[];
  weaponsPurchased?: number[];
  facilitiesPurchased?: string[];
  loadoutType?: 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
  preferredStance?: 'offensive' | 'defensive' | 'balanced';
  weaponTypesSelected?: string[];
  budgetSpent?: {
    facilities: number;
    robots: number;
    weapons: number;
    attributes: number;
  };
}

/**
 * Tutorial state data structure
 */
export interface TutorialState {
  userId: number;
  hasCompletedOnboarding: boolean;
  onboardingSkipped: boolean;
  onboardingStep: number;
  onboardingStrategy: string | null;
  onboardingChoices: OnboardingChoices;
  onboardingStartedAt: Date | null;
  onboardingCompletedAt: Date | null;
}

/**
 * Updates that can be applied to tutorial state
 */
export interface TutorialStateUpdates {
  onboardingStep?: number;
  onboardingStrategy?: string;
  onboardingChoices?: Record<string, unknown>;
}

/**
 * Initialize tutorial state for a new user.
 * Sets up the initial onboarding state with step 1 and empty choices.
 *
 * @param userId - The user ID to initialize onboarding for
 * @returns The updated user with initialized onboarding state
 * @throws {Error} If user not found or database operation fails
 *
 * @example
 * const state = await initializeTutorialState(123);
 * console.log(state.onboardingStep); // 1
 * console.log(state.hasCompletedOnboarding); // false
 *
 * Requirements: 1.1, 1.2, 1.4
 */
export async function initializeTutorialState(userId: number): Promise<TutorialState> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      hasCompletedOnboarding: false,
      onboardingSkipped: false,
      onboardingStep: 1,
      onboardingStrategy: null,
      onboardingChoices: {},
      onboardingStartedAt: new Date(),
      onboardingCompletedAt: null,
    },
  });

  return {
    userId: user.id,
    hasCompletedOnboarding: user.hasCompletedOnboarding,
    onboardingSkipped: user.onboardingSkipped,
    onboardingStep: user.onboardingStep,
    onboardingStrategy: user.onboardingStrategy,
    onboardingChoices: user.onboardingChoices as OnboardingChoices,
    onboardingStartedAt: user.onboardingStartedAt,
    onboardingCompletedAt: user.onboardingCompletedAt,
  };
}

/**
 * Get tutorial state for a user.
 * Retrieves the current onboarding progress and choices.
 *
 * @param userId - The user ID to get state for
 * @returns The tutorial state, or null if user not found
 *
 * @example
 * const state = await getTutorialState(123);
 * if (state && !state.hasCompletedOnboarding) {
 *   console.log(`User is on step ${state.onboardingStep}`);
 * }
 *
 * Requirements: 1.3, 1.4
 */
export async function getTutorialState(userId: number): Promise<TutorialState | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      hasCompletedOnboarding: true,
      onboardingSkipped: true,
      onboardingStep: true,
      onboardingStrategy: true,
      onboardingChoices: true,
      onboardingStartedAt: true,
      onboardingCompletedAt: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    hasCompletedOnboarding: user.hasCompletedOnboarding,
    onboardingSkipped: user.onboardingSkipped,
    onboardingStep: user.onboardingStep,
    onboardingStrategy: user.onboardingStrategy,
    onboardingChoices: user.onboardingChoices as OnboardingChoices,
    onboardingStartedAt: user.onboardingStartedAt,
    onboardingCompletedAt: user.onboardingCompletedAt,
  };
}

/**
 * Validate a step number is within the allowed range.
 * @throws {OnboardingError} If step is out of range
 */
function validateStep(step: number): void {
  if (typeof step !== 'number' || !Number.isInteger(step) || step < MIN_STEP || step > MAX_STEP) {
    throw new OnboardingError(
      OnboardingErrorCode.INVALID_STEP_RANGE,
      `Step must be an integer between ${MIN_STEP} and ${MAX_STEP}`,
    );
  }
}

/**
 * Validate a strategy string.
 * @throws {OnboardingError} If strategy is invalid
 */
function validateStrategy(strategy: string): void {
  if (!(VALID_STRATEGIES as readonly string[]).includes(strategy)) {
    throw new OnboardingError(
      OnboardingErrorCode.INVALID_STRATEGY,
      `Invalid strategy. Must be one of: ${VALID_STRATEGIES.join(', ')}`,
    );
  }
}

/**
 * Update tutorial state for a user.
 * Allows updating step number, strategy, and player choices.
 * Validates step transitions: step can move forward by 1, backward to any
 * previous step, or stay the same. Jumps forward by more than 1 are rejected.
 *
 * @param userId - The user ID to update
 * @param updates - The fields to update
 * @returns The updated tutorial state
 * @throws {OnboardingError} If validation fails or user not found
 *
 * @example
 * const state = await updateTutorialState(123, {
 *   onboardingStep: 2,
 *   onboardingStrategy: '2_average'
 * });
 *
 * Requirements: 1.3, 1.4, 2.3
 */
export async function updateTutorialState(
  userId: number,
  updates: TutorialStateUpdates
): Promise<TutorialState> {
  // Validate step if provided
  if (updates.onboardingStep !== undefined) {
    validateStep(updates.onboardingStep);

    // Validate step transition: no skipping forward by more than 1
    const current = await getTutorialState(userId);
    if (!current) {
      throw new OnboardingError(
        OnboardingErrorCode.TUTORIAL_STATE_NOT_FOUND,
        'Tutorial state not found for this user',
        404,
      );
    }

    if (current.hasCompletedOnboarding) {
      throw new OnboardingError(
        OnboardingErrorCode.TUTORIAL_ALREADY_COMPLETED,
        'Tutorial is already completed',
      );
    }

    const requestedStep = updates.onboardingStep;
    const currentStep = current.onboardingStep;

    // Allow: same step, any backward step, or exactly +1 forward
    if (requestedStep > currentStep + 1) {
      logger.warn('Invalid step transition attempted', {
        userId,
        currentStep,
        requestedStep,
      });
      throw new OnboardingError(
        OnboardingErrorCode.INVALID_STEP_TRANSITION,
        `Cannot jump from step ${currentStep} to step ${requestedStep}. You can only advance one step at a time.`,
        400,
        { currentStep, requestedStep },
      );
    }
  }

  // Validate strategy if provided
  if (updates.onboardingStrategy !== undefined) {
    validateStrategy(updates.onboardingStrategy);
  }

  try {
    const { onboardingChoices, ...rest } = updates;
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...rest,
        ...(onboardingChoices !== undefined && {
          onboardingChoices: onboardingChoices as Prisma.InputJsonValue,
        }),
      },
    });

    return {
      userId: user.id,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      onboardingSkipped: user.onboardingSkipped,
      onboardingStep: user.onboardingStep,
      onboardingStrategy: user.onboardingStrategy,
      onboardingChoices: user.onboardingChoices as OnboardingChoices,
      onboardingStartedAt: user.onboardingStartedAt,
      onboardingCompletedAt: user.onboardingCompletedAt,
    };
  } catch (error: unknown) {
    // Prisma P2025: record not found
    const prismaError = error as { code?: string };
    if (prismaError?.code === 'P2025') {
      throw new OnboardingError(
        OnboardingErrorCode.TUTORIAL_STATE_NOT_FOUND,
        'Tutorial state not found for this user',
        404,
      );
    }
    throw error;
  }
}

/**
 * Complete the tutorial for a user.
 * Marks onboarding as completed and sets completion timestamp.
 *
 * @param userId - The user ID to complete tutorial for
 * @returns void
 * @throws {Error} If user not found or database operation fails
 *
 * @example
 * await completeTutorial(123);
 *
 * Requirements: 1.5, 2.3
 */
export async function completeTutorial(userId: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      hasCompletedOnboarding: true,
      onboardingCompletedAt: new Date(),
    },
  });
}

/**
 * Skip the tutorial for a user.
 * Marks onboarding as completed and skipped.
 *
 * @param userId - The user ID to skip tutorial for
 * @returns void
 * @throws {Error} If user not found or database operation fails
 *
 * @example
 * await skipTutorial(123);
 *
 * Requirements: 1.6
 */
export async function skipTutorial(userId: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      hasCompletedOnboarding: true,
      onboardingSkipped: true,
      onboardingCompletedAt: new Date(),
    },
  });
}

/**
 * Advance to the next step in the tutorial.
 * Increments the current step by 1, capped at step 9.
 *
 * @param userId - The user ID to advance
 * @returns The updated tutorial state
 * @throws {Error} If user not found or tutorial state not found
 *
 * @example
 * const state = await advanceStep(123);
 * console.log(state.onboardingStep); // Previous step + 1
 *
 * Requirements: 2.3
 */
export async function advanceStep(userId: number): Promise<TutorialState> {
  const currentState = await getTutorialState(userId);
  if (!currentState) {
    throw new OnboardingError(
      OnboardingErrorCode.TUTORIAL_STATE_NOT_FOUND,
      'Tutorial state not found for this user',
      404,
    );
  }

  if (currentState.hasCompletedOnboarding) {
    throw new OnboardingError(
      OnboardingErrorCode.TUTORIAL_ALREADY_COMPLETED,
      'Tutorial is already completed',
    );
  }

  const nextStep = Math.min(currentState.onboardingStep + 1, MAX_STEP);

  return await updateTutorialState(userId, {
    onboardingStep: nextStep,
  });
}

/**
 * Update player choices during onboarding.
 * Merges new choices with existing choices.
 *
 * @param userId - The user ID to update choices for
 * @param choices - The choices to merge with existing choices
 * @returns The updated tutorial state
 * @throws {Error} If user not found or tutorial state not found
 *
 * @example
 * const state = await updatePlayerChoices(123, {
 *   rosterStrategy: '2_average',
 *   robotsCreated: [456]
 * });
 *
 * Requirements: 2.3, 20.1
 */
export async function updatePlayerChoices(
  userId: number,
  choices: Partial<OnboardingChoices>
): Promise<TutorialState> {
  if (!choices || typeof choices !== 'object') {
    throw new OnboardingError(
      OnboardingErrorCode.INVALID_CHOICES,
      'Choices must be a non-null object',
    );
  }

  const currentState = await getTutorialState(userId);
  if (!currentState) {
    throw new OnboardingError(
      OnboardingErrorCode.TUTORIAL_STATE_NOT_FOUND,
      'Tutorial state not found for this user',
      404,
    );
  }

  const currentChoices = currentState.onboardingChoices || {};
  const updatedChoices = { ...currentChoices, ...choices };

  return await updateTutorialState(userId, {
    onboardingChoices: updatedChoices,
  });
}
