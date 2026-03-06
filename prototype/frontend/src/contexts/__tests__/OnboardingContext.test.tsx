import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { OnboardingProvider, useOnboarding } from '../OnboardingContext';
import apiClient from '../../utils/apiClient';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock apiClient
vi.mock('../../utils/apiClient');

const mockedApiClient = vi.mocked(apiClient);

// Helper to create wrapper with OnboardingProvider
const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => (
    <OnboardingProvider>{children}</OnboardingProvider>
  );
};

describe('OnboardingContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('State Initialization', () => {
    it('should initialize with loading state', () => {
      mockedApiClient.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.tutorialState).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should fetch tutorial state on mount', async () => {
      const mockState = {
        currentStep: 1,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        strategy: undefined,
        choices: {},
        startedAt: '2024-01-01T00:00:00Z',
        completedAt: undefined,
      };

      mockedApiClient.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockState,
        },
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tutorialState).toEqual(mockState);
      expect(result.current.error).toBe(null);
      expect(mockedApiClient.get).toHaveBeenCalledWith('/api/onboarding/state');
    });

    it('should handle 404 error when tutorial state not found', async () => {
      mockedApiClient.get.mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 404 },
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tutorialState).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should set error on fetch failure', async () => {
      mockedApiClient.get.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tutorialState).toBe(null);
      expect(result.current.error).toBe('Failed to load tutorial state');
    });
  });

  describe('Step Transitions', () => {
    it('should advance to next step', async () => {
      const initialState = {
        currentStep: 1,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        choices: {},
      };

      const updatedState = {
        ...initialState,
        currentStep: 2,
      };

      mockedApiClient.get.mockResolvedValueOnce({
        data: { success: true, data: initialState },
      });

      mockedApiClient.post.mockResolvedValueOnce({
        data: { success: true, data: updatedState },
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.advanceStep();
      });

      expect(result.current.tutorialState?.currentStep).toBe(2);
      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/onboarding/state', {
        step: 2,
      });
    });

    it('should not advance beyond step 9', async () => {
      const initialState = {
        currentStep: 9,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        choices: {},
      };

      mockedApiClient.get.mockResolvedValueOnce({
        data: { success: true, data: initialState },
      });

      mockedApiClient.post.mockResolvedValueOnce({
        data: { success: true, data: initialState },
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.advanceStep();
      });

      expect(result.current.tutorialState?.currentStep).toBe(9);
      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/onboarding/state', {
        step: 9,
      });
    });

    it('should set specific step', async () => {
      const initialState = {
        currentStep: 1,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        choices: {},
      };

      const updatedState = {
        ...initialState,
        currentStep: 5,
      };

      mockedApiClient.get.mockResolvedValueOnce({
        data: { success: true, data: initialState },
      });

      mockedApiClient.post.mockResolvedValueOnce({
        data: { success: true, data: updatedState },
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.setStep(5);
      });

      expect(result.current.tutorialState?.currentStep).toBe(5);
      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/onboarding/state', {
        step: 5,
      });
    });

    it('should handle step transition error', async () => {
      const initialState = {
        currentStep: 1,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        choices: {},
      };

      mockedApiClient.get.mockResolvedValueOnce({
        data: { success: true, data: initialState },
      });

      mockedApiClient.post.mockRejectedValueOnce({
        isAxiosError: true,
        response: { data: { error: 'Invalid step' } },
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.advanceStep();
      });

      expect(result.current.error).toBe('Invalid step');
    });
  });

  describe('Strategy Updates', () => {
    it('should update roster strategy', async () => {
      const initialState = {
        currentStep: 2,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        choices: {},
      };

      const updatedState = {
        ...initialState,
        strategy: '2_average' as const,
      };

      mockedApiClient.get.mockResolvedValueOnce({
        data: { success: true, data: initialState },
      });

      mockedApiClient.post.mockResolvedValueOnce({
        data: { success: true, data: updatedState },
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateStrategy('2_average');
      });

      expect(result.current.tutorialState?.strategy).toBe('2_average');
      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/onboarding/state', {
        strategy: '2_average',
      });
    });

    it('should handle strategy update error', async () => {
      const initialState = {
        currentStep: 2,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        choices: {},
      };

      mockedApiClient.get.mockResolvedValueOnce({
        data: { success: true, data: initialState },
      });

      mockedApiClient.post.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateStrategy('1_mighty');
      });

      expect(result.current.error).toBe('Failed to update strategy');
    });
  });

  describe('Player Choice Updates', () => {
    it('should update player choices', async () => {
      const initialState = {
        currentStep: 3,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        choices: {},
      };

      const updatedState = {
        ...initialState,
        choices: {
          loadoutType: 'weapon_shield' as const,
          preferredStance: 'defensive' as const,
        },
      };

      mockedApiClient.get.mockResolvedValueOnce({
        data: { success: true, data: initialState },
      });

      mockedApiClient.post.mockResolvedValueOnce({
        data: { success: true, data: updatedState },
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateChoices({
          loadoutType: 'weapon_shield',
          preferredStance: 'defensive',
        });
      });

      expect(result.current.tutorialState?.choices.loadoutType).toBe('weapon_shield');
      expect(result.current.tutorialState?.choices.preferredStance).toBe('defensive');
      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/onboarding/state', {
        choices: {
          loadoutType: 'weapon_shield',
          preferredStance: 'defensive',
        },
      });
    });

    it('should merge choices with existing choices', async () => {
      const initialState = {
        currentStep: 5,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        choices: {
          robotsCreated: [1, 2],
        },
      };

      const updatedState = {
        ...initialState,
        choices: {
          robotsCreated: [1, 2],
          weaponsPurchased: [10, 11],
        },
      };

      mockedApiClient.get.mockResolvedValueOnce({
        data: { success: true, data: initialState },
      });

      mockedApiClient.post.mockResolvedValueOnce({
        data: { success: true, data: updatedState },
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateChoices({
          weaponsPurchased: [10, 11],
        });
      });

      expect(result.current.tutorialState?.choices.robotsCreated).toEqual([1, 2]);
      expect(result.current.tutorialState?.choices.weaponsPurchased).toEqual([10, 11]);
    });

    it('should handle choice update error', async () => {
      const initialState = {
        currentStep: 3,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        choices: {},
      };

      mockedApiClient.get.mockResolvedValueOnce({
        data: { success: true, data: initialState },
      });

      mockedApiClient.post.mockRejectedValueOnce({
        isAxiosError: true,
        response: { data: { error: 'Invalid choices' } },
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateChoices({ loadoutType: 'single' });
      });

      expect(result.current.error).toBe('Invalid choices');
    });
  });

  describe('Tutorial Completion', () => {
    it('should complete tutorial', async () => {
      const initialState = {
        currentStep: 9,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        choices: {},
      };

      const completedState = {
        ...initialState,
        hasCompletedOnboarding: true,
        completedAt: '2024-01-01T12:00:00Z',
      };

      mockedApiClient.get.mockResolvedValueOnce({
        data: { success: true, data: initialState },
      });

      mockedApiClient.post.mockResolvedValueOnce({
        data: { success: true, data: { message: 'Tutorial completed' } },
      });

      mockedApiClient.get.mockResolvedValueOnce({
        data: { success: true, data: completedState },
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.completeTutorial();
      });

      expect(result.current.tutorialState?.hasCompletedOnboarding).toBe(true);
      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/onboarding/complete');
    });

    it('should skip tutorial', async () => {
      const initialState = {
        currentStep: 1,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        choices: {},
      };

      const skippedState = {
        ...initialState,
        hasCompletedOnboarding: true,
        onboardingSkipped: true,
      };

      mockedApiClient.get.mockResolvedValueOnce({
        data: { success: true, data: initialState },
      });

      mockedApiClient.post.mockResolvedValueOnce({
        data: { success: true, data: { message: 'Tutorial skipped' } },
      });

      mockedApiClient.get.mockResolvedValueOnce({
        data: { success: true, data: skippedState },
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.skipTutorial();
      });

      expect(result.current.tutorialState?.hasCompletedOnboarding).toBe(true);
      expect(result.current.tutorialState?.onboardingSkipped).toBe(true);
      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/onboarding/skip');
    });

    it('should handle completion error', async () => {
      const initialState = {
        currentStep: 9,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        choices: {},
      };

      mockedApiClient.get.mockResolvedValueOnce({
        data: { success: true, data: initialState },
      });

      mockedApiClient.post.mockRejectedValueOnce(new Error('Server error'));

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.completeTutorial();
      });

      expect(result.current.error).toBe('Failed to complete tutorial');
    });
  });

  describe('API Synchronization', () => {
    it('should refresh state on demand', async () => {
      const initialState = {
        currentStep: 1,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        choices: {},
      };

      const refreshedState = {
        currentStep: 3,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        choices: { robotsCreated: [1] },
      };

      mockedApiClient.get.mockResolvedValueOnce({
        data: { success: true, data: initialState },
      });

      mockedApiClient.get.mockResolvedValueOnce({
        data: { success: true, data: refreshedState },
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tutorialState?.currentStep).toBe(1);

      await act(async () => {
        await result.current.refreshState();
      });

      expect(result.current.tutorialState?.currentStep).toBe(3);
      expect(result.current.tutorialState?.choices.robotsCreated).toEqual([1]);
    });

    it('should handle multiple concurrent updates', async () => {
      const initialState = {
        currentStep: 1,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        choices: {},
      };

      mockedApiClient.get.mockResolvedValueOnce({
        data: { success: true, data: initialState },
      });

      mockedApiClient.post.mockResolvedValue({
        data: {
          success: true,
          data: { ...initialState, currentStep: 2 },
        },
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Trigger multiple updates
      await act(async () => {
        await Promise.all([
          result.current.updateStrategy('1_mighty'),
          result.current.updateChoices({ loadoutType: 'single' }),
        ]);
      });

      // Should have called API twice
      expect(mockedApiClient.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should clear error on successful operation', async () => {
      const initialState = {
        currentStep: 1,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        choices: {},
      };

      mockedApiClient.get.mockResolvedValueOnce({
        data: { success: true, data: initialState },
      });

      // First call fails
      mockedApiClient.post.mockRejectedValueOnce(new Error('Network error'));

      // Second call succeeds
      mockedApiClient.post.mockResolvedValueOnce({
        data: { success: true, data: { ...initialState, currentStep: 2 } },
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // First attempt - should fail
      await act(async () => {
        await result.current.advanceStep();
      });

      expect(result.current.error).toBe('Failed to advance step');

      // Second attempt - should succeed and clear error
      await act(async () => {
        await result.current.advanceStep();
      });

      expect(result.current.error).toBe(null);
      expect(result.current.tutorialState?.currentStep).toBe(2);
    });
  });

  describe('Hook Usage', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useOnboarding());
      }).toThrow('useOnboarding must be used within OnboardingProvider');

      consoleError.mockRestore();
    });
  });
});
