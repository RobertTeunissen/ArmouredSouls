/**
 * Onboarding context type definitions.
 *
 * Extracted from OnboardingContext.tsx to keep the context file focused
 * on state management and provider logic.
 */
import type { OnboardingChoices } from '@shared/types';

/**
 * Represents the current state of the onboarding tutorial.
 */
export interface OnboardingState {
  currentStep: number;
  hasCompletedOnboarding: boolean;
  onboardingSkipped: boolean;
  strategy?: '1_mighty' | '2_average' | '3_flimsy';
  choices: OnboardingChoices;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Structured error returned by the onboarding API.
 * `code` is a machine-readable identifier the UI can switch on;
 * `isNetworkError` flags connectivity problems so the UI can show a retry button.
 */
export interface OnboardingErrorInfo {
  message: string;
  code?: string;
  isNetworkError: boolean;
}

/**
 * Shape of the onboarding context value provided to consumers.
 */
export interface OnboardingContextType {
  tutorialState: OnboardingState | null;
  loading: boolean;
  error: string | null;
  /** Structured error info with code and network flag. Null when no error. */
  errorInfo: OnboardingErrorInfo | null;
  isReplayMode: boolean;
  advanceStep: () => Promise<void>;
  updateStrategy: (strategy: '1_mighty' | '2_average' | '3_flimsy') => Promise<void>;
  updateChoices: (choices: Partial<OnboardingChoices>) => Promise<void>;
  completeTutorial: () => Promise<void>;
  skipTutorial: () => Promise<void>;
  refreshState: () => Promise<void>;
  setStep: (step: number) => Promise<void>;
  /** Clear the current error so the UI can dismiss it. */
  clearError: () => void;
  /** Retry the last failed operation (currently re-fetches state). */
  retry: () => Promise<void>;
}
