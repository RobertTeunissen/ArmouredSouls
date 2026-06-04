/**
 * @module utils/onboardingApi
 *
 * API client functions for onboarding/tutorial endpoints.
 * Provides functions to read tutorial state, skip the tutorial, and replay it.
 *
 * State mutations during the tutorial are handled by the OnboardingContext —
 * this module only owns the read paths plus the explicit skip/replay actions.
 *
 * @see {@link ./api} for typed API helper
 * @see {@link ../contexts/OnboardingContext} for tutorial state mutations
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
 * Player choices during onboarding (referenced by TutorialState).
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
      throw new Error(error.message || 'Failed to get tutorial state', { cause: error });
    }
    throw new Error('Failed to get tutorial state', { cause: error });
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
      throw new Error(error.message || 'Failed to skip tutorial', { cause: error });
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to skip tutorial', { cause: error });
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
      throw new Error(error.message || 'Failed to replay tutorial', { cause: error });
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to replay tutorial', { cause: error });
  }
}
