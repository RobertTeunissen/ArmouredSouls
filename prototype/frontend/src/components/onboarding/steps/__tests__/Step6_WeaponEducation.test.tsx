/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for Step6_WeaponEducation component
 *
 * Test coverage:
 * - Component rendering with weapon types and loadout diagrams
 * - Strategy-specific content (multi-robot guidance)
 * - Loadout expand/collapse interaction
 * - Weapon slot explanation
 * - Loadout restrictions display
 * - Attribute bonus stacking explanation
 * - Next button and advanceStep integration
 * - Loading/submitting states
 * - Error handling
 * - Accessibility
 *
 * Requirements: 7.1-7.13, 10.1-10.14
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Step6_WeaponEducation from '../Step6_WeaponEducation';
import { OnboardingProvider } from '../../../../contexts/OnboardingContext';
import { AuthProvider } from '../../../../contexts/AuthContext';
import apiClient from '../../../../utils/apiClient';

// Mock apiClient
vi.mock('../../../../utils/apiClient');

// Mock LoadoutDiagram
vi.mock('../../LoadoutDiagram', () => ({
  default: ({ loadoutType, showDetails, compact }: any) => (
    <div data-testid={`loadout-diagram-${loadoutType}`} data-show-details={showDetails} data-compact={compact}>
      LoadoutDiagram: {loadoutType}
    </div>
  ),
}));

