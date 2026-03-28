import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Step1_Welcome from '../Step1_Welcome';

describe('Step1_Welcome', () => {
  describe('Component Rendering', () => {
    it('should render the welcome heading', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText('Welcome to Armoured Souls')).toBeInTheDocument();
    });

    it('should render the game tagline', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText(/Build, battle, and dominate/i)).toBeInTheDocument();
    });

    it('should display the fundamental strategic question', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText('"How many robots should I build?"')).toBeInTheDocument();
    });

    it('should display the starting budget amount', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      // Budget appears multiple times, so use getAllByText
      const budgetElements = screen.getAllByText(/₡3,000,000/);
      expect(budgetElements.length).toBeGreaterThan(0);
    });

    it('should render the strategic overview section', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText(/How do you want to be the most successful manager/i)).toBeInTheDocument();
    });
  });

  describe('Tutorial Steps Display', () => {
    it('should display all 9 tutorial steps', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      // Check for step numbers 1-9
      for (let i = 1; i <= 9; i++) {
        expect(screen.getByText(i.toString())).toBeInTheDocument();
      }
    });

    it('should display step 1: Welcome & Overview', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText('Welcome & Overview')).toBeInTheDocument();
      expect(screen.getByText('Understanding the strategic landscape')).toBeInTheDocument();
    });

    it('should display step 2: Roster Strategy', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText('Roster Strategy')).toBeInTheDocument();
      expect(screen.getByText('Choose 1, 2, or 3 robots')).toBeInTheDocument();
    });

    it('should display step 3: Facility Planning', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText('Facility Planning')).toBeInTheDocument();
      expect(screen.getByText('Which facilities to buy and when')).toBeInTheDocument();
    });

    it('should display step 4: Budget Allocation', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText('Budget Allocation')).toBeInTheDocument();
      expect(screen.getByText('How to spend your ₡3,000,000')).toBeInTheDocument();
    });

    it('should display step 5: Create Your Robot', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText('Create Your Robot')).toBeInTheDocument();
      expect(screen.getByText('Build your first combat robot')).toBeInTheDocument();
    });

    it('should display step 6: Weapon & Loadout', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText('Weapon & Loadout')).toBeInTheDocument();
      expect(screen.getByText('Understanding weapon configurations')).toBeInTheDocument();
    });

    it('should display step 7: Purchase Weapons', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText('Purchase Weapons')).toBeInTheDocument();
      expect(screen.getByText('Equip your robot for battle')).toBeInTheDocument();
    });

    it('should display step 8: Battle Readiness', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText('Battle Readiness')).toBeInTheDocument();
      expect(screen.getByText('Repair costs and preparation')).toBeInTheDocument();
    });

    it('should display step 9: Complete Setup', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText('Complete Setup')).toBeInTheDocument();
      expect(screen.getByText(/Review your strategy and get personalized recommendations/)).toBeInTheDocument();
    });
  });

  describe('Key Principles Section', () => {
    it('should display the key principle about spending money once', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText('Remember: You Can Only Spend Your Money Once')).toBeInTheDocument();
    });

    it('should mention the ability to reset account', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText(/if you make mistakes, you can reset your account and start over/i)).toBeInTheDocument();
    });

    it('should explain trade-offs and informed decisions', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText(/Every credit you spend on one thing is a credit you can't spend on something else/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should display "Let\'s Get Started" button', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByRole('button', { name: /Next step/i })).toBeInTheDocument();
    });

    it('should call onNext when "Let\'s Get Started" button is clicked', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      const nextButton = screen.getByRole('button', { name: /Next step/i });
      fireEvent.click(nextButton);
      
      expect(mockOnNext).toHaveBeenCalledTimes(1);
    });

    it('should display step indicator showing "Step 1 of 9"', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText('Step 1 of 9')).toBeInTheDocument();
    });
  });

  describe('Visual Assets', () => {
    it('should render game logo image with correct src', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      const logoImage = screen.getByAltText('Armoured Souls');
      expect(logoImage).toBeInTheDocument();
      expect(logoImage).toHaveAttribute('src', '/assets/onboarding/game-logo.png');
    });

    it('should render strategic overview image with correct src', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      const overviewImage = screen.getByAltText(/Strategic overview/i);
      expect(overviewImage).toBeInTheDocument();
      expect(overviewImage).toHaveAttribute('src', '/assets/onboarding/strategic-overview.png');
    });

    it('should handle missing game logo gracefully', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      const logoImage = screen.getByAltText('Armoured Souls');
      
      // Simulate image load error
      fireEvent.error(logoImage);
      
      // Image should be hidden but not crash
      expect(logoImage).toHaveStyle({ display: 'none' });
    });

    it('should handle missing strategic overview image gracefully', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      const overviewImage = screen.getByAltText(/Strategic overview/i);
      
      // Simulate image load error
      fireEvent.error(overviewImage);
      
      // Image should be hidden but not crash
      expect(overviewImage).toHaveStyle({ display: 'none' });
    });
  });

  describe('Content Validation', () => {
    it('should explain that the tutorial guides budget decisions', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText(/This tutorial will guide you through understanding these strategic implications/i)).toBeInTheDocument();
    });

    it('should mention facilities, budget, weapons, and progression', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText(/It affects which facilities you need/i)).toBeInTheDocument();
    });

    it('should emphasize the importance of the roster decision', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText(/This single decision shapes your entire strategy/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      const h1 = screen.getByRole('heading', { level: 1, name: /Welcome to Armoured Souls/i });
      expect(h1).toBeInTheDocument();
      
      const h2 = screen.getByRole('heading', { level: 2, name: /How do you want to be the most successful manager/i });
      expect(h2).toBeInTheDocument();
    });

    it('should have accessible button with clear label', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      const button = screen.getByRole('button', { name: /Next step/i });
      expect(button).toBeInTheDocument();
      expect(button).toBeEnabled();
    });

    it('should have alt text for all images', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      const images = screen.getAllByRole('img');
      images.forEach(img => {
        expect(img).toHaveAttribute('alt');
        expect(img.getAttribute('alt')).not.toBe('');
      });
    });
  });

  describe('Responsive Design', () => {
    it('should render without layout errors', () => {
      const mockOnNext = vi.fn();
      const { container } = render(<Step1_Welcome onNext={mockOnNext} />);
      
      // Check that main container exists
      expect(container.querySelector('.max-w-4xl')).toBeInTheDocument();
    });

    it('should have responsive grid for tutorial steps', () => {
      const mockOnNext = vi.fn();
      const { container } = render(<Step1_Welcome onNext={mockOnNext} />);
      
      // Check for responsive grid classes
      const grid = container.querySelector('.grid.md\\:grid-cols-2');
      expect(grid).toBeInTheDocument();
    });
  });

  describe('Requirements Validation', () => {
    it('should satisfy Requirement 2.2: Display welcome message and game overview', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText('Welcome to Armoured Souls')).toBeInTheDocument();
      expect(screen.getByText(/Build, battle, and dominate/i)).toBeInTheDocument();
    });

    it('should satisfy Requirement 2.2: Explain the fundamental strategic choice', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText('"How many robots should I build?"')).toBeInTheDocument();
      expect(screen.getByText(/This single decision shapes your entire strategy/i)).toBeInTheDocument();
    });

    it('should satisfy Requirement 2.2: Introduce the 9-step tutorial flow', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      expect(screen.getByText('What You\'ll Learn in This Tutorial')).toBeInTheDocument();
      
      // Verify all 9 steps are listed
      for (let i = 1; i <= 9; i++) {
        expect(screen.getByText(i.toString())).toBeInTheDocument();
      }
    });

    it('should satisfy Requirement 2.2: Show "Next" button to advance to Step 2', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      const nextButton = screen.getByRole('button', { name: /Next step/i });
      expect(nextButton).toBeInTheDocument();
      
      fireEvent.click(nextButton);
      expect(mockOnNext).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple rapid clicks on next button', () => {
      const mockOnNext = vi.fn();
      render(<Step1_Welcome onNext={mockOnNext} />);
      
      const nextButton = screen.getByRole('button', { name: /Next step/i });
      
      // Rapid clicks
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);
      
      // Should be called 3 times (no debouncing in this component)
      expect(mockOnNext).toHaveBeenCalledTimes(3);
    });

    it('should render correctly when onNext is undefined', () => {
      // @ts-expect-error Testing edge case
      const { container } = render(<Step1_Welcome />);
      
      expect(container).toBeInTheDocument();
    });
  });

  describe('Visual Styling', () => {
    it('should apply gradient background to strategic overview section', () => {
      const mockOnNext = vi.fn();
      const { container } = render(<Step1_Welcome onNext={mockOnNext} />);
      
      const gradientSection = container.querySelector('.bg-gradient-to-br');
      expect(gradientSection).toBeInTheDocument();
    });

    it('should apply proper spacing between sections', () => {
      const mockOnNext = vi.fn();
      const { container } = render(<Step1_Welcome onNext={mockOnNext} />);
      
      // Check for mb-8 spacing pattern used consistently across steps
      const sectionsWithSpacing = container.querySelectorAll('.mb-8');
      expect(sectionsWithSpacing.length).toBeGreaterThan(0);
    });

    it('should have colored step indicators', () => {
      const mockOnNext = vi.fn();
      const { container } = render(<Step1_Welcome onNext={mockOnNext} />);
      
      // Check for various colored backgrounds
      expect(container.querySelector('.bg-green-100')).toBeInTheDocument();
      expect(container.querySelector('.bg-blue-100')).toBeInTheDocument();
      expect(container.querySelector('.bg-purple-100')).toBeInTheDocument();
    });
  });
});
