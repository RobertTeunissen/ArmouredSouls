/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for Step5_RobotCreation component
 *
 * Test coverage:
 * - Component rendering with different strategies
 * - Strategy-specific content display (robot count, cost, tips)
 * - Robot cost and budget display
 * - Attribute upgrade warning
 * - Create Robot button and GuidedUIOverlay integration
 * - Robot created success state
 * - Next button and advanceStep integration
 * - Skip creation flow
 * - Loading/submitting states
 * - Error handling
 * - Accessibility
 *
 * Requirements: 9.1-9.10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Step5_RobotCreation from '../Step5_RobotCreation';
import { OnboardingProvider } from '../../../../contexts/OnboardingContext';
import { AuthProvider } from '../../../../contexts/AuthContext';
import apiClient from '../../../../utils/apiClient';

// Mock apiClient
vi.mock('../../../../utils/apiClient');

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock GuidedUIOverlay
vi.mock('../../GuidedUIOverlay', () => ({
  default: ({ tooltipContent, onNext, onClose }: any) => (
    <div data-testid="guided-overlay">
      <div data-testid="overlay-content">{tooltipContent}</div>
      {onNext && <button data-testid="overlay-next" onClick={onNext}>Next</button>}
      {onClose && <button data-testid="overlay-close" onClick={onClose}>Close</button>}
    </div>
  ),
}));

