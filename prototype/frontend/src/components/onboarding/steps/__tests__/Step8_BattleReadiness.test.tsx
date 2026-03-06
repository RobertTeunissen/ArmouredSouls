/**
 * Tests for Step8_BattleReadiness component
 *
 * Test coverage:
 * - Component rendering
 * - Repair cost formula display
 * - Repair cost examples table
 * - Battle readiness checklist
 * - HP vs Shield regeneration explanation
 * - Weapon equipping guidance
 * - Multi-robot strategy content
 * - Navigation buttons (Next, Previous, Go to Robot Detail)
 * - Guided overlay interaction
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

// Mock GuidedUIOverlay
vi.mock('../../GuidedUIOverlay', () => ({
  default: ({ tooltipContent, onNext, onClose }: any) => (
    <div data-testid="guided-overlay">
      <div data-testid="overlay-content">{tooltipContent}</div>
      <button data-testid="overlay-next" onClick={onNext}>Next</button>
      <button data-testid="overlay-close" onClick={onClose}>Close</button>
    </div>
  ),
}));

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
        expect(screen.getByText(/Shields are your best friend/)).toBeInTheDocument();
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

    it('should show credits requirement', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Credits ≥ ₡100,000')).toBeInTheDocument();
      });
    });

    it('should explain all three requirements must be met', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/must meet/)).toBeInTheDocument();
        expect(screen.getByText(/all three/)).toBeInTheDocument();
      });
    });

    it('should display descriptions for each checklist item', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/must have hit points remaining/)).toBeInTheDocument();
        expect(screen.getByText(/At least one weapon must be equipped/)).toBeInTheDocument();
        expect(screen.getByText(/at least ₡100,000 in reserve/)).toBeInTheDocument();
      });
    });

    it('should render checklist as a list with proper role', async () => {
      renderComponent();
      await waitFor(() => {
        const list = screen.getByRole('list', { name: /Battle readiness checklist/ });
        expect(list).toBeInTheDocument();
        const items = within(list).getAllByRole('listitem');
        expect(items).toHaveLength(3);
      });
    });
  });

  // ─── HP vs Shield Regeneration ─────────────────────────────────────

  describe('HP vs Shield Regeneration', () => {
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

    it('should explain shields DO regenerate', async () => {
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

    it('should display Shields heading', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Shields')).toBeInTheDocument();
      });
    });

    it('should explain shields restore at no cost', async () => {
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

  // ─── Repair Cost Formula ───────────────────────────────────────────

  describe('Repair Cost Formula', () => {
    it('should display the repair cost formula section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Repair Cost Formula')).toBeInTheDocument();
      });
    });

    it('should show the formula text', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/sum_of_attributes × 100.*damage_percentage/)).toBeInTheDocument();
      });
    });

    it('should explain sum_of_attributes', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('sum_of_attributes')).toBeInTheDocument();
        expect(screen.getByText(/total of all your robot's attribute levels/)).toBeInTheDocument();
      });
    });

    it('should explain the base cost multiplier', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('× 100')).toBeInTheDocument();
        expect(screen.getByText(/Base cost multiplier/)).toBeInTheDocument();
      });
    });

    it('should explain damage_percentage', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('× damage_percentage')).toBeInTheDocument();
        expect(screen.getByText(/How much HP was lost/)).toBeInTheDocument();
      });
    });

    it('should note higher attributes mean higher repair costs', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Higher attribute levels mean higher repair costs/)).toBeInTheDocument();
      });
    });
  });

  // ─── Repair Cost Examples Table ────────────────────────────────────

  describe('Repair Cost Examples Table', () => {
    it('should display the examples section heading', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Example Repair Costs')).toBeInTheDocument();
      });
    });

    it('should show the attribute sum context', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/all 23 attributes at Level 1/)).toBeInTheDocument();
      });
    });

    it('should render a table with proper role', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('table', { name: /Repair cost examples/ })).toBeInTheDocument();
      });
    });

    it('should display all damage level labels', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Light Scratch')).toBeInTheDocument();
        expect(screen.getByText('Minor Damage')).toBeInTheDocument();
        expect(screen.getByText('Moderate Damage')).toBeInTheDocument();
        expect(screen.getByText('Heavy Damage')).toBeInTheDocument();
        expect(screen.getByText('Destroyed')).toBeInTheDocument();
      });
    });

    it('should display correct damage percentages', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('10%')).toBeInTheDocument();
        expect(screen.getByText('25%')).toBeInTheDocument();
        expect(screen.getByText('50%')).toBeInTheDocument();
        expect(screen.getByText('75%')).toBeInTheDocument();
        expect(screen.getByText('100%')).toBeInTheDocument();
      });
    });

    it('should display correct repair costs for 10% damage', async () => {
      // 23 * 100 * 0.10 = 230
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('₡230')).toBeInTheDocument();
      });
    });

    it('should display correct repair costs for 50% damage', async () => {
      // 23 * 100 * 0.50 = 1,150
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('₡1,150')).toBeInTheDocument();
      });
    });

    it('should display correct repair costs for 100% damage', async () => {
      // 23 * 100 * 1.00 = 2,300
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('₡2,300')).toBeInTheDocument();
      });
    });

    it('should have table column headers', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Damage Level')).toBeInTheDocument();
        expect(screen.getByText('Damage %')).toBeInTheDocument();
        expect(screen.getByText('Repair Cost')).toBeInTheDocument();
      });
    });

    it('should note that costs rise with attribute upgrades', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/repair costs rise proportionally/)).toBeInTheDocument();
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

    it('should mention doubled repair costs for 2_average', async () => {
      renderComponent('2_average');
      await waitFor(() => {
        expect(screen.getByText(/repair costs are doubled/)).toBeInTheDocument();
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
    it('should render the Go to Robot Detail button', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Robot Detail/ })).toBeInTheDocument();
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

  // ─── Guided Overlay ────────────────────────────────────────────────

  describe('Guided Overlay', () => {
    it('should show guided overlay when Go to Robot Detail is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Robot Detail/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Go to Robot Detail/ }));

      await waitFor(() => {
        expect(screen.getByTestId('guided-overlay')).toBeInTheDocument();
      });
    });

    it('should navigate to robots page when overlay Next is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Robot Detail/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Go to Robot Detail/ }));

      await waitFor(() => {
        expect(screen.getByTestId('overlay-next')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('overlay-next'));

      expect(mockNavigate).toHaveBeenCalledWith('/robots?onboarding=true');
    });

    it('should close overlay when Close is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Robot Detail/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Go to Robot Detail/ }));

      await waitFor(() => {
        expect(screen.getByTestId('guided-overlay')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('overlay-close'));

      await waitFor(() => {
        expect(screen.queryByTestId('guided-overlay')).not.toBeInTheDocument();
      });
    });

    it('should display overlay tooltip content about loadout section', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Robot Detail/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Go to Robot Detail/ }));

      await waitFor(() => {
        const overlay = screen.getByTestId('overlay-content');
        expect(within(overlay).getByText(/Visit Robot Detail Page/)).toBeInTheDocument();
        expect(within(overlay).getByText(/loadout section/)).toBeInTheDocument();
      });
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

    it('should still call onNext even when advanceStep encounters an error', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next step/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next step/ }));

      await waitFor(() => {
        // advanceStep catches errors internally, so onNext is still called
        expect(mockOnNext).toHaveBeenCalled();
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

    it('should have aria-label on repair cost formula section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText('Repair Cost Formula')).toBeInTheDocument();
      });
    });

    it('should have aria-label on repair cost examples section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText('Repair Cost Examples')).toBeInTheDocument();
      });
    });

    it('should have aria-label on equip weapon section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText('Equip Your Weapon')).toBeInTheDocument();
      });
    });

    it('should have accessible Go to Robot Detail button', async () => {
      renderComponent();
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Go to Robot Detail/ });
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

    it('should have table with proper column headers using scope', async () => {
      renderComponent();
      await waitFor(() => {
        const table = screen.getByRole('table');
        const headers = within(table).getAllByRole('columnheader');
        expect(headers).toHaveLength(3);
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
