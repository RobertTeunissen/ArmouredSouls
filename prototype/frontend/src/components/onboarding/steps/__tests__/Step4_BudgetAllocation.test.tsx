/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for Step4_BudgetAllocation component
 *
 * Test coverage:
 * - Component rendering with different strategies
 * - Strategy-specific content display
 * - Budget allocation chart integration
 * - Toggle comparison table functionality
 * - Next button click handling and advanceStep integration
 * - Loading/submitting states
 * - Error handling for advanceStep failures
 * - Educational content sections (guidelines, compounding, storage)
 * - Accessibility (headings, buttons)
 *
 * Requirements: 6.1-6.9, 19.1-19.9
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Step4_BudgetAllocation from '../Step4_BudgetAllocation';
import { OnboardingProvider } from '../../../../contexts/OnboardingContext';
import apiClient from '../../../../utils/apiClient';

// Mock apiClient
vi.mock('../../../../utils/apiClient');

// Mock child components
vi.mock('../../BudgetAllocationChart', () => ({
  default: ({ strategy }: { strategy: string }) => (
    <div data-testid="budget-allocation-chart">
      BudgetAllocationChart for {strategy}
    </div>
  ),
}));

vi.mock('../../BudgetComparisonTable', () => ({
  default: ({ recommendations, currentSpending }: any) => (
    <div data-testid="budget-comparison-table">
      BudgetComparisonTable recommendations={JSON.stringify(recommendations)} spending={JSON.stringify(currentSpending)}
    </div>
  ),
}));

