/**
 * Unit tests for BudgetAllocationChart component
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import BudgetAllocationChart from '../BudgetAllocationChart';

describe('BudgetAllocationChart', () => {
  const mockCurrentSpending = {
    facilities: 500000,
    robots: 500000,
    weapons: 350000,
    attributes: 1100000
  };

  describe('Rendering', () => {
    it('should render the component with title', () => {
      render(<BudgetAllocationChart strategy="1_mighty" />);
      
      expect(screen.getByText('Recommended Budget Allocation')).toBeInTheDocument();
    });

    it('should render visual breakdown section', () => {
      render(<BudgetAllocationChart strategy="1_mighty" />);
      
      expect(screen.getByText('Visual Breakdown')).toBeInTheDocument();
    });

    it('should render budget summary section', () => {
      render(<BudgetAllocationChart strategy="1_mighty" />);
      
      expect(screen.getByText('Budget Summary')).toBeInTheDocument();
      expect(screen.getByText('Starting Budget:')).toBeInTheDocument();
    });

    it('should render important notes section', () => {
      render(<BudgetAllocationChart strategy="1_mighty" />);
      
      expect(screen.getByText('💡 Important Notes')).toBeInTheDocument();
      expect(screen.getByText(/These are guidelines, not strict requirements/)).toBeInTheDocument();
    });
  });

  describe('Strategy-specific recommendations', () => {
    it('should display correct recommendations for 1 mighty robot strategy', () => {
      render(<BudgetAllocationChart strategy="1_mighty" currentSpending={mockCurrentSpending} />);
      
      // Check that the component renders with the strategy
      expect(screen.getByText('Recommended Budget Allocation')).toBeInTheDocument();
      expect(screen.getByText('Facilities')).toBeInTheDocument();
      expect(screen.getByText('Attributes')).toBeInTheDocument();
    });

    it('should display correct recommendations for 2 average robots strategy', () => {
      render(<BudgetAllocationChart strategy="2_average" currentSpending={mockCurrentSpending} />);
      
      // Check that the component renders with the strategy
      expect(screen.getByText('Recommended Budget Allocation')).toBeInTheDocument();
      expect(screen.getByText('Facilities')).toBeInTheDocument();
    });

    it('should display correct recommendations for 3 flimsy robots strategy', () => {
      render(<BudgetAllocationChart strategy="3_flimsy" currentSpending={mockCurrentSpending} />);
      
      // Check that the component renders with the strategy
      expect(screen.getByText('Recommended Budget Allocation')).toBeInTheDocument();
      expect(screen.getByText('Facilities')).toBeInTheDocument();
    });
  });

  describe('Current spending display', () => {
    it('should display progress table when currentSpending is provided', () => {
      render(<BudgetAllocationChart strategy="1_mighty" currentSpending={mockCurrentSpending} />);
      
      expect(screen.getByText('Your Progress')).toBeInTheDocument();
      // Check that table headers exist
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Your Spending')).toBeInTheDocument();
    });

    it('should not display progress table when currentSpending is not provided', () => {
      render(<BudgetAllocationChart strategy="1_mighty" />);
      
      expect(screen.queryByText('Your Progress')).not.toBeInTheDocument();
    });

    it('should calculate and display total spent', () => {
      render(<BudgetAllocationChart strategy="1_mighty" currentSpending={mockCurrentSpending} />);
      
      expect(screen.getByText('Total Spent:')).toBeInTheDocument();
      expect(screen.getByText('₡2,450,000')).toBeInTheDocument(); // sum of spending
    });

    it('should calculate and display remaining budget', () => {
      render(<BudgetAllocationChart strategy="1_mighty" currentSpending={mockCurrentSpending} />);
      
      expect(screen.getByText('Remaining:')).toBeInTheDocument();
      // Find the remaining element in the Budget Summary section
      const remainingLabel = screen.getByText('Remaining:');
      const remainingElement = remainingLabel.nextElementSibling as HTMLElement;
      expect(remainingElement.textContent).toBe('₡550,000');
    });
  });

  describe('Status badges', () => {
    it('should show "Not Started" badge when spending is 0', () => {
      const zeroSpending = {
        facilities: 0,
        robots: 0,
        weapons: 0,
        attributes: 0
      };
      
      render(<BudgetAllocationChart strategy="1_mighty" currentSpending={zeroSpending} />);
      
      const notStartedBadges = screen.getAllByText('Not Started');
      expect(notStartedBadges.length).toBeGreaterThan(0);
    });

    it('should show "On Track" badge when spending is within range', () => {
      render(<BudgetAllocationChart strategy="1_mighty" currentSpending={mockCurrentSpending} />);
      
      const onTrackBadges = screen.getAllByText('On Track');
      expect(onTrackBadges.length).toBeGreaterThan(0);
    });

    it('should show "Under Budget" badge when spending is below minimum', () => {
      const underSpending = {
        facilities: 300000, // below 400K min
        robots: 500000,
        weapons: 350000,
        attributes: 1100000
      };
      
      render(<BudgetAllocationChart strategy="1_mighty" currentSpending={underSpending} />);
      
      expect(screen.getByText('Under Budget')).toBeInTheDocument();
    });

    it('should show "Over Budget" badge when spending exceeds maximum', () => {
      const overSpending = {
        facilities: 700000, // above 600K max
        robots: 500000,
        weapons: 350000,
        attributes: 1100000
      };
      
      render(<BudgetAllocationChart strategy="1_mighty" currentSpending={overSpending} />);
      
      expect(screen.getByText('Over Budget')).toBeInTheDocument();
    });
  });

  describe('Color coding', () => {
    it('should apply correct colors to each category', () => {
      const { container } = render(
        <BudgetAllocationChart strategy="1_mighty" currentSpending={mockCurrentSpending} />
      );
      
      // Check for color indicators in the table
      const colorDots = container.querySelectorAll('.w-3.h-3.rounded-full');
      expect(colorDots.length).toBeGreaterThan(0);
    });
  });

  describe('Remaining budget color coding', () => {
    it('should show green when remaining is above reserve minimum', () => {
      const goodSpending = {
        facilities: 500000,
        robots: 500000,
        weapons: 300000,
        attributes: 1000000
      }; // Remaining: 700K (above 500K min)
      
      render(
        <BudgetAllocationChart strategy="1_mighty" currentSpending={goodSpending} />
      );
      
      // Find the remaining element in the Budget Summary section
      const remainingLabel = screen.getByText('Remaining:');
      const remainingElement = remainingLabel.nextElementSibling as HTMLElement;
      expect(remainingElement).toHaveClass('text-green-400');
      expect(remainingElement.textContent).toBe('₡700,000');
    });

    it('should show yellow when remaining is between 200K and reserve minimum', () => {
      const warningSpending = {
        facilities: 500000,
        robots: 500000,
        weapons: 400000,
        attributes: 1200000
      }; // Remaining: 400K (between 200K and 500K)
      
      render(
        <BudgetAllocationChart strategy="1_mighty" currentSpending={warningSpending} />
      );
      
      // Find the remaining element in the Budget Summary section
      const remainingLabel = screen.getByText('Remaining:');
      const remainingElement = remainingLabel.nextElementSibling as HTMLElement;
      expect(remainingElement).toHaveClass('text-yellow-400');
      expect(remainingElement.textContent).toBe('₡400,000');
    });

    it('should show red when remaining is below 200K', () => {
      const criticalSpending = {
        facilities: 600000,
        robots: 500000,
        weapons: 400000,
        attributes: 1350000
      }; // Remaining: 150K (below 200K)
      
      render(
        <BudgetAllocationChart strategy="1_mighty" currentSpending={criticalSpending} />
      );
      
      // Find the remaining element in the Budget Summary section
      const remainingLabel = screen.getByText('Remaining:');
      const remainingElement = remainingLabel.nextElementSibling as HTMLElement;
      expect(remainingElement).toHaveClass('text-red-400');
      expect(remainingElement.textContent).toBe('₡150,000');
    });
  });

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      render(<BudgetAllocationChart strategy="1_mighty" currentSpending={mockCurrentSpending} />);
      
      const tables = screen.getAllByRole('table');
      expect(tables.length).toBeGreaterThan(0);
    });

    it('should have table headers', () => {
      render(<BudgetAllocationChart strategy="1_mighty" currentSpending={mockCurrentSpending} />);
      
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Recommended')).toBeInTheDocument();
      expect(screen.getByText('Your Spending')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  describe('Important notes', () => {
    it('should display all important notes', () => {
      render(<BudgetAllocationChart strategy="1_mighty" />);
      
      expect(screen.getByText(/These are guidelines, not strict requirements/)).toBeInTheDocument();
      expect(screen.getByText(/Facility discounts compound over time/)).toBeInTheDocument();
      expect(screen.getByText(/Keep at least ₡50,000 reserve/)).toBeInTheDocument();
      expect(screen.getByText(/Adjust based on your playstyle/)).toBeInTheDocument();
    });
  });
});
