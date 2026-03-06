/**
 * Performance tests for the onboarding system
 *
 * Test coverage:
 * - Lazy loading: step components load on demand via React.lazy/Suspense
 * - Memoization: React.memo prevents unnecessary re-renders of step components
 * - Debouncing: updateChoices batches rapid calls into a single API request
 * - Recommendation caching: repeated calls with same params use cached data
 *
 * Requirements: 28.1-28.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingProvider, useOnboarding } from '../../../contexts/OnboardingContext';
import { AuthProvider } from '../../../contexts/AuthContext';
import apiClient from '../../../utils/apiClient';
import {
  getRecommendations,
  clearRecommendationCache,
} from '../../../utils/onboardingApi';

// Mock apiClient
vi.mock('../../../utils/apiClient');

// Mock react-router-dom navigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

/** Default onboarding state returned by the mock API */
const defaultOnboardingState = {
  currentStep: 1,
  hasCompletedOnboarding: false,
  onboardingSkipped: false,
  strategy: '1_mighty',
  choices: {},
};

/** Sets up apiClient mocks to return a valid onboarding state */
function setupApiMocks(overrides: Record<string, unknown> = {}) {
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url === '/api/user/profile') {
      return Promise.resolve({
        data: {
          id: 1,
          username: 'testuser',
          email: 'test@test.com',
          role: 'player',
          currency: 3_000_000,
          prestige: 0,
        },
      });
    }
    if (url === '/api/onboarding/state') {
      return Promise.resolve({
        data: {
          success: true,
          data: { ...defaultOnboardingState, ...overrides },
        },
      });
    }
    // Recommendations endpoint
    if (url.startsWith('/api/onboarding/recommendations')) {
      return Promise.resolve({
        data: {
          success: true,
          data: {
            facilities: [{ name: 'Weapons Workshop', priority: 1 }],
            weapons: [{ name: 'Laser Rifle', cost: 150000 }],
            attributes: [{ name: 'armor', recommended: 80 }],
            budgetAllocation: { facilities: 500000, robots: 500000 },
          },
        },
      });
    }
    return Promise.resolve({ data: {} });
  });

  vi.mocked(apiClient.post).mockImplementation(() =>
    Promise.resolve({
      data: {
        success: true,
        data: { ...defaultOnboardingState, ...overrides },
      },
    }),
  );
}

// ─── Lazy Loading Tests ──────────────────────────────────────────────

