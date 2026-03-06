/**
 * Tests for Step9_Completion component
 *
 * Test coverage:
 * - Component rendering (title, congratulations message, trophy)
 * - Strategy summary display for each strategy type
 * - Recommendations section (suggestions, alternatives, player control)
 * - "What's Next" section (daily cycles, battles, league progression)
 * - Quick links (Facilities, Weapon Shop, Dashboard)
 * - "Complete Tutorial" button calls completeTutorial and navigates
 * - "Replay Tutorial" button resets to step 1
 * - Previous button calls onPrevious
 * - Loading state during completion
 * - Error handling during completion
 * - Accessibility (ARIA labels, roles, headings)
 *
 * Requirements: 13.1-13.15, 15.1-15.11
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Step9_Completion from '../Step9_Completion';
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

describe('Step9_Completion', () => {
  const mockOnNext = vi.fn();
  const mockOnPrevious = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (
    strategy: string = '1_mighty',
    choices: any = {},
  ) => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/user/profile') {
        return Promise.resolve({
          data: {
            id: 1,
            username: 'testuser',
            email: 'test@test.com',
            role: 'player',
            currency: 2_000_000,
            prestige: 0,
          },
        });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: {
            currentStep: 9,
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
            <Step9_Completion
              onNext={mockOnNext}
              onPrevious={mockOnPrevious}
            />
          </OnboardingProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
  };

  // ─── Component Rendering ───────────────────────────────────────────

  describe('Component Rendering', () => {
    it('should render the congratulations heading', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Congratulations, Commander/ })).toBeInTheDocument();
      });
    });

    it('should display the trophy emoji', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('img', { name: /Trophy/ })).toBeInTheDocument();
      });
    });

    it('should display the introductory message', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/You've completed the Armoured Souls onboarding tutorial/)).toBeInTheDocument();
      });
    });

    it('should render the main content area with proper role', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('main', { name: /Tutorial Completion/ })).toBeInTheDocument();
      });
    });

    it('should display the player control emphasis message', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Everything in this tutorial was guidance, not rules/)).toBeInTheDocument();
      });
    });

    it('should emphasize player has full control', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/You have full control over how you play/)).toBeInTheDocument();
      });
    });
  });

  // ─── Strategy Summary Display ──────────────────────────────────────

  describe('Strategy Summary Display', () => {
    it('should display the strategy summary section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Your Strategy Summary')).toBeInTheDocument();
      });
    });

    it('should show "1 Mighty Robot" for 1_mighty strategy', async () => {
      renderComponent('1_mighty');
      await waitFor(() => {
        expect(screen.getByTestId('strategy-name')).toHaveTextContent('1 Mighty Robot');
      });
    });

    it('should show "2 Average Robots" for 2_average strategy', async () => {
      renderComponent('2_average');
      await waitFor(() => {
        expect(screen.getByTestId('strategy-name')).toHaveTextContent('2 Average Robots');
      });
    });

    it('should show "3 Flimsy Robots" for 3_flimsy strategy', async () => {
      renderComponent('3_flimsy');
      await waitFor(() => {
        expect(screen.getByTestId('strategy-name')).toHaveTextContent('3 Flimsy Robots');
      });
    });

    it('should display strategy description for 1_mighty', async () => {
      renderComponent('1_mighty');
      await waitFor(() => {
        expect(screen.getByText(/focus all resources on a single powerful robot/)).toBeInTheDocument();
      });
    });

    it('should display strategy description for 2_average', async () => {
      renderComponent('2_average');
      await waitFor(() => {
        expect(screen.getByText(/balanced approach with two robots/)).toBeInTheDocument();
      });
    });

    it('should display strategy description for 3_flimsy', async () => {
      renderComponent('3_flimsy');
      await waitFor(() => {
        expect(screen.getByText(/spread resources across three robots/)).toBeInTheDocument();
      });
    });

    it('should fall back to 1_mighty when no strategy is set', async () => {
      vi.mocked(apiClient.get).mockImplementation((url: string) => {
        if (url === '/api/user/profile') {
          return Promise.resolve({
            data: {
              id: 1, username: 'testuser', email: 'test@test.com',
              role: 'player', currency: 2_000_000, prestige: 0,
            },
          });
        }
        return Promise.resolve({
          data: {
            success: true,
            data: {
              currentStep: 9,
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
              <Step9_Completion onNext={mockOnNext} onPrevious={mockOnPrevious} />
            </OnboardingProvider>
          </AuthProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('strategy-name')).toHaveTextContent('1 Mighty Robot');
      });
    });
  });

  // ─── Recommendations Section ───────────────────────────────────────

  describe('Recommendations Section', () => {
    it('should display the recommendations heading', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Recommended Next Steps')).toBeInTheDocument();
      });
    });

    it('should emphasize recommendations are suggestions', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/These are suggestions, but you decide your path/)).toBeInTheDocument();
      });
    });

    it('should display recommendation items as a list', async () => {
      renderComponent();
      await waitFor(() => {
        const list = screen.getByRole('list', { name: /Recommendations list/ });
        const items = within(list).getAllByRole('listitem');
        expect(items).toHaveLength(3);
      });
    });

    it('should recommend equipping weapons', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Equip your robot with a weapon/)).toBeInTheDocument();
      });
    });

    it('should recommend investing in facilities', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Consider investing in facilities/)).toBeInTheDocument();
      });
    });

    it('should recommend upgrading attributes', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Upgrade your robot's attributes/)).toBeInTheDocument();
      });
    });

    it('should display alternative paths section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/You could also consider:/)).toBeInTheDocument();
      });
    });

    it('should list alternative strategies', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Saving credits and waiting for better weapons/)).toBeInTheDocument();
        expect(screen.getByText(/Focusing entirely on facilities/)).toBeInTheDocument();
        expect(screen.getByText(/Experimenting with different loadout configurations/)).toBeInTheDocument();
      });
    });
  });

  // ─── What's Next Section ───────────────────────────────────────────

  describe("What's Next Section", () => {
    it('should display the daily cycles heading', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/What's Next: Daily Cycles & Battles/)).toBeInTheDocument();
      });
    });

    it('should explain the daily cycle system', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/daily cycle system/)).toBeInTheDocument();
      });
    });

    it('should explain battle participation', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Battle Participation')).toBeInTheDocument();
        expect(screen.getByText(/automatically matched and fight during daily cycles/)).toBeInTheDocument();
      });
    });

    it('should explain league progression', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('League Progression')).toBeInTheDocument();
        expect(screen.getByText(/Win battles to earn League Points/)).toBeInTheDocument();
      });
    });

    it('should mention promotion to higher leagues', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/promoted to higher leagues/)).toBeInTheDocument();
      });
    });
  });

  // ─── Quick Links ───────────────────────────────────────────────────

  describe('Quick Links', () => {
    it('should display the Quick Links heading', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Quick Links/ })).toBeInTheDocument();
      });
    });

    it('should display Facilities link', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Facilities/ })).toBeInTheDocument();
      });
    });

    it('should display Weapon Shop link', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Weapon Shop/ })).toBeInTheDocument();
      });
    });

    it('should display Dashboard link', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Dashboard/ })).toBeInTheDocument();
      });
    });

    it('should navigate to /facilities when Facilities link is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Facilities/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Go to Facilities/ }));
      expect(mockNavigate).toHaveBeenCalledWith('/facilities');
    });

    it('should navigate to /weapons when Weapon Shop link is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Weapon Shop/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Go to Weapon Shop/ }));
      expect(mockNavigate).toHaveBeenCalledWith('/weapons');
    });

    it('should navigate to /dashboard when Dashboard link is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Dashboard/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Go to Dashboard/ }));
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('should display descriptions for each quick link', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Build and upgrade facilities/)).toBeInTheDocument();
        expect(screen.getByText(/Browse and purchase weapons/)).toBeInTheDocument();
        expect(screen.getByText(/View your overall progress/)).toBeInTheDocument();
      });
    });
  });

  // ─── Complete Tutorial Button ──────────────────────────────────────

  describe('Complete Tutorial Button', () => {
    it('should render the Complete Tutorial button', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Tutorial/ })).toBeInTheDocument();
      });
    });

    it('should call completeTutorial and navigate to dashboard on click', async () => {
      const user = userEvent.setup();

      // Track GET call count so refreshState after completion returns hasCompletedOnboarding: true
      let stateGetCount = 0;
      vi.mocked(apiClient.get).mockImplementation((url: string) => {
        if (url === '/api/user/profile') {
          return Promise.resolve({
            data: {
              id: 1, username: 'testuser', email: 'test@test.com',
              role: 'player', currency: 2_000_000, prestige: 0,
            },
          });
        }
        stateGetCount++;
        return Promise.resolve({
          data: {
            success: true,
            data: {
              currentStep: 9,
              hasCompletedOnboarding: stateGetCount > 1,
              onboardingSkipped: false,
              strategy: '1_mighty',
              choices: {},
            },
          },
        });
      });

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { success: true },
      });

      render(
        <MemoryRouter>
          <AuthProvider>
            <OnboardingProvider>
              <Step9_Completion onNext={mockOnNext} onPrevious={mockOnPrevious} />
            </OnboardingProvider>
          </AuthProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Tutorial/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Complete Tutorial/ }));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/api/onboarding/complete');
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should show loading state while completing', async () => {
      const user = userEvent.setup();

      let resolvePost: (value: any) => void;
      vi.mocked(apiClient.post).mockImplementation(
        () => new Promise((resolve) => { resolvePost = resolve; }),
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Tutorial/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Complete Tutorial/ }));

      await waitFor(() => {
        expect(screen.getByText('Completing...')).toBeInTheDocument();
      });

      resolvePost!({ data: { success: true } });

      await waitFor(() => {
        expect(screen.queryByText('Completing...')).not.toBeInTheDocument();
      });
    });

    it('should disable Complete Tutorial button while completing', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Tutorial/ })).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /Complete Tutorial/ }));

      await waitFor(() => {
        const button = screen.getByText('Completing...').closest('button');
        expect(button).toBeDisabled();
      });
    });
  });

  // ─── Replay Tutorial Button ────────────────────────────────────────

  describe('Replay Tutorial Button', () => {
    it('should render the Replay Tutorial button', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Replay Tutorial/ })).toBeInTheDocument();
      });
    });

    it('should call setStep(1) when Replay Tutorial is clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { success: true, data: { currentStep: 1 } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Replay Tutorial/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Replay Tutorial/ }));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/api/onboarding/state', { step: 1 });
      });
    });
  });

  // ─── Previous Button ───────────────────────────────────────────────

  describe('Previous Button', () => {
    it('should render the Previous button', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Previous step/ })).toBeInTheDocument();
      });
    });

    it('should call onPrevious when Previous is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Previous step/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Previous step/ }));
      expect(mockOnPrevious).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Error Handling ────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should display error message when completion fails', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Tutorial/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Complete Tutorial/ }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/Failed to complete tutorial/)).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('should re-enable Complete Tutorial button after error', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Tutorial/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Complete Tutorial/ }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Tutorial/ })).toBeEnabled();
      });

      consoleSpy.mockRestore();
    });

    it('should not navigate to dashboard when completion fails', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Tutorial/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Complete Tutorial/ }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(mockNavigate).not.toHaveBeenCalledWith('/dashboard');

      consoleSpy.mockRestore();
    });

    it('should handle replay tutorial error gracefully', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Replay Tutorial/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Replay Tutorial/ }));

      // Should not crash — error is caught internally
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Replay Tutorial/ })).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  // ─── Accessibility ─────────────────────────────────────────────────

  describe('Accessibility', () => {
    it('should have proper heading hierarchy with h1', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /Congratulations/ })).toBeInTheDocument();
      });
    });

    it('should have aria-label on main content area', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('main', { name: /Tutorial Completion/ })).toBeInTheDocument();
      });
    });

    it('should have aria-label on strategy summary section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText('Your Strategy Summary')).toBeInTheDocument();
      });
    });

    it('should have aria-label on recommendations section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText('Personalized Recommendations')).toBeInTheDocument();
      });
    });

    it('should have aria-label on whats next section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText('What Happens Next')).toBeInTheDocument();
      });
    });

    it('should have aria-label on quick links section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText('Quick Links')).toBeInTheDocument();
      });
    });

    it('should have accessible Complete Tutorial button', async () => {
      renderComponent();
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Complete Tutorial/ });
        expect(button).toBeInTheDocument();
        expect(button).toBeEnabled();
      });
    });

    it('should have accessible Previous button with aria-label', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Previous step/ })).toBeInTheDocument();
      });
    });

    it('should have accessible Replay Tutorial button with aria-label', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Replay Tutorial/ })).toBeInTheDocument();
      });
    });

    it('should have accessible quick link buttons with aria-labels', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Facilities/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Go to Weapon Shop/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Go to Dashboard/ })).toBeInTheDocument();
      });
    });

    it('should have role="alert" on error message', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('fail'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Tutorial/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Complete Tutorial/ }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('should have recommendations list with proper role', async () => {
      renderComponent();
      await waitFor(() => {
        const list = screen.getByRole('list', { name: /Recommendations list/ });
        expect(list).toBeInTheDocument();
        const items = within(list).getAllByRole('listitem');
        expect(items.length).toBeGreaterThanOrEqual(3);
      });
    });
  });
});
