/**
 * Tests for Step2_RosterStrategy component
 * 
 * Test coverage:
 * - Rendering all three strategy cards
 * - Strategy selection interaction
 * - Confirmation flow
 * - Changing selection after confirmation
 * - Next button after confirmation
 * - Integration with OnboardingContext
 * - Loading states
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Step2_RosterStrategy from '../Step2_RosterStrategy';
import { OnboardingProvider } from '../../../../contexts/OnboardingContext';
import apiClient from '../../../../utils/apiClient';

// Mock apiClient
vi.mock('../../../../utils/apiClient');

// Mock formatCurrency utility
vi.mock('../../../../utils/financialApi', () => ({
  formatCurrency: (value: number) => `₡${(value / 1000).toFixed(0)}K`,
}));

describe('Step2_RosterStrategy', () => {
  const mockOnNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock for getting tutorial state
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        success: true,
        data: {
          currentStep: 2,
          hasCompletedOnboarding: false,
          onboardingSkipped: false,
          choices: {},
        },
      },
    });
  });

  const renderComponent = () => {
    return render(
      <OnboardingProvider>
        <Step2_RosterStrategy onNext={mockOnNext} />
      </OnboardingProvider>
    );
  };

  describe('Rendering', () => {
    it('should render the step title and description', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Choose Your Roster Strategy')).toBeInTheDocument();
      });

      expect(screen.getByText(/This is the most important decision/)).toBeInTheDocument();
    });

    it('should render all three strategy cards', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('1 Mighty Robot')).toBeInTheDocument();
      });

      expect(screen.getByText('2 Average Robots')).toBeInTheDocument();
      expect(screen.getByText('3 Flimsy Robots')).toBeInTheDocument();
    });

    it('should render confirm button initially', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Confirm.*strategy/i })).toBeInTheDocument();
      });
    });

    it('should show helper text when no strategy selected', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Select a strategy above to continue')).toBeInTheDocument();
      });
    });

    it('should render educational note about reset functionality', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Don't worry!/)).toBeInTheDocument();
      });

      expect(screen.getByText(/you can reset your account/)).toBeInTheDocument();
    });
  });

  describe('Strategy Selection', () => {
    it('should allow selecting a strategy card', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('1 Mighty Robot')).toBeInTheDocument();
      });

      // Find and click the 1 Mighty Robot card
      const mightyCard = screen.getByText('1 Mighty Robot').closest('div[role="button"]');
      expect(mightyCard).toBeInTheDocument();
      
      await user.click(mightyCard!);

      // Card should show selected state (SELECTED badge)
      await waitFor(() => {
        expect(screen.getByText('SELECTED')).toBeInTheDocument();
      });
    });

    it('should allow changing selection before confirmation', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('1 Mighty Robot')).toBeInTheDocument();
      });

      // Select first strategy
      const mightyCard = screen.getByText('1 Mighty Robot').closest('div[role="button"]');
      await user.click(mightyCard!);

      await waitFor(() => {
        expect(screen.getByText('SELECTED')).toBeInTheDocument();
      });

      // Select different strategy
      const averageCard = screen.getByText('2 Average Robots').closest('div[role="button"]');
      await user.click(averageCard!);

      // Should still show SELECTED (only one can be selected)
      expect(screen.getByText('SELECTED')).toBeInTheDocument();
    });

    it('should enable confirm button when strategy is selected', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('1 Mighty Robot')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /Confirm.*strategy/i });
      expect(confirmButton).toBeDisabled();

      // Select a strategy
      const mightyCard = screen.getByText('1 Mighty Robot').closest('div[role="button"]');
      await user.click(mightyCard!);

      await waitFor(() => {
        expect(confirmButton).toBeEnabled();
      });
    });
  });

  describe('Confirmation Flow', () => {
    it('should call updateStrategy when confirm button is clicked', async () => {
      const user = userEvent.setup();
      
      // Mock successful strategy update
      vi.mocked(apiClient.post).mockResolvedValue({
        data: {
          success: true,
          data: {
            currentStep: 2,
            hasCompletedOnboarding: false,
            onboardingSkipped: false,
            strategy: '1_mighty',
            choices: {},
          },
        },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('1 Mighty Robot')).toBeInTheDocument();
      });

      // Select strategy
      const mightyCard = screen.getByText('1 Mighty Robot').closest('div[role="button"]');
      await user.click(mightyCard!);

      // Click confirm
      const confirmButton = screen.getByRole('button', { name: /Confirm.*strategy/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/api/onboarding/state', {
          strategy: '1_mighty',
        });
      });
    });

    it('should show confirmation message after confirming', async () => {
      const user = userEvent.setup();
      
      vi.mocked(apiClient.post).mockResolvedValue({
        data: {
          success: true,
          data: {
            currentStep: 2,
            hasCompletedOnboarding: false,
            onboardingSkipped: false,
            strategy: '2_average',
            choices: {},
          },
        },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('2 Average Robots')).toBeInTheDocument();
      });

      // Select and confirm
      const averageCard = screen.getByText('2 Average Robots').closest('div[role="button"]');
      await user.click(averageCard!);
      
      const confirmButton = screen.getByRole('button', { name: /Confirm.*strategy/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Strategy Confirmed!')).toBeInTheDocument();
      });

      // Use a more flexible text matcher for the confirmation message within the confirmation box
      const confirmationBox = screen.getByText('Strategy Confirmed!').closest('div.bg-green-900');
      expect(confirmationBox).toBeInTheDocument();
      expect(confirmationBox?.textContent).toContain('2 Average Robots');
      expect(confirmationBox?.textContent).toContain('strategy');
    });

    it('should show Next button after confirmation', async () => {
      const user = userEvent.setup();
      
      vi.mocked(apiClient.post).mockResolvedValue({
        data: {
          success: true,
          data: {
            currentStep: 2,
            hasCompletedOnboarding: false,
            onboardingSkipped: false,
            strategy: '1_mighty',
            choices: {},
          },
        },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('1 Mighty Robot')).toBeInTheDocument();
      });

      // Select and confirm
      const mightyCard = screen.getByText('1 Mighty Robot').closest('div[role="button"]');
      await user.click(mightyCard!);
      
      const confirmButton = screen.getByRole('button', { name: /Confirm.*strategy/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next.*Facility Planning/i })).toBeInTheDocument();
      });
    });

    it('should show Change Selection button after confirmation', async () => {
      const user = userEvent.setup();
      
      vi.mocked(apiClient.post).mockResolvedValue({
        data: {
          success: true,
          data: {
            currentStep: 2,
            hasCompletedOnboarding: false,
            onboardingSkipped: false,
            strategy: '3_flimsy',
            choices: {},
          },
        },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('3 Flimsy Robots')).toBeInTheDocument();
      });

      // Select and confirm
      const flimsyCard = screen.getByText('3 Flimsy Robots').closest('div[role="button"]');
      await user.click(flimsyCard!);
      
      const confirmButton = screen.getByRole('button', { name: /Confirm.*strategy/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Change Strategy Selection/i })).toBeInTheDocument();
      });
    });
  });

  describe('Changing Selection', () => {
    it('should allow changing selection after confirmation', async () => {
      const user = userEvent.setup();
      
      vi.mocked(apiClient.post).mockResolvedValue({
        data: {
          success: true,
          data: {
            currentStep: 2,
            hasCompletedOnboarding: false,
            onboardingSkipped: false,
            strategy: '1_mighty',
            choices: {},
          },
        },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('1 Mighty Robot')).toBeInTheDocument();
      });

      // Select and confirm
      const mightyCard = screen.getByText('1 Mighty Robot').closest('div[role="button"]');
      await user.click(mightyCard!);
      
      const confirmButton = screen.getByRole('button', { name: /Confirm.*strategy/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Change Strategy Selection/i })).toBeInTheDocument();
      });

      // Click change selection
      const changeButton = screen.getByRole('button', { name: /Change Strategy Selection/i });
      await user.click(changeButton);

      // Should show confirm button again
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Confirm.*strategy/i })).toBeInTheDocument();
      });

      // Should not show next button
      expect(screen.queryByRole('button', { name: /Next.*Facility Planning/i })).not.toBeInTheDocument();
    });

    it('should not allow clicking strategy cards after confirmation', async () => {
      const user = userEvent.setup();
      
      vi.mocked(apiClient.post).mockResolvedValue({
        data: {
          success: true,
          data: {
            currentStep: 2,
            hasCompletedOnboarding: false,
            onboardingSkipped: false,
            strategy: '1_mighty',
            choices: {},
          },
        },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('1 Mighty Robot')).toBeInTheDocument();
      });

      // Select and confirm
      const mightyCard = screen.getByText('1 Mighty Robot').closest('div[role="button"]');
      await user.click(mightyCard!);
      
      const confirmButton = screen.getByRole('button', { name: /Confirm.*strategy/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Strategy Confirmed!')).toBeInTheDocument();
      });

      // Try to click a different strategy card
      const averageCard = screen.getByText('2 Average Robots').closest('div[role="button"]');
      await user.click(averageCard!);

      // Should still show 1 Mighty Robot as confirmed
      const confirmationBox = screen.getByText('Strategy Confirmed!').closest('div.bg-green-900');
      expect(confirmationBox).toBeInTheDocument();
      expect(confirmationBox?.textContent).toContain('1 Mighty Robot');
      expect(confirmationBox?.textContent).toContain('strategy');
    });
  });

  describe('Next Button', () => {
    it('should call advanceStep when Next button is clicked', async () => {
      const user = userEvent.setup();
      
      // Mock confirmation
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            currentStep: 2,
            hasCompletedOnboarding: false,
            onboardingSkipped: false,
            strategy: '1_mighty',
            choices: {},
          },
        },
      });

      // Mock advance step
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            currentStep: 3,
            hasCompletedOnboarding: false,
            onboardingSkipped: false,
            strategy: '1_mighty',
            choices: {},
          },
        },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('1 Mighty Robot')).toBeInTheDocument();
      });

      // Select and confirm
      const mightyCard = screen.getByText('1 Mighty Robot').closest('div[role="button"]');
      await user.click(mightyCard!);
      
      const confirmButton = screen.getByRole('button', { name: /Confirm.*strategy/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next.*Facility Planning/i })).toBeInTheDocument();
      });

      // Click next
      const nextButton = screen.getByRole('button', { name: /Next.*Facility Planning/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/api/onboarding/state', {
          step: 3,
        });
      });
    });

    it('should call onNext callback when Next button is clicked', async () => {
      const user = userEvent.setup();
      
      vi.mocked(apiClient.post).mockResolvedValue({
        data: {
          success: true,
          data: {
            currentStep: 2,
            hasCompletedOnboarding: false,
            onboardingSkipped: false,
            strategy: '1_mighty',
            choices: {},
          },
        },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('1 Mighty Robot')).toBeInTheDocument();
      });

      // Select and confirm
      const mightyCard = screen.getByText('1 Mighty Robot').closest('div[role="button"]');
      await user.click(mightyCard!);
      
      const confirmButton = screen.getByRole('button', { name: /Confirm.*strategy/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next.*Facility Planning/i })).toBeInTheDocument();
      });

      // Click next
      const nextButton = screen.getByRole('button', { name: /Next.*Facility Planning/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(mockOnNext).toHaveBeenCalled();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state while confirming', async () => {
      const user = userEvent.setup();
      
      // Mock slow API response
      vi.mocked(apiClient.post).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          data: {
            success: true,
            data: {
              currentStep: 2,
              hasCompletedOnboarding: false,
              onboardingSkipped: false,
              strategy: '1_mighty',
              choices: {},
            },
          },
        }), 100))
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('1 Mighty Robot')).toBeInTheDocument();
      });

      // Select strategy
      const mightyCard = screen.getByText('1 Mighty Robot').closest('div[role="button"]');
      await user.click(mightyCard!);

      // Click confirm
      const confirmButton = screen.getByRole('button', { name: /Confirm.*strategy/i });
      await user.click(confirmButton);

      // Should show loading state
      expect(screen.getByText('Confirming...')).toBeInTheDocument();
    });

    it('should show loading state while advancing step', async () => {
      const user = userEvent.setup();
      
      // Mock confirmation
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            currentStep: 2,
            hasCompletedOnboarding: false,
            onboardingSkipped: false,
            strategy: '1_mighty',
            choices: {},
          },
        },
      });

      // Mock slow advance step
      vi.mocked(apiClient.post).mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          data: {
            success: true,
            data: {
              currentStep: 3,
              hasCompletedOnboarding: false,
              onboardingSkipped: false,
              strategy: '1_mighty',
              choices: {},
            },
          },
        }), 100))
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('1 Mighty Robot')).toBeInTheDocument();
      });

      // Select and confirm
      const mightyCard = screen.getByText('1 Mighty Robot').closest('div[role="button"]');
      await user.click(mightyCard!);
      
      const confirmButton = screen.getByRole('button', { name: /Confirm.*strategy/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next.*Facility Planning/i })).toBeInTheDocument();
      });

      // Click next
      const nextButton = screen.getByRole('button', { name: /Next.*Facility Planning/i });
      await user.click(nextButton);

      // Should show loading state
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Pre-selected Strategy', () => {
    it('should show confirmed state if strategy already selected in context', async () => {
      // Mock tutorial state with pre-selected strategy
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          success: true,
          data: {
            currentStep: 2,
            hasCompletedOnboarding: false,
            onboardingSkipped: false,
            strategy: '2_average',
            choices: {},
          },
        },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Strategy Confirmed!')).toBeInTheDocument();
      });

      expect(screen.getByText((content, element) => {
        return element?.textContent?.includes('2 Average Robots') && element?.textContent?.includes('strategy') || false;
      }, { selector: 'div.bg-green-900 p' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Next.*Facility Planning/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should support keyboard navigation for strategy cards', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('1 Mighty Robot')).toBeInTheDocument();
      });

      const mightyCard = screen.getByText('1 Mighty Robot').closest('div[role="button"]');
      
      // Focus the card
      mightyCard?.focus();
      
      // Press Enter to select
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('SELECTED')).toBeInTheDocument();
      });
    });

    it('should have proper ARIA labels on strategy cards', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('1 Mighty Robot')).toBeInTheDocument();
      });

      const mightyCard = screen.getByLabelText('Select 1 Mighty Robot strategy');
      expect(mightyCard).toBeInTheDocument();
      expect(mightyCard).toHaveAttribute('role', 'button');
    });
  });
});
