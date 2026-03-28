/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for Step8_BattleReadiness component
 *
 * Test coverage:
 * - Component rendering
 * - Battle readiness checklist (HP above 0, weapon equipped)
 * - HP vs Energy Shield regeneration explanation
 * - Repair cost mechanics (cost per HP, manual discount, attribute scaling, destruction penalty)
 * - Yielding strategy explanation
 * - Weapon equipping guidance
 * - Multi-robot strategy content
 * - Navigation buttons (Next, Previous, Go to Robots Page)
 * - Loading/submitting states
 * - Error handling
 * - Accessibility (ARIA labels, roles)
 *
 * Requirements: 11.1-11.11, 12.1-12.11
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Step8_BattleReadiness from '../Step8_BattleReadiness';
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

describe('Step8_BattleReadiness', () => {
  const mockOnNext = vi.fn();
  const mockOnPrevious = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (
    strategy: string = '1_mighty',
    choices: any = {},
    currency: number = 2_000_000,
  ) => {
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
      return Promise.resolve({
        data: {
          success: true,
          data: {
            currentStep: 8,
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
            <Step8_BattleReadiness
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
    it('should render the step title', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Battle Readiness & Repair Costs')).toBeInTheDocument();
      });
    });

    it('should display introductory description', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Before your robot can fight/)).toBeInTheDocument();
      });
    });

    it('should render the main content area with proper role', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('main', { name: /Battle Readiness and Repair Costs/ })).toBeInTheDocument();
      });
    });

    it('should render the educational tip at the bottom', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Energy shields are your best friend/)).toBeInTheDocument();
      });
    });
  });

  // ─── Battle Readiness Checklist ────────────────────────────────────

  describe('Battle Readiness Checklist', () => {
    it('should display the battle readiness requirements section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Battle Readiness Requirements')).toBeInTheDocument();
      });
    });

    it('should show HP above 0 requirement', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('HP above 0')).toBeInTheDocument();
      });
    });

    it('should show weapon equipped requirement', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Weapon equipped')).toBeInTheDocument();
      });
    });

    it('should explain both requirements must be met', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/must meet/)).toBeInTheDocument();
        expect(screen.getByText(/both/)).toBeInTheDocument();
      });
    });

    it('should display descriptions for each checklist item', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/must have hit points remaining/)).toBeInTheDocument();
        expect(screen.getByText(/At least one weapon must be equipped/)).toBeInTheDocument();
      });
    });

    it('should render checklist as a list with proper role', async () => {
      renderComponent();
      await waitFor(() => {
        const list = screen.getByRole('list', { name: /Battle readiness checklist/ });
        expect(list).toBeInTheDocument();
        const items = within(list).getAllByRole('listitem');
        expect(items).toHaveLength(2);
      });
    });

    it('should note no minimum credit balance required', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/No minimum credit balance required/)).toBeInTheDocument();
      });
    });
  });

  // ─── HP vs Energy Shield Regeneration ─────────────────────────────────────

  describe('HP vs Energy Shield Regeneration', () => {
    it('should display the HP vs Shield section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('HP vs Shield Regeneration')).toBeInTheDocument();
      });
    });

    it('should explain HP does NOT regenerate', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/HP does/)).toBeInTheDocument();
        expect(screen.getByText('NOT')).toBeInTheDocument();
      });
    });

    it('should explain energy shields DO regenerate', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('DO')).toBeInTheDocument();
      });
    });

    it('should display Hit Points heading', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Hit Points (HP)')).toBeInTheDocument();
      });
    });

    it('should display Energy Shields heading', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Energy Shields')).toBeInTheDocument();
      });
    });

    it('should explain energy shields restore at no cost', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/fully restore after each battle at no cost/)).toBeInTheDocument();
      });
    });

    it('should explain HP requires credits to repair', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/must pay credits to repair/)).toBeInTheDocument();
      });
    });
  });

  // ─── Repair Cost Mechanics ───────────────────────────────────────────

  describe('Repair Cost Mechanics', () => {
    it('should display the repair cost mechanics section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('How Repair Costs Work')).toBeInTheDocument();
      });
    });

    it('should explain cost per HP damage', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Cost Per HP Damage/)).toBeInTheDocument();
        expect(screen.getByText(/pay a certain amount of credits for each HP point/)).toBeInTheDocument();
      });
    });

    it('should explain 50% manual repair discount', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/50% Manual Repair Discount/)).toBeInTheDocument();
        // Use getAllByText since "Repair All" appears multiple times
        expect(screen.getAllByText(/Repair All/).length).toBeGreaterThan(0);
      });
    });

    it('should explain higher attributes mean higher costs', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Higher Attributes = Higher Costs/)).toBeInTheDocument();
        expect(screen.getByText(/higher attribute levels cost more to repair/)).toBeInTheDocument();
      });
    });

    it('should explain destruction penalty', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Destruction Penalty/)).toBeInTheDocument();
        expect(screen.getByText(/repair costs are significantly higher/)).toBeInTheDocument();
      });
    });
  });

  // ─── Yielding Strategy ─────────────────────────────────────────────

  describe('Yielding Strategy', () => {
    it('should display the yielding section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Yielding: Your Cost-Saving Strategy')).toBeInTheDocument();
      });
    });

    it('should explain what yielding is', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/surrender a battle before your robot is destroyed/)).toBeInTheDocument();
      });
    });

    it('should explain why to yield', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Why Yield?')).toBeInTheDocument();
        expect(screen.getByText(/Lower repair costs/)).toBeInTheDocument();
        expect(screen.getByText(/Preserve HP/)).toBeInTheDocument();
      });
    });

    it('should explain when to yield', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('When to Yield?')).toBeInTheDocument();
        expect(screen.getByText(/heavily damaged and likely to be destroyed/)).toBeInTheDocument();
      });
    });

    it('should mention yield threshold setting', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/yield threshold/)).toBeInTheDocument();
      });
    });
  });

  // ─── Weapon Equipping Guidance ─────────────────────────────────────

  describe('Weapon Equipping Guidance', () => {
    it('should display the equip weapon section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Equip Your Weapon')).toBeInTheDocument();
      });
    });

    it('should explain visiting robot detail page', async () => {
      renderComponent();
      await waitFor(() => {
        const section = screen.getByLabelText('Equip Your Weapon');
        expect(within(section).getByText(/Visit your robot's detail page to equip/)).toBeInTheDocument();
      });
    });

    it('should mention weapon attribute bonuses updating stats', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/stats will update to reflect weapon attribute bonuses/)).toBeInTheDocument();
      });
    });
  });

  // ─── Multi-Robot Strategy Content ──────────────────────────────────

  describe('Multi-Robot Strategy Content', () => {
    it('should NOT show multi-robot guidance for 1_mighty strategy', async () => {
      renderComponent('1_mighty');
      await waitFor(() => {
        expect(screen.getByText('Battle Readiness & Repair Costs')).toBeInTheDocument();
      });
      expect(screen.queryByText(/Repair Cost Considerations/)).not.toBeInTheDocument();
    });

    it('should show 2-robot guidance for 2_average strategy', async () => {
      renderComponent('2_average');
      await waitFor(() => {
        expect(screen.getByText('2 Robot Strategy: Repair Cost Considerations')).toBeInTheDocument();
      });
    });

    it('should mention repair costs accumulate for 2_average', async () => {
      renderComponent('2_average');
      await waitFor(() => {
        expect(screen.getByText(/repair costs accumulate across both robots/)).toBeInTheDocument();
      });
    });

    it('should show 3-robot guidance for 3_flimsy strategy', async () => {
      renderComponent('3_flimsy');
      await waitFor(() => {
        expect(screen.getByText('3 Robot Strategy: Repair Cost Considerations')).toBeInTheDocument();
      });
    });

    it('should mention lower-attribute advantage for 3_flimsy', async () => {
      renderComponent('3_flimsy');
      await waitFor(() => {
        expect(screen.getByText(/Lower-attribute robots are cheaper to repair/)).toBeInTheDocument();
      });
    });

    it('should render multi-robot points as a list', async () => {
      renderComponent('2_average');
      await waitFor(() => {
        const section = screen.getByLabelText('Multi-robot repair costs');
        const items = within(section).getAllByRole('listitem');
        expect(items.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  // ─── Navigation Buttons ────────────────────────────────────────────

  describe('Navigation Buttons', () => {
    it('should render the Go to Robots Page button', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Robots Page/ })).toBeInTheDocument();
      });
    });

    it('should render the Next button', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next step/ })).toBeInTheDocument();
      });
    });

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

    it('should navigate to robots page when Go to Robots Page is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Robots Page/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Go to Robots Page/ }));

      expect(mockNavigate).toHaveBeenCalledWith('/robots?onboarding=true');
    });

    it('should call advanceStep and onNext when Next is clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { success: true, data: { currentStep: 9 } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next step/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next step/ }));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockOnNext).toHaveBeenCalled();
      });
    });

    it('should show loading state while submitting Next', async () => {
      const user = userEvent.setup();

      let resolvePost: (value: any) => void;
      vi.mocked(apiClient.post).mockImplementation(
        () => new Promise((resolve) => { resolvePost = resolve; }),
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next step/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next step/ }));

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });

      resolvePost!({ data: { success: true, data: { currentStep: 9 } } });

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });

    it('should disable Next button while submitting', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next step/ })).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /Next step/ }));

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });

      // The button with Loading... text should be disabled
      const loadingButton = screen.getByText('Loading...').closest('button');
      expect(loadingButton).toBeDisabled();
    });
  });

  // ─── Error Handling ────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should recover from advanceStep failure', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next step/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next step/ }));

      await waitFor(() => {
        // Button should be re-enabled after error
        expect(screen.getByRole('button', { name: /Next step/ })).toBeEnabled();
      });

      consoleSpy.mockRestore();
    });
  });

  // ─── Accessibility ─────────────────────────────────────────────────

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      renderComponent();
      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /Battle Readiness & Repair Costs/ }),
        ).toBeInTheDocument();
      });
    });

    it('should have aria-label on main content area', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('main', { name: /Battle Readiness and Repair Costs/ })).toBeInTheDocument();
      });
    });

    it('should have aria-label on battle readiness section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText('Battle Readiness Requirements')).toBeInTheDocument();
      });
    });

    it('should have aria-label on HP vs Shield section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText('HP vs Shield Regeneration')).toBeInTheDocument();
      });
    });

    it('should have aria-label on repair cost mechanics section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText('Repair Cost Mechanics')).toBeInTheDocument();
      });
    });

    it('should have aria-label on yielding section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText('Yielding Strategy')).toBeInTheDocument();
      });
    });

    it('should have aria-label on equip weapon section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText('Equip Your Weapon')).toBeInTheDocument();
      });
    });

    it('should have accessible Go to Robots Page button', async () => {
      renderComponent();
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Go to Robots Page/ });
        expect(button).toBeInTheDocument();
        expect(button).toBeEnabled();
      });
    });

    it('should have accessible Next button with aria-label', async () => {
      renderComponent();
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Next step/ });
        expect(button).toBeInTheDocument();
      });
    });

    it('should have accessible Previous button with aria-label', async () => {
      renderComponent();
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Previous step/ });
        expect(button).toBeInTheDocument();
      });
    });

    it('should have aria-hidden on decorative SVG icon', async () => {
      renderComponent();
      await waitFor(() => {
        const svgs = document.querySelectorAll('svg[aria-hidden="true"]');
        expect(svgs.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ─── Default Strategy Fallback ─────────────────────────────────────

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
              currency: 2_000_000,
              prestige: 0,
            },
          });
        }
        return Promise.resolve({
          data: {
            success: true,
            data: {
              currentStep: 8,
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
              <Step8_BattleReadiness
                onNext={mockOnNext}
                onPrevious={mockOnPrevious}
              />
            </OnboardingProvider>
          </AuthProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Battle Readiness & Repair Costs')).toBeInTheDocument();
      });
      // Should NOT show multi-robot guidance for default 1_mighty
      expect(screen.queryByText(/Repair Cost Considerations/)).not.toBeInTheDocument();
    });
  });
});
