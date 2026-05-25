import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { api } from '../utils/api';
import { ApiError } from '../utils/ApiError';
import type { OnboardingState, OnboardingChoices, OnboardingContextType, OnboardingErrorInfo } from './onboarding.types';

export type { OnboardingState, OnboardingChoices, OnboardingContextType, OnboardingErrorInfo };

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

/** Debounce delay for choice updates (ms) */
const DEBOUNCE_DELAY = 500;

/**
 * Backend response envelope. Endpoints return either
 *   { success: true, data: T }
 * or
 *   { success: false, error?: string, code?: string }.
 *
 * The typed `api` wrapper hands us the JSON body directly; we still need
 * to inspect `success` to handle the application-level failure case
 * (where the HTTP status is 200 but the operation didn't succeed).
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Custom hook to access the onboarding context.
 * Must be used within an {@link OnboardingProvider} component tree.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

interface OnboardingProviderProps {
  children: ReactNode;
}

/**
 * Provides onboarding state and actions to the component tree.
 *
 * Manages tutorial progression, player choices, and synchronization with the backend API.
 * Automatically fetches the current tutorial state on mount and provides functions
 * to update state, advance steps, and complete/skip the tutorial.
 *
 * Performance optimizations:
 * - Debounced choice updates (500ms) to reduce API calls during rapid interactions
 * - Recommendation caching with 5-minute TTL
 */