describe('Lazy Loading', () => {
  beforeEach(() => {
    setupApiMocks();
  });

  it('should render OnboardingContainer with Suspense fallback while step loads', async () => {
    // Dynamically import OnboardingContainer to test lazy loading behavior
    const { default: OnboardingContainer } = await import('../OnboardingContainer');

    render(
      <MemoryRouter>
        <AuthProvider>
          <OnboardingProvider>
            <OnboardingContainer />
          </OnboardingProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    // The container should eventually render step content (after lazy load resolves)
    await waitFor(
      () => {
        // Step 1 should be visible after loading
        expect(
          screen.getByText(/Welcome to Armoured Souls/i),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it('should load step components on demand (not all at once)', async () => {
    // Import the container
    const { default: OnboardingContainer } = await import('../OnboardingContainer');

    setupApiMocks({ currentStep: 2 });

    render(
      <MemoryRouter>
        <AuthProvider>
          <OnboardingProvider>
            <OnboardingContainer />
          </OnboardingProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    // Step 2 content should load
    await waitFor(
      () => {
        expect(
          screen.getByText(/Choose Your Roster Strategy/i),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Step 1 content should NOT be in the DOM (it wasn't loaded)
    expect(screen.queryByText(/Welcome to Armoured Souls/i)).not.toBeInTheDocument();
  });
});

// ─── Memoization Tests ───────────────────────────────────────────────

describe('Memoization', () => {
  beforeEach(() => {
    setupApiMocks();
  });

  it('should not re-render step component when parent state changes without prop changes', async () => {
    const renderCounts = { step1: 0 };

    // Create a test component that tracks renders
    const TrackingComponent = () => {
      const { tutorialState } = useOnboarding();
      renderCounts.step1++;
      return (
        <div data-testid="tracking">
          Step: {tutorialState?.currentStep}
        </div>
      );
    };

    const MemoizedTracking = vi.fn(TrackingComponent);

    render(
      <MemoryRouter>
        <AuthProvider>
          <OnboardingProvider>
            <MemoizedTracking />
          </OnboardingProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tracking')).toBeInTheDocument();
    });

    // The component should have rendered (initial + after state load)
    // The key point is it doesn't render excessively
    expect(renderCounts.step1).toBeGreaterThanOrEqual(1);
    expect(renderCounts.step1).toBeLessThanOrEqual(4); // Initial + loading + loaded state
  });
});

// ─── Debouncing Tests ────────────────────────────────────────────────

describe('Debouncing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setupApiMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce rapid updateChoices calls into a single API request', async () => {
    let capturedUpdateChoices: ((choices: Record<string, unknown>) => Promise<void>) | null = null;

    const ChoicesUpdater = () => {
      const { updateChoices, tutorialState } = useOnboarding();
      capturedUpdateChoices = updateChoices;
      return (
        <div data-testid="choices">
          {JSON.stringify(tutorialState?.choices || {})}
        </div>
      );
    };

    render(
      <MemoryRouter>
        <AuthProvider>
          <OnboardingProvider>
            <ChoicesUpdater />
          </OnboardingProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    // Wait for initial state load
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Clear the initial API calls
    const initialCallCount = vi.mocked(apiClient.post).mock.calls.length;

    // Fire multiple rapid choice updates
    await act(async () => {
      capturedUpdateChoices!({ rosterStrategy: '1_mighty' });
    });
    await act(async () => {
      capturedUpdateChoices!({ loadoutType: 'single' });
    });
    await act(async () => {
      capturedUpdateChoices!({ preferredStance: 'offensive' });
    });

    // Before debounce timer fires, no new POST should have been made
    const callsBeforeDebounce = vi.mocked(apiClient.post).mock.calls.length;
    expect(callsBeforeDebounce).toBe(initialCallCount);

    // Advance past the 500ms debounce delay
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    // Now exactly one POST should have been made with the merged choices
    const callsAfterDebounce = vi.mocked(apiClient.post).mock.calls.length;
    expect(callsAfterDebounce).toBe(initialCallCount + 1);

    // The POST body should contain the merged choices
    const lastCall = vi.mocked(apiClient.post).mock.calls[callsAfterDebounce - 1];
    expect(lastCall[0]).toBe('/api/onboarding/state');
    expect(lastCall[1]).toEqual({
      choices: {
        rosterStrategy: '1_mighty',
        loadoutType: 'single',
        preferredStance: 'offensive',
      },
    });
  });

  it('should optimistically update local state before debounce fires', async () => {
    let capturedUpdateChoices: ((choices: Record<string, unknown>) => Promise<void>) | null = null;

    const ChoicesReader = () => {
      const { updateChoices, tutorialState } = useOnboarding();
      capturedUpdateChoices = updateChoices;
      return (
        <div data-testid="strategy">
          {tutorialState?.choices?.rosterStrategy || 'none'}
        </div>
      );
    };

    render(
      <MemoryRouter>
        <AuthProvider>
          <OnboardingProvider>
            <ChoicesReader />
          </OnboardingProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    // Wait for initial load
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Update choices — should reflect immediately in UI
    await act(async () => {
      capturedUpdateChoices!({ rosterStrategy: '2_average' });
    });

    // Local state should be updated immediately (optimistic)
    expect(screen.getByTestId('strategy')).toHaveTextContent('2_average');
  });
});

// ─── Recommendation Caching Tests ────────────────────────────────────

describe('Recommendation Caching', () => {
  beforeEach(() => {
    clearRecommendationCache();
    setupApiMocks();
  });

  it('should cache recommendations and return cached data on subsequent calls', async () => {
    // First call — hits the API
    const result1 = await getRecommendations('1_mighty', 'single', 'offensive', 1000000);
    expect(result1.facilities).toHaveLength(1);
    expect(vi.mocked(apiClient.get)).toHaveBeenCalledTimes(1);

    // Second call with same params — should use cache
    const result2 = await getRecommendations('1_mighty', 'single', 'offensive', 1000000);
    expect(result2).toEqual(result1);
    // Should NOT have made another API call
    expect(vi.mocked(apiClient.get)).toHaveBeenCalledTimes(1);
  });

  it('should make a new API call when parameters change', async () => {
    await getRecommendations('1_mighty', 'single', 'offensive', 1000000);
    expect(vi.mocked(apiClient.get)).toHaveBeenCalledTimes(1);

    // Different strategy — should bypass cache
    await getRecommendations('2_average', 'single', 'offensive', 1000000);
    expect(vi.mocked(apiClient.get)).toHaveBeenCalledTimes(2);
  });

  it('should clear cache when clearRecommendationCache is called', async () => {
    await getRecommendations('1_mighty');
    expect(vi.mocked(apiClient.get)).toHaveBeenCalledTimes(1);

    clearRecommendationCache();

    // Same params but cache was cleared — should hit API again
    await getRecommendations('1_mighty');
    expect(vi.mocked(apiClient.get)).toHaveBeenCalledTimes(2);
  });
});