describe('Step5_RobotCreation', () => {
  const mockOnNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock auth profile endpoint
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/user/profile') {
        return Promise.resolve({
          data: {
            id: 1,
            username: 'testuser',
            email: 'test@test.com',
            role: 'player',
            currency: 3000000,
            prestige: 0,
          },
        });
      }
      // Default: onboarding state
      return Promise.resolve({
        data: {
          success: true,
          data: {
            currentStep: 5,
            hasCompletedOnboarding: false,
            onboardingSkipped: false,
            strategy: '1_mighty',
            choices: {},
          },
        },
      });
    });
  });

  const renderComponent = (strategy: string = '1_mighty', choices: any = {}, currency: number = 3000000) => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/user/profile') {
        return Promise.resolve({
          data: {
            id: 1,
            username: 'testuser',
            email: 'test@test.com',
            role: 'player',
            currency,
            prestige: 0,
          },
        });
      }
      if (url === '/api/robots') {
        // Return array of robots based on robotsCreated in choices
        const robotsCreated = choices.robotsCreated || [];
        return Promise.resolve({
          data: robotsCreated.map((id: number) => ({ id, name: `Robot ${id}` })),
        });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: {
            currentStep: 5,
            hasCompletedOnboarding: false,
            onboardingSkipped: false,
            strategy,
            choices,
          },
        },
      });
    });

    return render(
      <MemoryRouter>
        <AuthProvider>
          <OnboardingProvider>
            <Step5_RobotCreation onNext={mockOnNext} />
          </OnboardingProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  };

  describe('Component Rendering', () => {
    it('should render the step title', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Create Your First Robot')).toBeInTheDocument();
      });
    });

    it('should display robot cost of ₡500,000', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getAllByText('₡500,000').length).toBeGreaterThan(0);
      });
    });

    it('should display the attribute upgrade warning', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText("Don't Upgrade Attributes Yet!")).toBeInTheDocument();
      });
    });

    it('should display the Training Facility discount explanation', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Training Facility provides 10-90% discount/)).toBeInTheDocument();
      });
    });

    it('should display the educational note about reset', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/you can always reset your account/)).toBeInTheDocument();
      });
    });

    it('should display what you get with a robot', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/All 23 attributes starting at Level 1/)).toBeInTheDocument();
      });
    });
  });

  describe('Strategy-Specific Content', () => {
    it('should display 1 Mighty Robot strategy info', async () => {
      renderComponent('1_mighty');
      await waitFor(() => {
        expect(screen.getByText(/Your Strategy: 1 Mighty Robot/)).toBeInTheDocument();
        expect(screen.getByText(/You only need one robot/)).toBeInTheDocument();
      });
    });

    it('should display 2 Average Robots strategy info', async () => {
      renderComponent('2_average');
      await waitFor(() => {
        expect(screen.getByText(/Your Strategy: 2 Average Robots/)).toBeInTheDocument();
        expect(screen.getByText(/You'll create 2 robots total/)).toBeInTheDocument();
      });
    });

    it('should display 3 Flimsy Robots strategy info', async () => {
      renderComponent('3_flimsy');
      await waitFor(() => {
        expect(screen.getByText(/Your Strategy: 3 Flimsy Robots/)).toBeInTheDocument();
        expect(screen.getByText(/You'll create 3 robots total/)).toBeInTheDocument();
      });
    });

    it('should show total robot cost for 1_mighty strategy', async () => {
      renderComponent('1_mighty');
      await waitFor(() => {
        expect(screen.getByText(/1 robot × ₡500,000/)).toBeInTheDocument();
      });
    });

    it('should show total robot cost for 2_average strategy', async () => {
      renderComponent('2_average');
      await waitFor(() => {
        expect(screen.getByText(/2 robots × ₡500,000/)).toBeInTheDocument();
      });
    });

    it('should show total robot cost for 3_flimsy strategy', async () => {
      renderComponent('3_flimsy');
      await waitFor(() => {
        expect(screen.getByText(/3 robots × ₡500,000/)).toBeInTheDocument();
      });
    });

    it('should display strategy tip', async () => {
      renderComponent('1_mighty');
      await waitFor(() => {
        expect(screen.getByText('Strategy Tip')).toBeInTheDocument();
        expect(screen.getByText(/This is your only robot/)).toBeInTheDocument();
      });
    });
  });

  describe('Budget Display', () => {
    it('should show current balance', async () => {
      renderComponent('1_mighty', {}, 3000000);
      await waitFor(() => {
        expect(screen.getByText('₡3,000,000')).toBeInTheDocument();
      });
    });

    it('should show remaining balance after creation', async () => {
      renderComponent('1_mighty', {}, 3000000);
      await waitFor(() => {
        expect(screen.getByText('₡2,500,000')).toBeInTheDocument();
      });
    });
  });

  describe('Create Robot Button and Overlay', () => {
    it('should render the Create Robot button', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Robot #1/i })).toBeInTheDocument();
      });
    });

    it('should navigate directly to robot creation page when Create Robot button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Robot #1/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Create Robot #1/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/robots/create?onboarding=true');
    });

    it('should show skip option for creating robot later', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Skip for now/)).toBeInTheDocument();
      });
    });
  });

  describe('Robot Created State', () => {
    it('should show success message when robot was already created', async () => {
      renderComponent('1_mighty', { robotsCreated: [1] });
      await waitFor(() => {
        expect(screen.getByText('All 1 Robot Created!')).toBeInTheDocument();
      });
    });

    it('should show Next button when robot was created', async () => {
      renderComponent('1_mighty', { robotsCreated: [1] });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Weapon Types & Loadouts/i })).toBeInTheDocument();
      });
    });

    it('should not show Create Robot #1 button when robot was already created', async () => {
      renderComponent('1_mighty', { robotsCreated: [1] });
      await waitFor(() => {
        expect(screen.getByText('All 1 Robot Created!')).toBeInTheDocument();
      });
      // For 1_mighty strategy with 1 robot created, the button should not show Create Robot #1
      expect(screen.queryByRole('button', { name: /Create Robot #1/i })).not.toBeInTheDocument();
    });
  });

  describe('Next Button and Navigation', () => {
    it('should call advanceStep when Next button is clicked after robot creation', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { success: true, data: { currentStep: 6 } },
      });

      renderComponent('1_mighty', { robotsCreated: [1] });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Weapon Types & Loadouts/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Weapon Types & Loadouts/i }));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalled();
      });
    });

    it('should call onNext callback after advancing step', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { success: true, data: { currentStep: 6 } },
      });

      renderComponent('1_mighty', { robotsCreated: [1] });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Weapon Types & Loadouts/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Weapon Types & Loadouts/i }));

      await waitFor(() => {
        expect(mockOnNext).toHaveBeenCalled();
      });
    });

    it('should show loading state while submitting', async () => {
      const user = userEvent.setup();

      let resolvePost: (value: any) => void;
      vi.mocked(apiClient.post).mockImplementation(
        () => new Promise((resolve) => { resolvePost = resolve; })
      );

      renderComponent('1_mighty', { robotsCreated: [1] });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Weapon Types & Loadouts/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Weapon Types & Loadouts/i }));

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });

      resolvePost!({ data: { success: true, data: { currentStep: 6 } } });

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });

    it('should disable Next button while submitting', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderComponent('1_mighty', { robotsCreated: [1] });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Weapon Types & Loadouts/i })).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /Next: Weapon Types & Loadouts/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Loading/i })).toBeDisabled();
      });
    });
  });

  describe('Skip Creation Flow', () => {
    it('should allow skipping robot creation', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { success: true, data: { currentStep: 6 } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Skip for now/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Skip for now/));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should recover from advanceStep failure', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));

      renderComponent('1_mighty', { robotsCreated: [1] });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Weapon Types & Loadouts/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Weapon Types & Loadouts/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Weapon Types & Loadouts/i })).toBeEnabled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      renderComponent();
      await waitFor(() => {
        const headings = screen.getAllByRole('heading');
        expect(headings.length).toBeGreaterThan(0);
        expect(screen.getByRole('heading', { name: /Create Your First Robot/i })).toBeInTheDocument();
      });
    });

    it('should have accessible Create Robot button', async () => {
      renderComponent();
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Create Robot #1/i });
        expect(button).toBeInTheDocument();
        expect(button).toBeEnabled();
      });
    });

    it('should have accessible skip button', async () => {
      renderComponent();
      await waitFor(() => {
        const skipButton = screen.getByText(/Skip for now/);
        expect(skipButton).toBeInTheDocument();
      });
    });
  });

  describe('Default Strategy Fallback', () => {
    it('should fall back to 1_mighty when no strategy is set', async () => {
      vi.mocked(apiClient.get).mockImplementation((url: string) => {
        if (url === '/api/user/profile') {
          return Promise.resolve({
            data: {
              id: 1,
              username: 'testuser',
              email: 'test@test.com',
              role: 'player',
              currency: 3000000,
              prestige: 0,
            },
          });
        }
        return Promise.resolve({
          data: {
            success: true,
            data: {
              currentStep: 5,
              hasCompletedOnboarding: false,
              onboardingSkipped: false,
              strategy: null,
              choices: {},
            },
          },
        });
      });

      render(
        <MemoryRouter>
          <AuthProvider>
            <OnboardingProvider>
              <Step5_RobotCreation onNext={mockOnNext} />
            </OnboardingProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/1 Mighty Robot/)).toBeInTheDocument();
      });
    });
  });
});
