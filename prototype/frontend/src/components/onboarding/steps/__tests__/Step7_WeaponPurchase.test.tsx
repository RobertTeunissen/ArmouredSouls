/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for Step7_WeaponPurchase component
 *
 * Test coverage:
 * - Component rendering with weapon guidance
 * - Strategy-specific content (multi-robot guidance)
 * - Weapon stats explanation
 * - Loadout reminder
 * - Expensive weapon warning
 * - Navigate to weapon shop
 * - Weapon owned success state
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
      if (url === '/api/weapon-inventory') {
        return Promise.resolve({
          data: choices.weaponsPurchased || [],
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

  describe('Why Weapons Are Essential', () => {
    it('should display why weapons are essential section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Why Weapons Are Essential')).toBeInTheDocument();
      });
    });

    it('should mention loadout configuration and attribute bonuses', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/loadout configuration/)).toBeInTheDocument();
        expect(screen.getByText(/attribute bonuses/)).toBeInTheDocument();
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

    it('should mention loadout type, attribute bonuses, and weapon stats', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Loadout Type/)).toBeInTheDocument();
        expect(screen.getByText(/Attribute Bonuses/)).toBeInTheDocument();
        // Use getAllByText since "Weapon Stats" appears in both the list and the section heading
        expect(screen.getAllByText(/Weapon Stats/).length).toBeGreaterThan(0);
      });
    });

    it('should explain loadout type determines combat bonuses', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Determines combat bonuses/)).toBeInTheDocument();
      });
    });

    it('should explain attribute bonuses increase effective stats', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/effective stats beyond base limits/)).toBeInTheDocument();
      });
    });
  });

  describe('Weapon Stats Explained', () => {
    it('should display weapon stats section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Understanding Weapon Stats')).toBeInTheDocument();
      });
    });

    it('should explain damage stat', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Damage')).toBeInTheDocument();
        expect(screen.getByText(/base damage dealt per hit/)).toBeInTheDocument();
      });
    });

    it('should explain speed/cooldown stat', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Speed (Cooldown)')).toBeInTheDocument();
        expect(screen.getByText(/seconds between attacks/)).toBeInTheDocument();
      });
    });

    it('should explain DPS stat', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('DPS (Damage Per Second)')).toBeInTheDocument();
        expect(screen.getByText(/most important stat for comparing weapons/)).toBeInTheDocument();
      });
    });
  });

  describe('Quick Loadout Reminder', () => {
    it('should display loadout reminder section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Quick Loadout Reminder')).toBeInTheDocument();
      });
    });

    it('should recommend Single and Weapon+Shield loadouts', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Single Loadout')).toBeInTheDocument();
        expect(screen.getByText('Weapon+Shield')).toBeInTheDocument();
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

    it('should mention the ₡250,000 threshold', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('₡250,000')).toBeInTheDocument();
      });
    });

    it('should advise to start affordable and upgrade later', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Start affordable, upgrade later/)).toBeInTheDocument();
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
    it('should render the Go to Weapon Shop button when no weapon purchased', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Weapon Shop/i })).toBeInTheDocument();
      });
    });

    it('should render the Go to Facilities Page First button', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Facilities Page First/i })).toBeInTheDocument();
      });
    });

    it('should navigate to weapon shop when button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Weapon Shop/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Go to Weapon Shop/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/weapon-shop?onboarding=true');
    });

    it('should navigate to facilities when button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Facilities Page First/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Go to Facilities Page First/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/facilities?onboarding=true');
    });
  });

  describe('Weapon Owned State', () => {
    it('should show success message when weapon was purchased', async () => {
      renderComponent('1_mighty', { weaponsPurchased: [42] });
      await waitFor(() => {
        expect(screen.getByText('Weapons Acquired!')).toBeInTheDocument();
      });
    });

    it('should show weapon count in inventory', async () => {
      renderComponent('1_mighty', { weaponsPurchased: [42] });
      await waitFor(() => {
        expect(screen.getByText(/1 Weapon in Inventory/)).toBeInTheDocument();
      });
    });

    it('should show Continue button when weapon was purchased', async () => {
      renderComponent('1_mighty', { weaponsPurchased: [42] });
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Continue to Next Step/i }),
        ).toBeInTheDocument();
      });
    });

    it('should NOT show Go to Weapon Shop as primary button when weapon was purchased', async () => {
      renderComponent('1_mighty', { weaponsPurchased: [42] });
      await waitFor(() => {
        expect(screen.getByText('Weapons Acquired!')).toBeInTheDocument();
      });
      // The primary button should be Continue, not Go to Weapon Shop
      expect(screen.queryByRole('button', { name: /Go to Facilities Page First/i })).not.toBeInTheDocument();
    });

    it('should show Buy more weapons link when weapon was purchased', async () => {
      renderComponent('1_mighty', { weaponsPurchased: [42] });
      await waitFor(() => {
        expect(screen.getByText(/Buy more weapons first/)).toBeInTheDocument();
      });
    });
  });

  describe('Next Button and Navigation', () => {
    it('should call advanceStep when Continue is clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { success: true, data: { currentStep: 8 } },
      });

      renderComponent('1_mighty', { weaponsPurchased: [42] });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Continue to Next Step/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Continue to Next Step/i }));

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
          screen.getByRole('button', { name: /Continue to Next Step/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Continue to Next Step/i }));

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
          screen.getByRole('button', { name: /Continue to Next Step/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Continue to Next Step/i }));

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });

      resolvePost!({ data: { success: true, data: { currentStep: 8 } } });

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });

    it('should disable Continue button while submitting', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      renderComponent('1_mighty', { weaponsPurchased: [42] });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Continue to Next Step/i }),
        ).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /Continue to Next Step/i }));

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
          screen.getByRole('button', { name: /Continue to Next Step/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Continue to Next Step/i }));

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Continue to Next Step/i }),
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
        const button = screen.getByRole('button', { name: /Go to Weapon Shop/i });
        expect(button).toBeInTheDocument();
        expect(button).toBeEnabled();
      });
    });

    it('should have accessible Continue button when weapon purchased', async () => {
      renderComponent('1_mighty', { weaponsPurchased: [42] });
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Continue to Next Step/i });
        expect(button).toBeInTheDocument();
        expect(button).toBeEnabled();
      });
    });
  });

  describe('Facilities Reminder', () => {
    it('should remind to buy facilities before weapons', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Buy discount facilities BEFORE weapons/)).toBeInTheDocument();
      });
    });

    it('should mention Weapons Workshop discount', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Weapons Workshop/)).toBeInTheDocument();
      });
    });
  });

  describe('Educational Tip', () => {
    it('should display educational tip about weapon selection', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Don't stress about picking the "perfect" weapon/)).toBeInTheDocument();
      });
    });

    it('should mention ability to change loadout later', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/change your loadout at any time/)).toBeInTheDocument();
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
        if (url === '/api/weapon-inventory') {
          return Promise.resolve({ data: [] });
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