export const OnboardingProvider = ({ children }: OnboardingProviderProps) => {
  const [tutorialState, setTutorialState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<OnboardingErrorInfo | null>(null);
  const mountedRef = useRef(true);

  // Debounce timer ref for choice updates
  const choicesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Accumulated choices waiting to be flushed
  const pendingChoicesRef = useRef<Partial<OnboardingChoices> | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (choicesTimerRef.current) {
        clearTimeout(choicesTimerRef.current);
      }
    };
  }, []);

  /**
   * Detect whether an error is a network/connectivity issue.
   *
   * After the typed-api migration, network failures arrive as
   * `ApiError` with `code === 'NETWORK_ERROR'` (no response received).
   * Gateway-style outages (502/503/504) and request timeouts (408)
   * keep their status codes; we treat them as network errors so the
   * UI can offer a retry rather than an account-level explanation.
   */
  const isNetworkError = (err: unknown): boolean => {
    if (err instanceof ApiError) {
      if (err.code === 'NETWORK_ERROR') return true;
      const status = err.statusCode;
      if (status === 408 || status === 502 || status === 503 || status === 504) return true;
    }
    if (err instanceof TypeError && err.message === 'Network Error') return true;
    return false;
  };

  /**
   * Shared helper that wraps an async API action with loading/error state management.
   * Produces both the legacy `error` string and the new structured `errorInfo`.
   */
  const runAction = useCallback(async (
    action: () => Promise<void>,
    fallbackError: string,
  ) => {
    try {
      setLoading(true);
      setError(null);
      setErrorInfo(null);
      await action();
    } catch (err) {
      if (mountedRef.current) {
        const networkErr = isNetworkError(err);
        // The api wrapper leaves `ApiError.message` empty when the backend
        // didn't supply an `error`/`message` field, so a falsy check is
        // enough to fall back to the caller-supplied label. Network errors
        // get a generic recovery hint regardless of the original message.
        const message = networkErr
          ? 'Network error. Please check your connection and try again.'
          : (err instanceof ApiError && err.message) || fallbackError;
        const code = err instanceof ApiError ? err.code : undefined;

        setError(message);
        setErrorInfo({ message, code, isNetworkError: networkErr });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  /** Posts to /api/onboarding/state and updates local state on success. */
  const postState = useCallback(async (
    body: Record<string, unknown>,
    errorMsg: string,
  ) => {
    await runAction(async () => {
      const response = await api.post<ApiResponse<OnboardingState>>(
        '/api/onboarding/state',
        body,
      );
      if (response.success && response.data) {
        setTutorialState(response.data);
      } else {
        throw new Error(errorMsg);
      }
    }, errorMsg);
  }, [runAction]);

  const refreshState = useCallback(async () => {
    await runAction(async () => {
      const response = await api.get<ApiResponse<OnboardingState>>(
        '/api/onboarding/state',
      );
      if (response.success && response.data) {
        setTutorialState(response.data);
      } else {
        throw new Error('Failed to load tutorial state');
      }
    }, 'Failed to load tutorial state');
  }, [runAction]);

  const advanceStep = useCallback(async () => {
    if (!tutorialState) return;
    const nextStep = Math.min(tutorialState.currentStep + 1, 9);
    await postState({ step: nextStep }, 'Failed to advance step');
  }, [tutorialState, postState]);

  const setStep = useCallback(async (step: number) => {
    // Client-side guard: prevent obviously invalid steps
    if (step < 1 || step > 9 || !Number.isInteger(step)) {
      const msg = 'Invalid step number';
      setError(msg);
      setErrorInfo({ message: msg, code: 'INVALID_STEP_RANGE', isNetworkError: false });
      return;
    }
    await postState({ step }, 'Failed to set step');
  }, [postState]);

  const updateStrategy = useCallback(async (
    strategy: '1_mighty' | '2_average' | '3_flimsy',
  ) => {
    await postState({ strategy }, 'Failed to update strategy');
  }, [postState]);

  /**
   * Flush any pending debounced choices to the backend immediately.
   * Called internally before step transitions or completion.
   */
  const flushPendingChoices = useCallback(async () => {
    if (choicesTimerRef.current) {
      clearTimeout(choicesTimerRef.current);
      choicesTimerRef.current = null;
    }
    const pending = pendingChoicesRef.current;
    if (pending) {
      pendingChoicesRef.current = null;
      await postState({ choices: pending }, 'Failed to update choices');
    }
  }, [postState]);

  /**
   * Debounced choice update. Accumulates rapid changes and sends a single
   * API request after 500ms of inactivity. Optimistically updates local state
   * immediately for responsive UI.
   */
  const updateChoices = useCallback(async (choices: Partial<OnboardingChoices>) => {
    // Merge with any pending choices
    pendingChoicesRef.current = {
      ...(pendingChoicesRef.current || {}),
      ...choices,
    };

    // Optimistic local update for responsive UI
    setTutorialState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        choices: { ...prev.choices, ...choices },
      };
    });

    // Clear existing timer
    if (choicesTimerRef.current) {
      clearTimeout(choicesTimerRef.current);
    }

    // Set new debounce timer
    choicesTimerRef.current = setTimeout(async () => {
      const pending = pendingChoicesRef.current;
      if (pending) {
        pendingChoicesRef.current = null;
        try {
          await postState({ choices: pending }, 'Failed to update choices');
        } catch {
          // Error already handled by postState/runAction
        }
      }
    }, DEBOUNCE_DELAY);
  }, [postState]);

  const completeTutorial = useCallback(async () => {
    // Flush any pending choices before completing
    await flushPendingChoices();
    await runAction(async () => {
      const response = await api.post<ApiResponse<unknown>>('/api/onboarding/complete');
      if (response.success) {
        await refreshState();
      } else {
        throw new Error('Failed to complete tutorial');
      }
    }, 'Failed to complete tutorial');
  }, [runAction, refreshState, flushPendingChoices]);

  const skipTutorial = useCallback(async () => {
    // Flush any pending choices before skipping
    await flushPendingChoices();
    await runAction(async () => {
      const response = await api.post<ApiResponse<unknown>>('/api/onboarding/skip');
      if (response.success) {
        await refreshState();
      } else {
        throw new Error('Failed to skip tutorial');
      }
    }, 'Failed to skip tutorial');
  }, [runAction, refreshState, flushPendingChoices]);

  // Fetch tutorial state on mount
  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const isReplayMode = tutorialState?.choices?.isReplay === true;

  const clearError = useCallback(() => {
    setError(null);
    setErrorInfo(null);
  }, []);

  /** Retry by re-fetching state. Clears the current error first. */
  const retry = useCallback(async () => {
    clearError();
    await refreshState();
  }, [clearError, refreshState]);

  return (
    <OnboardingContext.Provider
      value={{
        tutorialState,
        loading,
        error,
        errorInfo,
        isReplayMode,
        advanceStep,
        updateStrategy,
        updateChoices,
        completeTutorial,
        skipTutorial,
        refreshState,
        setStep,
        clearError,
        retry,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};
