/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for Step6_WeaponEducation component
 *
 * Test coverage:
 * - Component rendering with loadout configurations
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

  describe('Understanding Weapons Section', () => {
    it('should display understanding weapons section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Understanding Weapons')).toBeInTheDocument();
      });
    });

    it('should explain weapon flexibility', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Weapon Flexibility')).toBeInTheDocument();
      });
    });

    it('should explain that only one robot can wield a weapon at a time', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/only one robot can wield a weapon at any given time/)).toBeInTheDocument();
      });
    });

    it('should mention loadout configuration and attribute bonuses', async () => {
      renderComponent();
      await waitFor(() => {
        // Use getAllByText since these phrases appear multiple times
        expect(screen.getAllByText(/loadout configuration/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/attribute bonuses/i).length).toBeGreaterThan(0);
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
    it('should display loadout configurations section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Loadout Configurations')).toBeInTheDocument();
      });
    });

    it('should display all four loadout types', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Single Weapon')).toBeInTheDocument();
        expect(screen.getByText('Weapon + Shield')).toBeInTheDocument();
        expect(screen.getByText('Two-Handed')).toBeInTheDocument();
        expect(screen.getByText('Dual Wield')).toBeInTheDocument();
      });
    });

    it('should have clickable loadout cards', async () => {
      renderComponent();
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const loadoutButtons = buttons.filter(btn => btn.getAttribute('aria-expanded') !== null);
        expect(loadoutButtons.length).toBe(4);
      });
    });

    it('should expand a loadout card when clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Single Weapon')).toBeInTheDocument();
      });

      // Find the Single loadout button
      const buttons = screen.getAllByRole('button');
      const singleButton = buttons.find(btn => 
        btn.getAttribute('aria-expanded') !== null && 
        btn.textContent?.includes('Single Weapon')
      );
      
      expect(singleButton).toBeDefined();
      expect(singleButton?.getAttribute('aria-expanded')).toBe('false');

      if (singleButton) {
        await user.click(singleButton);
      }

      await waitFor(() => {
        expect(singleButton?.getAttribute('aria-expanded')).toBe('true');
      });
    });

    it('should collapse an expanded loadout when clicked again', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Single Weapon')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const singleButton = buttons.find(btn => 
        btn.getAttribute('aria-expanded') !== null && 
        btn.textContent?.includes('Single Weapon')
      );

      // Click to expand
      if (singleButton) {
        await user.click(singleButton);
      }

      await waitFor(() => {
        expect(singleButton?.getAttribute('aria-expanded')).toBe('true');
      });

      // Click again to collapse
      if (singleButton) {
        await user.click(singleButton);
      }

      await waitFor(() => {
        expect(singleButton?.getAttribute('aria-expanded')).toBe('false');
      });
    });

    it('should show expanded details with slot info', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Single Weapon')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const singleButton = buttons.find(btn => 
        btn.getAttribute('aria-expanded') !== null && 
        btn.textContent?.includes('Single Weapon')
      );

      if (singleButton) {
        await user.click(singleButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Main Hand:')).toBeInTheDocument();
        expect(screen.getByText('Off Hand:')).toBeInTheDocument();
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

    it('should explain complementary weapons and loadouts', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/complementary weapons and loadouts/)).toBeInTheDocument();
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
        expect(screen.getByRole('button', { name: /Next: Facility & Weapon Planning/i })).toBeInTheDocument();
      });
    });

    it('should call advanceStep when Next is clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { success: true, data: { currentStep: 7 } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Facility & Weapon Planning/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Facility & Weapon Planning/i }));

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
        expect(screen.getByRole('button', { name: /Next: Facility & Weapon Planning/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Facility & Weapon Planning/i }));

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
        expect(screen.getByRole('button', { name: /Next: Facility & Weapon Planning/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Facility & Weapon Planning/i }));

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
        expect(screen.getByRole('button', { name: /Next: Facility & Weapon Planning/i })).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /Next: Facility & Weapon Planning/i }));

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
        expect(screen.getByRole('button', { name: /Next: Facility & Weapon Planning/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Facility & Weapon Planning/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Facility & Weapon Planning/i })).toBeEnabled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Weapon Types & Loadouts/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /Understanding Weapons/i })).toBeInTheDocument();
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
        const button = screen.getByRole('button', { name: /Next: Facility & Weapon Planning/i });
        expect(button).toBeInTheDocument();
        expect(button).toBeEnabled();
      });
    });
  });

  describe('Educational Tip', () => {
    it('should display educational tip', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/You don't need to memorize all loadout details/)).toBeInTheDocument();
      });
    });

    it('should mention ability to change loadout from robot detail page', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/change your loadout at any time from the robot detail page/)).toBeInTheDocument();
      });
    });
  });

  describe('Facilities Reminder', () => {
    it('should remind to buy discount facilities before weapons', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Buy discount facilities/)).toBeInTheDocument();
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
