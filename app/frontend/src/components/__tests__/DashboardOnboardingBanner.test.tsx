/**
 * Tests for DashboardOnboardingBanner component.
 *
 * Test coverage:
 * - Banner shows for incomplete onboarding users
 * - Banner shows correct step progress
 * - "Resume Tutorial" button navigates to /onboarding
 * - Banner is hidden for completed users
 * - Banner is hidden for skipped users
 * - Banner is hidden when onboardingState is null
 *
 * Requirements: 1.5, 2.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DashboardOnboardingBanner from '../DashboardOnboardingBanner';
import { TutorialState } from '../../utils/onboardingApi';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function makeTutorialState(overrides: Partial<TutorialState> = {}): TutorialState {
  return {
    currentStep: 3,
    hasCompletedOnboarding: false,
    onboardingSkipped: false,
    strategy: '2_average',
    choices: {},
    startedAt: '2026-01-01T00:00:00Z',
    completedAt: null,
    ...overrides,
  };
}

function renderBanner(onboardingState: TutorialState | null) {
  return render(
    <MemoryRouter>
      <DashboardOnboardingBanner onboardingState={onboardingState} />
    </MemoryRouter>,
  );
}

describe('DashboardOnboardingBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Visible for incomplete onboarding', () => {
    it('should display the banner for users with incomplete onboarding', () => {
      renderBanner(makeTutorialState({ currentStep: 3 }));
      expect(screen.getByTestId('onboarding-banner')).toBeInTheDocument();
    });

    it('should display "Setup Progress" label', () => {
      renderBanner(makeTutorialState({ currentStep: 5 }));
      expect(screen.getByText('Setup Progress')).toBeInTheDocument();
    });

    it('should display "Resume Tutorial" button', () => {
      renderBanner(makeTutorialState({ currentStep: 4 }));
      expect(screen.getByRole('button', { name: /resume tutorial/i })).toBeInTheDocument();
    });
  });

  describe('Step progress display', () => {
    it('should show "Step 1 of 5" for backend step 1', () => {
      renderBanner(makeTutorialState({ currentStep: 1 }));
      expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    });

    it('should show "Step 2 of 5" for backend step 3', () => {
      renderBanner(makeTutorialState({ currentStep: 3 }));
      expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
    });

    it('should show "Step 4 of 5" for backend step 8', () => {
      renderBanner(makeTutorialState({ currentStep: 8 }));
      expect(screen.getByText('Step 4 of 5')).toBeInTheDocument();
    });

    it('should render 0% progress for step 1', () => {
      renderBanner(makeTutorialState({ currentStep: 1 }));
      const progressBar = screen.getByTestId('onboarding-progress-bar');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });
  });

  describe('Navigation', () => {
    it('should navigate to /onboarding when "Resume Tutorial" is clicked', async () => {
      const user = userEvent.setup();
      renderBanner(makeTutorialState({ currentStep: 4 }));

      await user.click(screen.getByRole('button', { name: /resume tutorial/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
    });
  });

  describe('Hidden states', () => {
    it('should not render when onboardingState is null', () => {
      renderBanner(null);
      expect(screen.queryByTestId('onboarding-banner')).not.toBeInTheDocument();
    });

    it('should not render for completed users (hasCompletedOnboarding = true)', () => {
      renderBanner(makeTutorialState({ hasCompletedOnboarding: true }));
      expect(screen.queryByTestId('onboarding-banner')).not.toBeInTheDocument();
    });

    it('should not render for skipped users (onboardingSkipped = true)', () => {
      renderBanner(makeTutorialState({ onboardingSkipped: true }));
      expect(screen.queryByTestId('onboarding-banner')).not.toBeInTheDocument();
    });

    it('should not render when both completed and skipped', () => {
      renderBanner(makeTutorialState({ hasCompletedOnboarding: true, onboardingSkipped: true }));
      expect(screen.queryByTestId('onboarding-banner')).not.toBeInTheDocument();
    });
  });
});
