/**
 * @module utils/onboardingApi
 *
 * API client functions for onboarding/tutorial endpoints.
 * Provides functions to manage tutorial state and reset accounts.
 *
 * All functions use the shared api helper with automatic JWT authentication.
 *
 * @see {@link ./api} for typed API helper
 */
import { api } from './api';
import { ApiError } from './ApiError';

/**
 * Tutorial state data structure
 */
export interface TutorialState {
  currentStep: number;
  hasCompletedOnboarding: boolean;
  onboardingSkipped: boolean;
  strategy: string | null;
  choices: OnboardingChoices;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * Player choices during onboarding
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
  isReplay?: boolean;
}

/**
 * Reset eligibility response
 */
export interface ResetEligibility {
  canReset: boolean;
  reason?: string;
  blockers?: string[];
}

/**
 * API response wrapper
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  blockers?: string[];
}


/**
 * Get the current tutorial state for the authenticated user.
 *
 * @returns Promise resolving to tutorial state
 * @throws Error if request fails or user is not authenticated
 *
 * @example
 * const state = await getTutorialState();
 * console.log(`Current step: ${state.currentStep}`);
 *
 * Requirements: 1.3, 1.4
 */
export async function getTutorialState(): Promise<TutorialState> {
  try {
    const response = await api.get<ApiResponse<TutorialState>>('/api/onboarding/state');

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get tutorial state');
    }

    return response.data;
  } catch (error: unknown) {
    // Handle 404 as "no tutorial state yet" - return default state
    if (error instanceof ApiError && error.statusCode === 404) {
      return {
        currentStep: 1,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        strategy: null,
        choices: {},
        startedAt: null,
        completedAt: null,
      };
    }

    // Re-throw ApiError as-is, wrap others
    if (error instanceof ApiError) {
      throw new Error(error.message || 'Failed to get tutorial state');
    }
    throw new Error('Failed to get tutorial state');
  }
}

/**
 * Update the tutorial state for the authenticated user.
 *
 * @param updates - Partial updates to apply to tutorial state
 * @param updates.step - New step number (1-9)
 * @param updates.strategy - Roster strategy choice
 * @param updates.choices - Player choices to merge with existing choices
 * @returns Promise resolving to updated tutorial state
 * @throws Error if request fails or validation fails
 *
 * @example
 * // Update step and strategy
 * await updateTutorialState({ step: 2, strategy: '2_average' });
 *
 * @example
 * // Update player choices
 * await updateTutorialState({
 *   choices: {
 *     loadoutType: 'weapon_shield',
 *     preferredStance: 'defensive'
 *   }
 * });
 *
 * Requirements: 1.3, 2.3, 2.6, 2.7
 */
export async function updateTutorialState(updates: {
  step?: number;
  strategy?: '1_mighty' | '2_average' | '3_flimsy';
  choices?: Partial<OnboardingChoices>;
}): Promise<TutorialState> {
  try {
    const response = await api.post<ApiResponse<TutorialState>>(
      '/api/onboarding/state',
      updates
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to update tutorial state');
    }

    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw new Error(error.message || 'Failed to update tutorial state');
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to update tutorial state');
  }
}

/**
 * Mark the tutorial as completed for the authenticated user.
 *
 * @returns Promise resolving when tutorial is marked complete
 * @throws Error if request fails
 *
 * @example
 * await completeTutorial();
 * console.log('Tutorial completed!');
 *
 * Requirements: 1.5, 2.3, 13.15
 */
export async function completeTutorial(): Promise<void> {
  try {
    const response = await api.post<ApiResponse<{ message: string }>>(
      '/api/onboarding/complete'
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to complete tutorial');
    }
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw new Error(error.message || 'Failed to complete tutorial');
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to complete tutorial');
  }
}

/**
 * Skip the tutorial for the authenticated user.
 *
 * @returns Promise resolving when tutorial is skipped
 * @throws Error if request fails
 *
 * @example
 * await skipTutorial();
 * console.log('Tutorial skipped');
 *
 * Requirements: 1.6
 */
export async function skipTutorial(): Promise<void> {
  try {
    const response = await api.post<ApiResponse<{ message: string }>>(
      '/api/onboarding/skip'
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to skip tutorial');
    }
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw new Error(error.message || 'Failed to skip tutorial');
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to skip tutorial');
  }
}


