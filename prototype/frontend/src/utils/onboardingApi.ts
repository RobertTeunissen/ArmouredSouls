/**
 * @module utils/onboardingApi
 *
 * API client functions for onboarding/tutorial endpoints.
 * Provides functions to manage tutorial state, get recommendations, and reset accounts.
 *
 * All functions use the shared apiClient with automatic JWT authentication.
 *
 * @see {@link ./apiClient} for base API client configuration
 */
import apiClient from './apiClient';

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
 * Recommendation structure
 */
export interface Recommendation {
  type: 'facility' | 'weapon' | 'attribute' | 'strategy';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  reasoning: string;
  estimatedCost?: number;
}

/**
 * Budget allocation structure
 */
export interface BudgetAllocation {
  facilities: { min: number; max: number };
  robots: { min: number; max: number };
  weapons: { min: number; max: number };
  attributes: { min: number; max: number };
  reserve: { min: number; max: number };
}

/**
 * Recommendations response
 */
export interface RecommendationsResponse {
  facilities: Recommendation[];
  weapons: Recommendation[];
  attributes: Recommendation[];
  budgetAllocation: BudgetAllocation;
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
    const response = await apiClient.get<ApiResponse<TutorialState>>('/api/onboarding/state');

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get tutorial state');
    }

    return response.data.data;
  } catch (error: any) {
    // Handle 404 as "no tutorial state yet" - return default state
    if (error.response?.status === 404) {
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

    // Re-throw other errors
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to get tutorial state'
    );
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
    const response = await apiClient.post<ApiResponse<TutorialState>>(
      '/api/onboarding/state',
      updates
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update tutorial state');
    }

    return response.data.data;
  } catch (error: any) {
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to update tutorial state'
    );
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
    const response = await apiClient.post<ApiResponse<{ message: string }>>(
      '/api/onboarding/complete'
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to complete tutorial');
    }
  } catch (error: any) {
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to complete tutorial'
    );
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
    const response = await apiClient.post<ApiResponse<{ message: string }>>(
      '/api/onboarding/skip'
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to skip tutorial');
    }
  } catch (error: any) {
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to skip tutorial'
    );
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
    const response = await apiClient.post<ApiResponse<TutorialState>>(
      '/api/onboarding/state',
      {
        step: 1,
        choices: { isReplay: true },
      }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to replay tutorial');
    }

    return response.data.data;
  } catch (error: any) {
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to replay tutorial'
    );
  }
}

/** Recommendation cache with 5-minute TTL */
const recommendationCache: {
  data: RecommendationsResponse | null;
  key: string;
  expiresAt: number;
} = { data: null, key: '', expiresAt: 0 };

const RECOMMENDATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Build a cache key from recommendation parameters */
function buildRecommendationCacheKey(
  strategy?: string,
  loadoutType?: string,
  stance?: string,
  creditsRemaining?: number,
): string {
  return `${strategy || ''}-${loadoutType || ''}-${stance || ''}-${creditsRemaining ?? ''}`;
}

/** Clear the recommendation cache (e.g. after strategy change) */
export function clearRecommendationCache(): void {
  recommendationCache.data = null;
  recommendationCache.key = '';
  recommendationCache.expiresAt = 0;
}

/**
 * Get personalized recommendations based on player's strategic choices.
 * Results are cached for 5 minutes with the same parameters.
 *
 * @param strategy - Roster strategy (optional, uses stored choice if not provided)
 * @param loadoutType - Loadout type (optional)
 * @param stance - Battle stance (optional)
 * @param creditsRemaining - Player's remaining credits (optional)
 * @returns Promise resolving to recommendations
 * @throws Error if request fails
 *
 * @example
 * const recommendations = await getRecommendations('2_average', 'weapon_shield', 'defensive');
 * console.log(`${recommendations.facilities.length} facility recommendations`);
 *
 * @example
 * // Use stored choices from tutorial state
 * const recommendations = await getRecommendations();
 *
 * Requirements: 13.1-13.15
 */
export async function getRecommendations(
  strategy?: '1_mighty' | '2_average' | '3_flimsy',
  loadoutType?: 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield',
  stance?: 'offensive' | 'defensive' | 'balanced',
  creditsRemaining?: number
): Promise<RecommendationsResponse> {
  // Check cache first
  const cacheKey = buildRecommendationCacheKey(strategy, loadoutType, stance, creditsRemaining);
  if (
    recommendationCache.data &&
    recommendationCache.key === cacheKey &&
    Date.now() < recommendationCache.expiresAt
  ) {
    return recommendationCache.data;
  }

  try {
    const params = new URLSearchParams();
    if (strategy) params.append('strategy', strategy);
    if (loadoutType) params.append('loadoutType', loadoutType);
    if (stance) params.append('stance', stance);
    if (creditsRemaining !== undefined) params.append('creditsRemaining', creditsRemaining.toString());

    const url = `/api/onboarding/recommendations${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await apiClient.get<ApiResponse<RecommendationsResponse>>(url);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get recommendations');
    }

    // Store in cache
    recommendationCache.data = response.data.data;
    recommendationCache.key = cacheKey;
    recommendationCache.expiresAt = Date.now() + RECOMMENDATION_CACHE_TTL;

    return response.data.data;
  } catch (error: any) {
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to get recommendations'
    );
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
    const response = await apiClient.post<ApiResponse<{ message: string }>>(
      '/api/onboarding/reset-account',
      { confirmation, reason }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to reset account');
    }
  } catch (error: any) {
    // Include blockers in error message if available
    const errorMessage = error.response?.data?.error || error.message || 'Failed to reset account';
    const blockers = error.response?.data?.blockers;

    if (blockers && blockers.length > 0) {
      throw new Error(`${errorMessage} (Blockers: ${blockers.join(', ')})`);
    }

    throw new Error(errorMessage);
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
    const response = await apiClient.get<ApiResponse<ResetEligibility>>(
      '/api/onboarding/reset-eligibility'
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to check reset eligibility');
    }

    return response.data.data;
  } catch (error: any) {
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to check reset eligibility'
    );
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
    } catch (error: any) {
      lastError = error;

      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
        throw error;
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

/**
 * Get recommendations with automatic retry on failure.
 *
 * @param strategy - Roster strategy (optional)
 * @param loadoutType - Loadout type (optional)
 * @param stance - Battle stance (optional)
 * @param creditsRemaining - Player's remaining credits (optional)
 * @returns Promise resolving to recommendations
 * @throws Error if all retries fail
 */
export async function getRecommendationsWithRetry(
  strategy?: '1_mighty' | '2_average' | '3_flimsy',
  loadoutType?: 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield',
  stance?: 'offensive' | 'defensive' | 'balanced',
  creditsRemaining?: number
): Promise<RecommendationsResponse> {
  return withRetry(() => getRecommendations(strategy, loadoutType, stance, creditsRemaining));
}
