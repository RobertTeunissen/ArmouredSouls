/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for Step7_WeaponPurchase component
 *
 * Test coverage:
 * - Component rendering with weapon recommendations
 * - Strategy-specific content (multi-robot guidance)
 * - Weapon recommendation cards display
 * - Loadout type bonuses reference
 * - Expensive weapon warning
 * - Weapons Workshop discount explanation
 * - Remaining credits display
 * - Navigate to weapon shop with overlay
 * - Weapon purchased success state
 * - Next button and advanceStep integration
 * - Loading/submitting states
 * - Error handling
 * - Accessibility
 *
 * Requirements: 10.1-10.14
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Step7_WeaponPurchase from '../Step7_WeaponPurchase';
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

describe('Step7_WeaponPurchase', () => {
  const mockOnNext = vi.fn();

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
            currentStep: 7,
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
            <Step7_WeaponPurchase onNext={mockOnNext} />
          </OnboardingProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
  };

  describe('Component Rendering', () => {
    it('should render the step title', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Purchase Your First Weapon')).toBeInTheDocument();
      });
    });

    it('should display introductory description', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Your robot needs a weapon to enter battles/)).toBeInTheDocument();
      });
    });

    it('should explain robots require weapons to battle', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/cannot participate in battles/)).toBeInTheDocument();
      });
    });
  });

  describe('Weapon Recommendations', () => {
    it('should display all three recommended starter weapons', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Laser Rifle')).toBeInTheDocument();
        expect(screen.getByText('Machine Gun')).toBeInTheDocument();
        expect(screen.getByText('Combat Knife')).toBeInTheDocument();
      });
    });

    it('should show weapon costs', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('₡244,000')).toBeInTheDocument();
        expect(screen.getByText('₡150,000')).toBeInTheDocument();
        expect(screen.getByText('₡100,000')).toBeInTheDocument();
      });
    });

    it('should show weapon attribute bonuses', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('+Combat Power, +Targeting Systems')).toBeInTheDocument();
        expect(screen.getByText('+Attack Speed, +Weapon Control')).toBeInTheDocument();
        expect(screen.getByText('+Critical Systems, +Evasion Thrusters')).toBeInTheDocument();
      });
    });

    it('should highlight the recommended weapon with a tag', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Best Value')).toBeInTheDocument();
        expect(screen.getByText('Budget Friendly')).toBeInTheDocument();
        expect(screen.getByText('Most Affordable')).toBeInTheDocument();
      });
    });

    it('should show remaining credits after each weapon purchase', async () => {
      renderComponent('1_mighty', {}, 2_000_000);
      await waitFor(() => {
        // Each weapon card shows "After purchase:" with remaining credits
        const afterPurchaseLabels = screen.getAllByText(/After purchase:/);
        expect(afterPurchaseLabels.length).toBe(3);
      });
    });
  });

  describe('Loadout Type Bonuses', () => {
    it('should display loadout type bonuses reference', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Loadout Type Bonuses')).toBeInTheDocument();
      });
    });

    it('should show all four loadout types', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Balanced')).toBeInTheDocument();
        expect(screen.getByText('Defensive')).toBeInTheDocument();
        expect(screen.getByText('High Damage')).toBeInTheDocument();
        expect(screen.getByText('Fast Attacks')).toBeInTheDocument();
      });
    });

    it('should recommend Single or Weapon+Shield for beginners', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/recommend starting with/)).toBeInTheDocument();
      });
    });
  });

  describe('Expensive Weapon Warning', () => {
    it('should warn against expensive weapons during onboarding', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Avoid Expensive Weapons During Onboarding/)).toBeInTheDocument();
      });
    });

    it('should mention the ₡300,000 threshold', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('₡300,000')).toBeInTheDocument();
      });
    });
  });

  describe('Weapons Workshop Discount', () => {
    it('should explain Weapons Workshop discount savings', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Weapons Workshop Discount')).toBeInTheDocument();
      });
    });

    it('should show a concrete savings example', async () => {
      renderComponent();
      await waitFor(() => {
        // Workshop Level 5 = 25% discount
        // Laser Rifle ₡244,000 → ₡183,000 (saves ₡61,000)
        expect(screen.getByText(/25% discount/)).toBeInTheDocument();
        expect(screen.getByText(/saves ₡61,000/)).toBeInTheDocument();
      });
    });
  });

  describe('What Matters for Weapons', () => {
    it('should explain what matters for weapon selection', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/What Actually Matters for Weapons/)).toBeInTheDocument();
      });
    });

    it('should mention loadout type, attribute bonuses, and stacking', async () => {
      renderComponent();
      await waitFor(() => {
        // These are the bold labels in the "What Actually Matters" section
        const section = screen.getByText(/What Actually Matters for Weapons/);
        expect(section).toBeInTheDocument();
        expect(screen.getByText(/Determines combat bonuses/)).toBeInTheDocument();
        expect(screen.getByText(/effective stats beyond base limits/)).toBeInTheDocument();
        expect(screen.getByText(/stack with robot base attributes/)).toBeInTheDocument();
      });
    });

    it('should remind about weapon type not affecting gameplay', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/doesn't directly affect gameplay/i)).toBeInTheDocument();
      });
    });
  });

  describe('Strategy-Specific Content', () => {
    it('should NOT show multi-robot guidance for 1_mighty strategy', async () => {
      renderComponent('1_mighty');
      await waitFor(() => {
        expect(screen.getByText('Purchase Your First Weapon')).toBeInTheDocument();
      });
      expect(screen.queryByText(/Weapon Reminders/)).not.toBeInTheDocument();
    });

    it('should show 2-robot guidance for 2_average strategy', async () => {
      renderComponent('2_average');
      await waitFor(() => {
        expect(screen.getByText('2 Robot Strategy: Weapon Reminders')).toBeInTheDocument();
      });
      expect(screen.getByText(/at least 2 weapons/)).toBeInTheDocument();
    });

    it('should show 3-robot guidance for 3_flimsy strategy', async () => {
      renderComponent('3_flimsy');
      await waitFor(() => {
        expect(screen.getByText('3 Robot Strategy: Weapon Reminders')).toBeInTheDocument();
      });
      expect(screen.getByText(/at least 3 weapons/)).toBeInTheDocument();
    });

    it('should mention storage for 3_flimsy strategy', async () => {
      renderComponent('3_flimsy');
      await waitFor(() => {
        expect(screen.getByText(/Base storage holds only 5 weapons/)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation to Weapon Shop', () => {
    it('should render the Visit Weapon Shop button when no weapon purchased', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Visit Weapon Shop/i })).toBeInTheDocument();
      });
    });

    it('should show guided overlay when Visit Weapon Shop is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Visit Weapon Shop/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Visit Weapon Shop/i }));

      await waitFor(() => {
        expect(screen.getByTestId('guided-overlay')).toBeInTheDocument();
      });
    });

    it('should navigate to weapon shop when overlay Next is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Visit Weapon Shop/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Visit Weapon Shop/i }));

      await waitFor(() => {
        expect(screen.getByTestId('overlay-next')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('overlay-next'));

      expect(mockNavigate).toHaveBeenCalledWith('/weapons?onboarding=true');
    });

    it('should close overlay when Close is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Visit Weapon Shop/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Visit Weapon Shop/i }));

      await waitFor(() => {
        expect(screen.getByTestId('guided-overlay')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('overlay-close'));

      await waitFor(() => {
        expect(screen.queryByTestId('guided-overlay')).not.toBeInTheDocument();
      });
    });
  });

  describe('Weapon Purchased State', () => {
    it('should show success message when weapon was purchased', async () => {
      renderComponent('1_mighty', { weaponsPurchased: [42] });
      await waitFor(() => {
        expect(screen.getByText('Weapon Purchased!')).toBeInTheDocument();
      });
    });

    it('should show Next button when weapon was purchased', async () => {
      renderComponent('1_mighty', { weaponsPurchased: [42] });
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Next: Battle Readiness/i }),
        ).toBeInTheDocument();
      });
    });

    it('should NOT show Visit Weapon Shop button when weapon was purchased', async () => {
      renderComponent('1_mighty', { weaponsPurchased: [42] });
      await waitFor(() => {
        expect(screen.getByText('Weapon Purchased!')).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: /Visit Weapon Shop/i })).not.toBeInTheDocument();
    });
  });

  describe('Next Button and Navigation', () => {
    it('should call advanceStep when Next is clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { success: true, data: { currentStep: 8 } },
      });

      renderComponent('1_mighty', { weaponsPurchased: [42] });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Next: Battle Readiness/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Battle Readiness/i }));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalled();
      });
    });

    it('should call onNext callback after advancing step', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { success: true, data: { currentStep: 8 } },
      });

      renderComponent('1_mighty', { weaponsPurchased: [42] });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Next: Battle Readiness/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Battle Readiness/i }));

      await waitFor(() => {
        expect(mockOnNext).toHaveBeenCalled();
      });
    });

    it('should show loading state while submitting', async () => {
      const user = userEvent.setup();

      let resolvePost: (value: any) => void;
      vi.mocked(apiClient.post).mockImplementation(
        () => new Promise((resolve) => { resolvePost = resolve; }),
      );

      renderComponent('1_mighty', { weaponsPurchased: [42] });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Next: Battle Readiness/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Battle Readiness/i }));

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });

      resolvePost!({ data: { success: true, data: { currentStep: 8 } } });

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });

    it('should disable Next button while submitting', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      renderComponent('1_mighty', { weaponsPurchased: [42] });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Next: Battle Readiness/i }),
        ).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /Next: Battle Readiness/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Loading/i })).toBeDisabled();
      });
    });
  });

  describe('Skip Functionality', () => {
    it('should show skip option when no weapon purchased', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Skip for now/)).toBeInTheDocument();
      });
    });

    it('should call advanceStep when skip is clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { success: true, data: { currentStep: 8 } },
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

      renderComponent('1_mighty', { weaponsPurchased: [42] });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Next: Battle Readiness/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Battle Readiness/i }));

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Next: Battle Readiness/i }),
        ).toBeEnabled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      renderComponent();
      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /Purchase Your First Weapon/i }),
        ).toBeInTheDocument();
      });
    });

    it('should have accessible action buttons', async () => {
      renderComponent();
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Visit Weapon Shop/i });
        expect(button).toBeInTheDocument();
        expect(button).toBeEnabled();
      });
    });

    it('should have accessible Next button when weapon purchased', async () => {
      renderComponent('1_mighty', { weaponsPurchased: [42] });
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Next: Battle Readiness/i });
        expect(button).toBeInTheDocument();
        expect(button).toBeEnabled();
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
              currency: 2_000_000,
              prestige: 0,
            },
          });
        }
        return Promise.resolve({
          data: {
            success: true,
            data: {
              currentStep: 7,
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
              <Step7_WeaponPurchase onNext={mockOnNext} />
            </OnboardingProvider>
          </AuthProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Purchase Your First Weapon')).toBeInTheDocument();
      });
      // Should NOT show multi-robot guidance for default 1_mighty
      expect(screen.queryByText(/Weapon Reminders/)).not.toBeInTheDocument();
    });
  });
});
