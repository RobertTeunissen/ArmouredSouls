/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for Step9_Completion component
 *
 * Test coverage:
 * - Component rendering (title, congratulations message, trophy)
 * - Strategy summary display for each strategy type
 * - Game Cycle System section (League Battles, Tournaments, Tag Team, King of the Hill, Settlement)
 * - League Progression section (Promotion, Stay, Relegation)
 * - Facilities section
 * - Robot Attributes section
 * - In-Game Guide section
 * - Recommended Next Steps section
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
import { render, screen, waitFor } from '@testing-library/react';
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


  // ─── Game Cycle System Section ─────────────────────────────────────

  describe('Game Cycle System Section', () => {
    it('should display the game cycle system heading', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Game Cycle System/)).toBeInTheDocument();
      });
    });

    it('should explain the automated cycle system', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/automated cycle system/)).toBeInTheDocument();
      });
    });

    it('should display League Battles cycle type', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/League Battles/)).toBeInTheDocument();
        expect(screen.getByText(/automatically fight in their leagues/)).toBeInTheDocument();
      });
    });

    it('should display Tournaments cycle type', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Tournaments/)).toBeInTheDocument();
        expect(screen.getByText(/bracket-style elimination/)).toBeInTheDocument();
      });
    });

    it('should display Tag Team Battles cycle type', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Tag Team Battles/)).toBeInTheDocument();
        expect(screen.getByText(/multiple robots fight together/)).toBeInTheDocument();
      });
    });

    it('should display King of the Hill cycle type', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/King of the Hill/)).toBeInTheDocument();
        expect(screen.getByText(/Challenge the reigning champion/)).toBeInTheDocument();
      });
    });

    it('should display Settlement cycle type', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Settlement/)).toBeInTheDocument();
        expect(screen.getByText(/income, operating costs, repairs/)).toBeInTheDocument();
      });
    });

    it('should display tip about checking Dashboard', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Check the Dashboard regularly/)).toBeInTheDocument();
      });
    });
  });

  // ─── League Progression Section ────────────────────────────────────

  describe('League Progression Section', () => {
    it('should display the league progression heading', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/League Progression/)).toBeInTheDocument();
      });
    });

    it('should explain promotion', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/🔼 Promotion/)).toBeInTheDocument();
        expect(screen.getByText(/top positions/)).toBeInTheDocument();
        expect(screen.getByText(/promoted to a higher league/)).toBeInTheDocument();
      });
    });

    it('should explain staying in league', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/↔️ Stay/)).toBeInTheDocument();
        expect(screen.getByText(/middle positions/)).toBeInTheDocument();
        expect(screen.getByText(/remain in your current league/)).toBeInTheDocument();
      });
    });

    it('should explain relegation', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/🔽 Relegation/)).toBeInTheDocument();
        expect(screen.getByText(/bottom positions/)).toBeInTheDocument();
        expect(screen.getByText(/relegated to a lower league/)).toBeInTheDocument();
      });
    });

    it('should mention League Standings page', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/League Standings/)).toBeInTheDocument();
      });
    });
  });


  // ─── Facilities Section ────────────────────────────────────────────

  describe('Facilities Section', () => {
    it('should display the facilities heading', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Facilities: Your Economic Engine')).toBeInTheDocument();
      });
    });

    it('should mention building facilities', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Build facilities/)).toBeInTheDocument();
      });
    });

    it('should mention upgrading facilities', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Upgrade facilities/)).toBeInTheDocument();
      });
    });

    it('should mention passive income', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Earn passive income/)).toBeInTheDocument();
      });
    });

    it('should have Go to Facilities button', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Facilities Page/ })).toBeInTheDocument();
      });
    });

    it('should navigate to /facilities when button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Facilities Page/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Go to Facilities Page/ }));
      expect(mockNavigate).toHaveBeenCalledWith('/facilities');
    });
  });

  // ─── Robot Attributes Section ──────────────────────────────────────

  describe('Robot Attributes Section', () => {
    it('should display the robot attributes heading', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Robot Attributes: Power Up Your Robots')).toBeInTheDocument();
      });
    });

    it('should mention 23 different attributes', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/23 different attributes/)).toBeInTheDocument();
      });
    });

    it('should display Offensive attributes category', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Offensive Attributes')).toBeInTheDocument();
      });
    });

    it('should display Defensive attributes category', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Defensive Attributes')).toBeInTheDocument();
      });
    });

    it('should display Mobility attributes category', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Mobility Attributes')).toBeInTheDocument();
      });
    });

    it('should display Systems attributes category', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Systems Attributes')).toBeInTheDocument();
      });
    });

    it('should display Team Support attributes category', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Team Support Attributes')).toBeInTheDocument();
      });
    });

    it('should have Go to Robots button', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Robots Page/ })).toBeInTheDocument();
      });
    });

    it('should navigate to /robots when button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Robots Page/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Go to Robots Page/ }));
      expect(mockNavigate).toHaveBeenCalledWith('/robots');
    });

    it('should warn about higher attributes meaning higher repair costs', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Higher attributes mean higher repair costs/)).toBeInTheDocument();
      });
    });
  });


  // ─── In-Game Guide Section ─────────────────────────────────────────

  describe('In-Game Guide Section', () => {
    it('should display the in-game guide heading', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/In-Game Guide/)).toBeInTheDocument();
      });
    });

    it('should mention Game Guide contains detailed information', async () => {
      renderComponent();
      await waitFor(() => {
        // Use getAllByText since "Game Guide" appears multiple times
        expect(screen.getAllByText(/Game Guide/).length).toBeGreaterThan(0);
        expect(screen.getByText(/detailed information/)).toBeInTheDocument();
      });
    });

    it('should have Open Game Guide button', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Open Game Guide/ })).toBeInTheDocument();
      });
    });

    it('should navigate to /guide when button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Open Game Guide/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Open Game Guide/ }));
      expect(mockNavigate).toHaveBeenCalledWith('/guide');
    });
  });

  // ─── Recommended Next Steps Section ────────────────────────────────

  describe('Recommended Next Steps Section', () => {
    it('should display the recommended next steps heading', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Recommended Next Steps')).toBeInTheDocument();
      });
    });

    it('should emphasize suggestions are optional', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/you're free to do whatever you want/)).toBeInTheDocument();
      });
    });

    it('should recommend building first facility', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Build your first facility/)).toBeInTheDocument();
      });
    });

    it('should recommend upgrading robot attributes', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Upgrade robot attributes/)).toBeInTheDocument();
      });
    });

    it('should recommend checking battle readiness', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Check battle readiness/)).toBeInTheDocument();
      });
    });

    it('should recommend monitoring finances', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Monitor your finances/)).toBeInTheDocument();
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

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { success: true },
      });

      renderComponent();

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

      // Mock the post to reject
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Network error'));

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

    it('should handle replay tutorial error gracefully', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(apiClient.post).mockRejectedValue(new Error('Network error'));

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

    it('should have aria-label on daily cycle section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText('Daily Cycle System')).toBeInTheDocument();
      });
    });

    it('should have aria-label on league progression section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText('League Progression')).toBeInTheDocument();
      });
    });

    it('should have aria-label on facilities section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText('Facilities')).toBeInTheDocument();
      });
    });

    it('should have aria-label on robot attributes section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText('Robot Attributes')).toBeInTheDocument();
      });
    });

    it('should have aria-label on in-game guide section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText('In-Game Guide')).toBeInTheDocument();
      });
    });

    it('should have aria-label on recommended next steps section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText('Recommended Next Steps')).toBeInTheDocument();
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
  });
});
