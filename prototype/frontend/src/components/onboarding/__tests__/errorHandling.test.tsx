import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReactNode } from 'react';
import { OnboardingProvider, useOnboarding } from '../../../contexts/OnboardingContext';
import OnboardingErrorBoundary from '../OnboardingErrorBoundary';
import apiClient from '../../../utils/apiClient';

// Mock apiClient
vi.mock('../../../utils/apiClient');
const mockedApiClient = apiClient as any;

// Helper to create wrapper with OnboardingProvider
const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => (
    <OnboardingProvider>{children}</OnboardingProvider>
  );
};

// Helper: mock a successful initial state load
function mockInitialState(state?: Record<string, unknown>) {
  const defaultState = {
    currentStep: 1,
    hasCompletedOnboarding: false,
    onboardingSkipped: false,
    strategy: undefined,
    choices: {},
  };
  mockedApiClient.get.mockResolvedValueOnce({
    data: { success: true, data: { ...defaultState, ...state } },
  });
}

describe('Error Handling and Recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── OnboardingErrorBoundary ───────────────────────────────────────

  describe('OnboardingErrorBoundary', () => {
    it('should render children when no error occurs', () => {
      render(
        <OnboardingErrorBoundary>
          <div>Tutorial Content</div>
        </OnboardingErrorBoundary>,
      );
      expect(screen.getByText('Tutorial Content')).toBeInTheDocument();
    });

    it('should display fallback UI when a child throws', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const ThrowingComponent = () => {
        throw new Error('Render crash');
      };

      render(
        <OnboardingErrorBoundary>
          <ThrowingComponent />
        </OnboardingErrorBoundary>,
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText(/Your progress has been saved/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Go to Dashboard/i })).toBeInTheDocument();

      consoleError.mockRestore();
    });

    it('should call onRetry and reset error state when Try Again is clicked', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onRetry = vi.fn();
      let shouldThrow = true;

      const MaybeThrow = () => {
        if (shouldThrow) throw new Error('boom');
        return <div>Recovered</div>;
      };

      render(
        <OnboardingErrorBoundary onRetry={onRetry}>
          <MaybeThrow />
        </OnboardingErrorBoundary>,
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Stop throwing so re-render succeeds
      shouldThrow = false;
      fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Recovered')).toBeInTheDocument();

      consoleError.mockRestore();
    });

    it('should have an accessible alert role', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const Throw = () => { throw new Error('x'); };

      render(
        <OnboardingErrorBoundary>
          <Throw />
        </OnboardingErrorBoundary>,
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      consoleError.mockRestore();
    });
  });

  // ─── Network Error Detection ───────────────────────────────────────

  describe('Network error detection', () => {
    it('should flag network errors when no response is received', async () => {
      // Simulate a network failure (no response object)
      const axiosError = new Error('Network Error') as any;
      axiosError.isAxiosError = true;
      axiosError.response = undefined;

      mockedApiClient.get.mockRejectedValueOnce(axiosError);

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.errorInfo).not.toBeNull();
      expect(result.current.errorInfo!.isNetworkError).toBe(true);
      expect(result.current.errorInfo!.message).toContain('Network error');
    });

    it('should flag 503 as a network error', async () => {
      const axiosError = new Error('Service Unavailable') as any;
      axiosError.isAxiosError = true;
      axiosError.response = { status: 503, data: { error: 'Service Unavailable' } };

      mockedApiClient.get.mockRejectedValueOnce(axiosError);

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.errorInfo!.isNetworkError).toBe(true);
    });

    it('should NOT flag a 400 as a network error', async () => {
      const axiosError = new Error('Bad Request') as any;
      axiosError.isAxiosError = true;
      axiosError.response = {
        status: 400,
        data: { error: 'Invalid step', code: 'INVALID_STEP_RANGE' },
      };

      mockedApiClient.get.mockRejectedValueOnce(axiosError);

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.errorInfo!.isNetworkError).toBe(false);
      expect(result.current.errorInfo!.code).toBe('INVALID_STEP_RANGE');
      expect(result.current.errorInfo!.message).toBe('Invalid step');
    });
  });

  // ─── Error Code Propagation ────────────────────────────────────────

  describe('Error code propagation from backend', () => {
    it('should expose the backend error code in errorInfo', async () => {
      mockInitialState({ currentStep: 3 });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Simulate an INVALID_STEP_TRANSITION from the backend
      const axiosError = new Error('Cannot jump') as any;
      axiosError.isAxiosError = true;
      axiosError.response = {
        status: 400,
        data: {
          error: 'Cannot jump from step 3 to step 8',
          code: 'INVALID_STEP_TRANSITION',
        },
      };
      mockedApiClient.post.mockRejectedValueOnce(axiosError);

      await act(async () => {
        await result.current.setStep(8);
      });

      expect(result.current.errorInfo).not.toBeNull();
      expect(result.current.errorInfo!.code).toBe('INVALID_STEP_TRANSITION');
      expect(result.current.errorInfo!.message).toContain('Cannot jump');
      expect(result.current.errorInfo!.isNetworkError).toBe(false);
    });

    it('should expose TUTORIAL_ALREADY_COMPLETED code', async () => {
      mockInitialState({ currentStep: 9 });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const axiosError = new Error('Already completed') as any;
      axiosError.isAxiosError = true;
      axiosError.response = {
        status: 400,
        data: {
          error: 'Tutorial is already completed',
          code: 'TUTORIAL_ALREADY_COMPLETED',
        },
      };
      mockedApiClient.post.mockRejectedValueOnce(axiosError);

      await act(async () => {
        await result.current.advanceStep();
      });

      expect(result.current.errorInfo!.code).toBe('TUTORIAL_ALREADY_COMPLETED');
    });
  });

  // ─── Invalid Step Transitions (client-side guard) ──────────────────

  describe('Invalid step transitions (client-side)', () => {
    it('should reject step 0 without calling the API', async () => {
      mockInitialState();

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.setStep(0);
      });

      expect(mockedApiClient.post).not.toHaveBeenCalled();
      expect(result.current.error).toBe('Invalid step number');
      expect(result.current.errorInfo!.code).toBe('INVALID_STEP_RANGE');
    });

    it('should reject step 10 without calling the API', async () => {
      mockInitialState();

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.setStep(10);
      });

      expect(mockedApiClient.post).not.toHaveBeenCalled();
      expect(result.current.error).toBe('Invalid step number');
    });

    it('should reject non-integer step without calling the API', async () => {
      mockInitialState();

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.setStep(2.5);
      });

      expect(mockedApiClient.post).not.toHaveBeenCalled();
      expect(result.current.error).toBe('Invalid step number');
    });
  });

  // ─── Retry Logic ──────────────────────────────────────────────────

  describe('Retry logic', () => {
    it('should clear error and re-fetch state on retry()', async () => {
      // First load fails
      mockedApiClient.get.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).not.toBeNull();

      // Retry succeeds
      mockInitialState({ currentStep: 3 });

      await act(async () => {
        await result.current.retry();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.errorInfo).toBeNull();
      expect(result.current.tutorialState?.currentStep).toBe(3);
    });
  });

  // ─── clearError ───────────────────────────────────────────────────

  describe('clearError', () => {
    it('should clear both error and errorInfo', async () => {
      mockedApiClient.get.mockRejectedValueOnce(new Error('fail'));

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).not.toBeNull();
      expect(result.current.errorInfo).not.toBeNull();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.errorInfo).toBeNull();
    });
  });

  // ─── Error message display in context ─────────────────────────────

  describe('Error message display', () => {
    it('should prefer backend error message over fallback', async () => {
      mockInitialState();

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const axiosError = new Error('err') as any;
      axiosError.isAxiosError = true;
      axiosError.response = {
        status: 400,
        data: { error: 'Step must be a number between 1 and 9' },
      };
      mockedApiClient.post.mockRejectedValueOnce(axiosError);

      await act(async () => {
        await result.current.advanceStep();
      });

      expect(result.current.error).toBe('Step must be a number between 1 and 9');
    });

    it('should use fallback message when backend provides no error field', async () => {
      mockInitialState();

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockedApiClient.post.mockRejectedValueOnce(new Error('generic'));

      await act(async () => {
        await result.current.advanceStep();
      });

      expect(result.current.error).toBe('Failed to advance step');
    });

    it('should show network-specific message for connectivity failures', async () => {
      const axiosError = new Error('Network Error') as any;
      axiosError.isAxiosError = true;
      axiosError.response = undefined;

      mockedApiClient.get.mockRejectedValueOnce(axiosError);

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toContain('Network error');
    });
  });
});