describe('Step6_WeaponEducation', () => {
  const mockOnNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (strategy: string = '1_mighty', choices: any = {}) => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/user/profile') {
        return Promise.resolve({
          data: {
            id: 1,
            username: 'testuser',
            email: 'test@test.com',
            role: 'player',
            currency: 2500000,
            prestige: 0,
          },
        });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: {
            currentStep: 6,
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
            <Step6_WeaponEducation onNext={mockOnNext} />
          </OnboardingProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  };

  describe('Component Rendering', () => {
    it('should render the step title', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Weapon Types & Loadouts')).toBeInTheDocument();
      });
    });

    it('should display introductory description', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Before purchasing weapons/)).toBeInTheDocument();
      });
    });
  });

  describe('Weapon Types Section', () => {
    it('should display all four weapon types', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Energy')).toBeInTheDocument();
        expect(screen.getByText('Ballistic')).toBeInTheDocument();
        expect(screen.getByText('Melee')).toBeInTheDocument();
        expect(screen.getByText('Shield')).toBeInTheDocument();
      });
    });

    it('should explain weapon type does not directly affect gameplay', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/weapon type does not directly affect/)).toBeInTheDocument();
      });
    });

    it('should display weapon type descriptions', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Laser rifles, plasma cannons/)).toBeInTheDocument();
        expect(screen.getByText(/Machine guns, shotguns/)).toBeInTheDocument();
        expect(screen.getByText(/Combat knives, swords/)).toBeInTheDocument();
        expect(screen.getByText(/Defensive equipment for the offhand/)).toBeInTheDocument();
      });
    });
  });

  describe('Weapon Slot Explanation', () => {
    it('should explain main hand and off hand slots', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Weapon Slots: Main Hand & Off Hand/)).toBeInTheDocument();
      });
    });

    it('should describe each slot usage per loadout', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Main hand holds one weapon, off hand is empty/)).toBeInTheDocument();
        expect(screen.getByText(/Main hand holds a weapon, off hand holds a shield/)).toBeInTheDocument();
        expect(screen.getByText(/A large weapon occupies both slots/)).toBeInTheDocument();
        expect(screen.getByText(/Each hand holds a one-handed weapon/)).toBeInTheDocument();
      });
    });
  });

  describe('Loadout Configurations', () => {
    it('should render LoadoutDiagram for all four loadout types', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByTestId('loadout-diagram-single')).toBeInTheDocument();
        expect(screen.getByTestId('loadout-diagram-weapon_shield')).toBeInTheDocument();
        expect(screen.getByTestId('loadout-diagram-two_handed')).toBeInTheDocument();
        expect(screen.getByTestId('loadout-diagram-dual_wield')).toBeInTheDocument();
      });
    });

    it('should render loadout diagrams in compact mode by default', async () => {
      renderComponent();
      await waitFor(() => {
        const singleDiagram = screen.getByTestId('loadout-diagram-single');
        expect(singleDiagram.getAttribute('data-compact')).toBe('true');
        expect(singleDiagram.getAttribute('data-show-details')).toBe('false');
      });
    });

    it('should expand a loadout diagram when clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('loadout-diagram-single')).toBeInTheDocument();
      });

      // Click the single loadout button
      const buttons = screen.getAllByRole('button');
      const singleButton = buttons.find(btn => btn.querySelector('[data-testid="loadout-diagram-single"]'));
      if (singleButton) {
        await user.click(singleButton);
      }

      await waitFor(() => {
        const singleDiagram = screen.getByTestId('loadout-diagram-single');
        expect(singleDiagram.getAttribute('data-show-details')).toBe('true');
        expect(singleDiagram.getAttribute('data-compact')).toBe('false');
      });
    });

    it('should collapse an expanded loadout when clicked again', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('loadout-diagram-single')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const singleButton = buttons.find(btn => btn.querySelector('[data-testid="loadout-diagram-single"]'));

      // Click to expand
      if (singleButton) {
        await user.click(singleButton);
      }

      await waitFor(() => {
        expect(screen.getByTestId('loadout-diagram-single').getAttribute('data-show-details')).toBe('true');
      });

      // Click again to collapse
      if (singleButton) {
        await user.click(singleButton);
      }

      await waitFor(() => {
        expect(screen.getByTestId('loadout-diagram-single').getAttribute('data-show-details')).toBe('false');
      });
    });
  });

  describe('Loadout Restrictions', () => {
    it('should display loadout restrictions section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Loadout Restrictions')).toBeInTheDocument();
      });
    });

    it('should explain shield restrictions', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Shields can/)).toBeInTheDocument();
      });
    });

    it('should explain two-handed restrictions', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Two-handed weapons occupy/)).toBeInTheDocument();
      });
    });

    it('should explain dual-wield restrictions', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Dual-wield requires/)).toBeInTheDocument();
      });
    });

    it('should explain attribute bonus stacking', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Weapon attribute bonuses/)).toBeInTheDocument();
      });
    });
  });

  describe('Attribute Bonus Stacking', () => {
    it('should display the bonus stacking section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('How Weapon Bonuses Stack')).toBeInTheDocument();
      });
    });

    it('should show a concrete example', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/base Combat Power 10/)).toBeInTheDocument();
        expect(screen.getByText(/14 Combat Power/)).toBeInTheDocument();
      });
    });

    it('should display the attribute bonus stacking image', async () => {
      renderComponent();
      await waitFor(() => {
        const img = screen.getByAltText(/Diagram showing how weapon attribute bonuses stack/);
        expect(img).toBeInTheDocument();
        expect(img.getAttribute('src')).toBe('/assets/onboarding/loadouts/attribute-bonus-stacking.svg');
      });
    });
  });

  describe('Strategy-Specific Content', () => {
    it('should NOT show multi-robot guidance for 1_mighty strategy', async () => {
      renderComponent('1_mighty');
      await waitFor(() => {
        expect(screen.getByText('Weapon Types & Loadouts')).toBeInTheDocument();
      });
      expect(screen.queryByText(/Weapon Considerations/)).not.toBeInTheDocument();
    });

    it('should show 2-robot guidance for 2_average strategy', async () => {
      renderComponent('2_average');
      await waitFor(() => {
        expect(screen.getByText('2 Robot Strategy: Weapon Considerations')).toBeInTheDocument();
      });
      expect(screen.getByText(/weapons cannot be shared between robots/)).toBeInTheDocument();
    });

    it('should show 3-robot guidance for 3_flimsy strategy', async () => {
      renderComponent('3_flimsy');
      await waitFor(() => {
        expect(screen.getByText('3 Robot Strategy: Weapon Considerations')).toBeInTheDocument();
      });
      expect(screen.getByText(/Storage Facility is essential/)).toBeInTheDocument();
    });

    it('should mention storage for 3_flimsy strategy', async () => {
      renderComponent('3_flimsy');
      await waitFor(() => {
        expect(screen.getByText(/base storage only holds 5 weapons/)).toBeInTheDocument();
      });
    });
  });

  describe('Next Button and Navigation', () => {
    it('should render the Next button', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Purchase Your First Weapon/i })).toBeInTheDocument();
      });
    });

    it('should call advanceStep when Next is clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { success: true, data: { currentStep: 7 } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Purchase Your First Weapon/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Purchase Your First Weapon/i }));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalled();
      });
    });

    it('should call onNext callback after advancing step', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { success: true, data: { currentStep: 7 } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Purchase Your First Weapon/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Purchase Your First Weapon/i }));

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

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Purchase Your First Weapon/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Purchase Your First Weapon/i }));

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });

      resolvePost!({ data: { success: true, data: { currentStep: 7 } } });

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });

    it('should disable Next button while submitting', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Purchase Your First Weapon/i })).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /Next: Purchase Your First Weapon/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Loading/i })).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should recover from advanceStep failure', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Purchase Your First Weapon/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Purchase Your First Weapon/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Purchase Your First Weapon/i })).toBeEnabled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Weapon Types & Loadouts/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /Weapon Types$/i })).toBeInTheDocument();
      });
    });

    it('should have aria-expanded on loadout toggle buttons', async () => {
      renderComponent();
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const loadoutButtons = buttons.filter(btn => btn.getAttribute('aria-expanded') !== null);
        expect(loadoutButtons.length).toBe(4);
      });
    });

    it('should have accessible Next button', async () => {
      renderComponent();
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Next: Purchase Your First Weapon/i });
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
              currency: 2500000,
              prestige: 0,
            },
          });
        }
        return Promise.resolve({
          data: {
            success: true,
            data: {
              currentStep: 6,
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
              <Step6_WeaponEducation onNext={mockOnNext} />
            </OnboardingProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Weapon Types & Loadouts')).toBeInTheDocument();
      });
      // Should NOT show multi-robot guidance for default 1_mighty
      expect(screen.queryByText(/Weapon Considerations/)).not.toBeInTheDocument();
    });
  });
});