/**
 * Replay the tutorial from the beginning without affecting actual game state.
 * Resets the tutorial step to 1 and sets isReplay flag in choices to prevent
 * actual purchases during the replay walkthrough.
 *
 * @returns Promise resolving to the reset tutorial state
 * @throws Error if request fails
 *
 * Requirements: 20.6, 20.7
 */
export async function replayTutorial(): Promise<TutorialState> {
  try {
    const response = await api.post<ApiResponse<TutorialState>>(
      '/api/onboarding/state',
      {
        step: 1,
        choices: { isReplay: true },
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to replay tutorial');
    }

    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw new Error(error.message || 'Failed to replay tutorial');
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to replay tutorial');
  }
}

/**
 * Reset the user's account to starting state.
 * Deletes all robots, weapons, facilities, and resets credits to ₡3,000,000.
 *
 * **Important:** This action cannot be undone. Validates that no scheduled battles exist.
 *
 * @param confirmation - Must be "RESET" to confirm
 * @param reason - Optional reason for reset (for analytics)
 * @returns Promise resolving when account is reset
 * @throws Error if request fails or reset is blocked by constraints
 *
 * @example
 * await resetAccount('RESET', 'Made mistakes during onboarding');
 * console.log('Account reset successfully');
 *
 * @example
 * // Will throw error if scheduled battles exist
 * try {
 *   await resetAccount('RESET');
 * } catch (error) {
 *   console.error('Cannot reset:', error.message);
 * }
 *
 * Requirements: 14.1-14.15
 */
export async function resetAccount(confirmation: string, reason?: string): Promise<void> {
  try {
    const response = await api.post<ApiResponse<{ message: string }>>(
      '/api/onboarding/reset-account',
      { confirmation, reason }
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to reset account');
    }
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      // Include blockers in error message if available from details
      const details = error.details as { blockers?: string[] } | undefined;
      const blockers = details?.blockers;

      if (blockers && blockers.length > 0) {
        throw new Error(`${error.message} (Blockers: ${blockers.join(', ')})`);
      }

      throw new Error(error.message || 'Failed to reset account');
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to reset account');
  }
}

/**
 * Check if the user is eligible to reset their account.
 * Returns whether reset is allowed and any blocking constraints.
 *
 * @returns Promise resolving to reset eligibility status
 * @throws Error if request fails
 *
 * @example
 * const eligibility = await checkResetEligibility();
 * if (eligibility.canReset) {
 *   console.log('Reset is allowed');
 * } else {
 *   console.log('Reset blocked:', eligibility.reason);
 * }
 *
 * Requirements: 14.4-14.8
 */
export async function checkResetEligibility(): Promise<ResetEligibility> {
  try {
    const response = await api.get<ApiResponse<ResetEligibility>>(
      '/api/onboarding/reset-eligibility'
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to check reset eligibility');
    }

    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw new Error(error.message || 'Failed to check reset eligibility');
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to check reset eligibility');
  }
}

/**
 * Retry wrapper for API calls with exponential backoff.
 * Automatically retries failed requests up to 3 times with increasing delays.
 *
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Promise resolving to function result
 * @throws Error if all retries fail
 *
 * @internal
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error as Error;

      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (error instanceof ApiError) {
        const status = error.statusCode;
        if (status >= 400 && status < 500 && status !== 429) {
          throw error;
        }
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Request failed after retries');
}

/**
 * Get tutorial state with automatic retry on failure.
 *
 * @returns Promise resolving to tutorial state
 * @throws Error if all retries fail
 */
export async function getTutorialStateWithRetry(): Promise<TutorialState> {
  return withRetry(() => getTutorialState());
}

/**
 * Update tutorial state with automatic retry on failure.
 *
 * @param updates - Partial updates to apply
 * @returns Promise resolving to updated tutorial state
 * @throws Error if all retries fail
 */
export async function updateTutorialStateWithRetry(updates: {
  step?: number;
  strategy?: '1_mighty' | '2_average' | '3_flimsy';
  choices?: Partial<OnboardingChoices>;
}): Promise<TutorialState> {
  return withRetry(() => updateTutorialState(updates));
}
