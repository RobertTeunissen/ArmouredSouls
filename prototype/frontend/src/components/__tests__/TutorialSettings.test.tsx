/**
 * Tests for TutorialSettings component.
 *
 * Test coverage:
 * - Displays "Tutorial Completed" status for completed users
 * - Displays "Tutorial Skipped" status for skipped users
 * - Displays "In Progress" status with step number
 * - "Replay Tutorial" button navigates to /onboarding
 * - "Reset Account" button opens ResetAccountModal
 * - Loading state while fetching onboarding state
 * - Error state when fetch fails
 *
 * Requirements: 14.1-14.15, 20.6, 22.1-22.10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TutorialSettings from '../TutorialSettings';
import type { TutorialState } from '../../utils/onboardingApi';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock onboardingApi
const mockGetTutorialState = vi.fn();
const mockReplayTutorial = vi.fn();
vi.mock('../../utils/onboardingApi', () => ({
  getTutorialState: (...args: unknown[]) => mockGetTutorialState(...args),
  replayTutorial: (...args: unknown[]) => mockReplayTutorial(...args),
}));

// Mock ResetAccountModal
vi.mock('../onboarding/ResetAccountModal', () => ({
  default: ({ isOpen, onClose, onResetComplete }: {
    isOpen: boolean;
    onClose: () => void;
    onResetComplete: () => void;
  }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="reset-account-modal">
        <button onClick={onClose} data-testid="modal-close">Close</button>
        <button onClick={onResetComplete} data-testid="modal-reset-complete">Confirm Reset</button>
      </div>
    );
  },
}));

function makeTutorialState(overrides: Partial<TutorialState> = {}): TutorialState {
  return {
    currentStep: 1,
    hasCompletedOnboarding: false,
    onboardingSkipped: false,
    strategy: null,
    choices: {},
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

function renderComponent() {
  return render(
    <MemoryRouter>
      <TutorialSettings />
    </MemoryRouter>,
  );
}

describe('TutorialSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading state', () => {
    it('should display loading indicator while fetching tutorial state', () => {
      // Never resolve the promise to keep loading state
      mockGetTutorialState.mockReturnValue(new Promise(() => {}));
      renderComponent();

      expect(screen.getByTestId('tutorial-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading tutorial status...')).toBeInTheDocument();
    });

    it('should display the Tutorial heading while loading', () => {
      mockGetTutorialState.mockReturnValue(new Promise(() => {}));
      renderComponent();

      expect(screen.getByText('Tutorial')).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should display error message when fetch fails', async () => {
      mockGetTutorialState.mockRejectedValue(new Error('Network error'));
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('tutorial-error')).toBeInTheDocument();
      });
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('should display fallback error message for unknown errors', async () => {
      mockGetTutorialState.mockRejectedValue('unknown error');
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('tutorial-error')).toBeInTheDocument();
      });
    });
  });

  describe('Tutorial Completed status', () => {
    it('should display "Tutorial Completed" for completed users', async () => {
      mockGetTutorialState.mockResolvedValue(
        makeTutorialState({ hasCompletedOnboarding: true, completedAt: '2026-01-15T00:00:00Z' }),
      );
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('tutorial-status')).toBeInTheDocument();
      });
      expect(screen.getByText('Tutorial Completed')).toBeInTheDocument();
    });
  });

  describe('Tutorial Skipped status', () => {
    it('should display "Tutorial Skipped" for skipped users', async () => {
      mockGetTutorialState.mockResolvedValue(
        makeTutorialState({ onboardingSkipped: true }),
      );
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('tutorial-status')).toBeInTheDocument();
      });
      expect(screen.getByText('Tutorial Skipped')).toBeInTheDocument();
    });
  });

  describe('Tutorial In Progress status', () => {
    it('should display "In Progress" with step number for active users', async () => {
      mockGetTutorialState.mockResolvedValue(
        makeTutorialState({ currentStep: 5 }),
      );
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('tutorial-status')).toBeInTheDocument();
      });
      expect(screen.getByText(/Tutorial In Progress/)).toBeInTheDocument();
      expect(screen.getByText(/Step 5 of 9/)).toBeInTheDocument();
    });

    it('should display step 1 for brand new users', async () => {
      mockGetTutorialState.mockResolvedValue(makeTutorialState({ currentStep: 1 }));
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Step 1 of 9/)).toBeInTheDocument();
      });
    });

    it('should display step 9 for users on the last step', async () => {
      mockGetTutorialState.mockResolvedValue(makeTutorialState({ currentStep: 9 }));
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Step 9 of 9/)).toBeInTheDocument();
      });
    });
  });

  describe('Replay Tutorial button', () => {
    it('should render the Replay Tutorial button', async () => {
      mockGetTutorialState.mockResolvedValue(
        makeTutorialState({ hasCompletedOnboarding: true }),
      );
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('replay-tutorial-btn')).toBeInTheDocument();
      });
    });

    it('should navigate to /onboarding when clicked', async () => {
      const user = userEvent.setup();
      mockGetTutorialState.mockResolvedValue(
        makeTutorialState({ hasCompletedOnboarding: true }),
      );
      mockReplayTutorial.mockResolvedValue(
        makeTutorialState({ currentStep: 1, choices: { isReplay: true } }),
      );
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('replay-tutorial-btn')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('replay-tutorial-btn'));
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
      });
    });

    it('should be available for in-progress users too', async () => {
      mockGetTutorialState.mockResolvedValue(makeTutorialState({ currentStep: 3 }));
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('replay-tutorial-btn')).toBeInTheDocument();
      });
    });
  });

  describe('Reset Account button', () => {
    it('should render the Reset Account button', async () => {
      mockGetTutorialState.mockResolvedValue(
        makeTutorialState({ hasCompletedOnboarding: true }),
      );
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('reset-account-btn')).toBeInTheDocument();
      });
    });

    it('should display warning text about consequences', async () => {
      mockGetTutorialState.mockResolvedValue(
        makeTutorialState({ hasCompletedOnboarding: true }),
      );
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Deletes all robots, weapons, and facilities/)).toBeInTheDocument();
      });
    });

    it('should open ResetAccountModal when clicked', async () => {
      const user = userEvent.setup();
      mockGetTutorialState.mockResolvedValue(
        makeTutorialState({ hasCompletedOnboarding: true }),
      );
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('reset-account-btn')).toBeInTheDocument();
      });

      // Modal should not be visible initially
      expect(screen.queryByTestId('reset-account-modal')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('reset-account-btn'));
      expect(screen.getByTestId('reset-account-modal')).toBeInTheDocument();
    });

    it('should close ResetAccountModal when close is clicked', async () => {
      const user = userEvent.setup();
      mockGetTutorialState.mockResolvedValue(
        makeTutorialState({ hasCompletedOnboarding: true }),
      );
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('reset-account-btn')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('reset-account-btn'));
      expect(screen.getByTestId('reset-account-modal')).toBeInTheDocument();

      await user.click(screen.getByTestId('modal-close'));
      expect(screen.queryByTestId('reset-account-modal')).not.toBeInTheDocument();
    });

    it('should navigate to /onboarding after reset completes', async () => {
      const user = userEvent.setup();
      mockGetTutorialState.mockResolvedValue(
        makeTutorialState({ hasCompletedOnboarding: true }),
      );
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('reset-account-btn')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('reset-account-btn'));
      await user.click(screen.getByTestId('modal-reset-complete'));

      expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
      // Modal should be closed after reset
      expect(screen.queryByTestId('reset-account-modal')).not.toBeInTheDocument();
    });
  });
});

describe('TutorialSettings - Replay Tutorial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call replayTutorial API before navigating to /onboarding', async () => {
    const user = userEvent.setup();
    mockGetTutorialState.mockResolvedValue(
      makeTutorialState({ hasCompletedOnboarding: true }),
    );
    mockReplayTutorial.mockResolvedValue(
      makeTutorialState({ currentStep: 1, choices: { isReplay: true } }),
    );
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('replay-tutorial-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('replay-tutorial-btn'));

    expect(mockReplayTutorial).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
  });

  it('should show error when replay API call fails', async () => {
    const user = userEvent.setup();
    mockGetTutorialState.mockResolvedValue(
      makeTutorialState({ hasCompletedOnboarding: true }),
    );
    mockReplayTutorial.mockRejectedValue(new Error('Server error'));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('replay-tutorial-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('replay-tutorial-btn'));

    await waitFor(() => {
      expect(screen.getByText('Failed to start tutorial replay')).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not navigate if replay API fails', async () => {
    const user = userEvent.setup();
    mockGetTutorialState.mockResolvedValue(
      makeTutorialState({ hasCompletedOnboarding: true }),
    );
    mockReplayTutorial.mockRejectedValue(new Error('Network error'));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('replay-tutorial-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('replay-tutorial-btn'));

    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('should show loading text while replay API is in progress', async () => {
    const user = userEvent.setup();
    mockGetTutorialState.mockResolvedValue(
      makeTutorialState({ hasCompletedOnboarding: true }),
    );
    // Never resolve to keep loading state
    mockReplayTutorial.mockReturnValue(new Promise(() => {}));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('replay-tutorial-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('replay-tutorial-btn'));

    expect(screen.getByText('Starting Replay...')).toBeInTheDocument();
    expect(screen.getByTestId('replay-tutorial-btn')).toBeDisabled();
  });
});