describe('Step4_BudgetAllocation', () => {
  const mockOnNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for getting tutorial state
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        success: true,
        data: {
          currentStep: 4,
          hasCompletedOnboarding: false,
          onboardingSkipped: false,
          strategy: '1_mighty',
          choices: {},
        },
      },
    });
  });

  const renderComponent = (strategy: string = '1_mighty') => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        success: true,
        data: {
          currentStep: 4,
          hasCompletedOnboarding: false,
          onboardingSkipped: false,
          strategy,
          choices: {},
        },
      },
    });

    return render(
      <OnboardingProvider>
        <Step4_BudgetAllocation onNext={mockOnNext} />
      </OnboardingProvider>
    );
  };

  describe('Component Rendering', () => {
    it('should render the step title', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Budget Allocation Guide')).toBeInTheDocument();
      });
    });

    it('should render the guidelines disclaimer', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('These Are Guidelines, Not Rules')).toBeInTheDocument();
      });
    });

    it('should render the facility discount compounding section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Facility Discounts Compound Over Time')).toBeInTheDocument();
      });
    });

    it('should render the weapon storage section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Weapon Storage & Storage Facility')).toBeInTheDocument();
      });
    });

    it('should render the educational note', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/You can always revisit this information later/)).toBeInTheDocument();
      });
    });

    it('should render the Next button with correct label', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Create Your Robot/i })).toBeInTheDocument();
      });
    });
  });

  describe('Strategy-Specific Content', () => {
    it('should display 1 Mighty Robot strategy details', async () => {
      renderComponent('1_mighty');
      await waitFor(() => {
        expect(screen.getAllByText(/1 Mighty Robot/).length).toBeGreaterThan(0);
        expect(screen.getByText(/Heavy investment in attribute upgrades/)).toBeInTheDocument();
      });
    });

    it('should display 2 Average Robots strategy details', async () => {
      renderComponent('2_average');
      await waitFor(() => {
        expect(screen.getAllByText(/2 Average Robots/).length).toBeGreaterThan(0);
        expect(screen.getByText(/Balanced spending across all categories/)).toBeInTheDocument();
      });
    });

    it('should display 3 Flimsy Robots strategy details', async () => {
      renderComponent('3_flimsy');
      await waitFor(() => {
        expect(screen.getAllByText(/3 Flimsy Robots/).length).toBeGreaterThan(0);
        expect(screen.getByText(/Highest facility investment/)).toBeInTheDocument();
      });
    });

    it('should show storage note for 1_mighty strategy', async () => {
      renderComponent('1_mighty');
      await waitFor(() => {
        expect(screen.getByText(/weapon storage is rarely an issue/)).toBeInTheDocument();
      });
    });

    it('should show storage note for 2_average strategy', async () => {
      renderComponent('2_average');
      await waitFor(() => {
        expect(screen.getByText(/you may need Storage Facility/)).toBeInTheDocument();
      });
    });

    it('should show storage note for 3_flimsy strategy', async () => {
      renderComponent('3_flimsy');
      await waitFor(() => {
        expect(screen.getByText(/Storage Facility is essential/)).toBeInTheDocument();
      });
    });
  });

  describe('BudgetAllocationChart Integration', () => {
    it('should render BudgetAllocationChart with 1_mighty strategy', async () => {
      renderComponent('1_mighty');
      await waitFor(() => {
        const chart = screen.getByTestId('budget-allocation-chart');
        expect(chart).toBeInTheDocument();
        expect(chart).toHaveTextContent('BudgetAllocationChart for 1_mighty');
      });
    });

    it('should render BudgetAllocationChart with 2_average strategy', async () => {
      renderComponent('2_average');
      await waitFor(() => {
        const chart = screen.getByTestId('budget-allocation-chart');
        expect(chart).toHaveTextContent('BudgetAllocationChart for 2_average');
      });
    });

    it('should render BudgetAllocationChart with 3_flimsy strategy', async () => {
      renderComponent('3_flimsy');
      await waitFor(() => {
        const chart = screen.getByTestId('budget-allocation-chart');
        expect(chart).toHaveTextContent('BudgetAllocationChart for 3_flimsy');
      });
    });
  });

  describe('Toggle Comparison Table', () => {
    it('should not show comparison table by default', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Budget Allocation Guide')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('budget-comparison-table')).not.toBeInTheDocument();
    });

    it('should show comparison table when toggle button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Show Budget Comparison Table/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Show Budget Comparison Table/));

      await waitFor(() => {
        expect(screen.getByTestId('budget-comparison-table')).toBeInTheDocument();
      });
    });

    it('should hide comparison table when toggle button is clicked again', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Show Budget Comparison Table/)).toBeInTheDocument();
      });

      // Show
      await user.click(screen.getByText(/Show Budget Comparison Table/));
      await waitFor(() => {
        expect(screen.getByTestId('budget-comparison-table')).toBeInTheDocument();
      });

      // Hide
      await user.click(screen.getByText(/Hide Budget Comparison Table/));
      await waitFor(() => {
        expect(screen.queryByTestId('budget-comparison-table')).not.toBeInTheDocument();
      });
    });

    it('should pass correct props to BudgetComparisonTable', async () => {
      const user = userEvent.setup();
      renderComponent('1_mighty');

      await waitFor(() => {
        expect(screen.getByText(/Show Budget Comparison Table/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Show Budget Comparison Table/));

      await waitFor(() => {
        const table = screen.getByTestId('budget-comparison-table');
        expect(table).toHaveTextContent('recommendations=');
        expect(table).toHaveTextContent('spending=');
      });
    });
  });

  describe('Next Button and Navigation', () => {
    it('should call advanceStep when Next button is clicked', async () => {
      const user = userEvent.setup();

      // Mock the POST for advanceStep
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { success: true, data: { currentStep: 5 } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Create Your Robot/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Create Your Robot/i }));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalled();
      });
    });

    it('should call onNext callback after advancing step', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { success: true, data: { currentStep: 5 } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Create Your Robot/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Create Your Robot/i }));

      await waitFor(() => {
        expect(mockOnNext).toHaveBeenCalled();
      });
    });

    it('should show loading state while submitting', async () => {
      const user = userEvent.setup();

      // Create a promise that we control
      let resolvePost: (value: any) => void;
      vi.mocked(apiClient.post).mockImplementation(
        () => new Promise((resolve) => { resolvePost = resolve; })
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Create Your Robot/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Create Your Robot/i }));

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });

      // Resolve the promise
      resolvePost!({ data: { success: true, data: { currentStep: 5 } } });

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
        expect(screen.getByRole('button', { name: /Next: Create Your Robot/i })).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /Next: Create Your Robot/i }));

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
        expect(screen.getByRole('button', { name: /Next: Create Your Robot/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Create Your Robot/i }));

      // Button should re-enable after error
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Create Your Robot/i })).toBeEnabled();
      });

      consoleSpy.mockRestore();
    });

    it('should still call onNext even when advanceStep has internal error', async () => {
      const user = userEvent.setup();
      vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Create Your Robot/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Next: Create Your Robot/i }));

      // advanceStep in OnboardingContext catches errors internally and doesn't re-throw,
      // so the component's handleNext always reaches onNext?.()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next: Create Your Robot/i })).toBeEnabled();
      });

      expect(mockOnNext).toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });

  describe('Educational Content', () => {
    it('should explain Weapons Workshop discount', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Weapons Workshop:/)).toBeInTheDocument();
        expect(screen.getByText(/Saves 5-50% on every weapon purchase/)).toBeInTheDocument();
      });
    });

    it('should explain Training Facility discount', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Training Facility:/)).toBeInTheDocument();
        expect(screen.getByText(/Saves 10-90% on attribute upgrades/)).toBeInTheDocument();
      });
    });

    it('should emphasize combined savings', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Combined, these two facilities can save you hundreds of thousands/)).toBeInTheDocument();
      });
    });

    it('should display strategy highlights for each strategy', async () => {
      renderComponent('1_mighty');
      await waitFor(() => {
        expect(screen.getByText(/Lower facility costs since Roster Expansion is not needed/)).toBeInTheDocument();
      });
    });

    it('should mention Roster Expansion for 2_average strategy', async () => {
      renderComponent('2_average');
      await waitFor(() => {
        expect(screen.getByText(/Roster Expansion required/)).toBeInTheDocument();
      });
    });

    it('should mention Roster Expansion Level 2 for 3_flimsy strategy', async () => {
      renderComponent('3_flimsy');
      await waitFor(() => {
        expect(screen.getByText(/Roster Expansion Level 2/)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      renderComponent();
      await waitFor(() => {
        const headings = screen.getAllByRole('heading');
        expect(headings.length).toBeGreaterThan(0);
        expect(screen.getByRole('heading', { name: /Budget Allocation Guide/i })).toBeInTheDocument();
      });
    });

    it('should have accessible Next button', async () => {
      renderComponent();
      await waitFor(() => {
        const nextButton = screen.getByRole('button', { name: /Next: Create Your Robot/i });
        expect(nextButton).toBeInTheDocument();
        expect(nextButton).toBeEnabled();
      });
    });

    it('should have accessible toggle button', async () => {
      renderComponent();
      await waitFor(() => {
        const toggleButton = screen.getByRole('button', { name: /Show Budget Comparison Table/i });
        expect(toggleButton).toBeInTheDocument();
        expect(toggleButton).toBeEnabled();
      });
    });
  });

  describe('Default Strategy Fallback', () => {
    it('should fall back to 1_mighty when no strategy is set', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          success: true,
          data: {
            currentStep: 4,
            hasCompletedOnboarding: false,
            onboardingSkipped: false,
            strategy: null,
            choices: {},
          },
        },
      });

      render(
        <OnboardingProvider>
          <Step4_BudgetAllocation onNext={mockOnNext} />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/1 Mighty Robot/).length).toBeGreaterThan(0);
      });
    });
  });
});
