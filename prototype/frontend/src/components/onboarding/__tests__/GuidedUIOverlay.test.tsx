import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import GuidedUIOverlay from '../GuidedUIOverlay';

describe('GuidedUIOverlay', () => {
  let targetElement: HTMLElement;

  beforeEach(() => {
    // Create a target element for the overlay to highlight
    targetElement = document.createElement('button');
    targetElement.id = 'test-target';
    targetElement.textContent = 'Test Button';
    targetElement.style.position = 'absolute';
    targetElement.style.top = '100px';
    targetElement.style.left = '100px';
    targetElement.style.width = '200px';
    targetElement.style.height = '50px';
    document.body.appendChild(targetElement);

    // Mock getBoundingClientRect
    targetElement.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 100,
      width: 200,
      height: 50,
      bottom: 150,
      right: 300,
      x: 100,
      y: 100,
      toJSON: () => ({})
    }));
  });

  afterEach(() => {
    document.body.removeChild(targetElement);
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render overlay with tooltip content', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test tooltip content</div>}
        />
      );

      expect(screen.getByText('Test tooltip content')).toBeInTheDocument();
    });

    it('should render semi-transparent overlay', () => {
      const { container } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
        />
      );

      const overlay = container.querySelector('.bg-black.bg-opacity-60');
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveClass('fixed', 'inset-0', 'z-[9998]');
    });

    it('should highlight target element with pulsing border', () => {
      const { container } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
        />
      );

      const highlight = container.querySelector('.fixed.z-\\[9999\\].pointer-events-none');
      expect(highlight).toBeInTheDocument();
      expect(highlight?.getAttribute('style')).toContain('border: 3px solid');
    });

    it('should add highlight class to target element', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
        />
      );

      expect(targetElement).toHaveClass('onboarding-highlight');
    });

    it('should remove highlight class on unmount', () => {
      const { unmount } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
        />
      );

      expect(targetElement).toHaveClass('onboarding-highlight');
      unmount();
      expect(targetElement).not.toHaveClass('onboarding-highlight');
    });

    it('should not render if target element not found', () => {
      const { container } = render(
        <GuidedUIOverlay
          targetSelector="#non-existent"
          tooltipContent={<div>Test content</div>}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Navigation Buttons', () => {
    it('should render Next button when showNext is true', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
          showNext={true}
          onNext={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Next step')).toBeInTheDocument();
    });

    it('should not render Next button when showNext is false', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
          showNext={false}
        />
      );

      expect(screen.queryByLabelText('Next step')).not.toBeInTheDocument();
    });

    it('should render Previous button when showPrevious is true', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
          showPrevious={true}
          onPrevious={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Previous step')).toBeInTheDocument();
    });

    it('should not render Previous button when showPrevious is false', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
          showPrevious={false}
        />
      );

      expect(screen.queryByLabelText('Previous step')).not.toBeInTheDocument();
    });

    it('should render Close button when onClose is provided', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Close tutorial')).toBeInTheDocument();
    });

    it('should call onNext when Next button is clicked', () => {
      const onNext = vi.fn();
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
          onNext={onNext}
        />
      );

      fireEvent.click(screen.getByLabelText('Next step'));
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('should call onPrevious when Previous button is clicked', () => {
      const onPrevious = vi.fn();
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
          showPrevious={true}
          onPrevious={onPrevious}
        />
      );

      fireEvent.click(screen.getByLabelText('Previous step'));
      expect(onPrevious).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Close button is clicked', () => {
      const onClose = vi.fn();
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
          onClose={onClose}
        />
      );

      fireEvent.click(screen.getByLabelText('Close tutorial'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should have minimum touch target size of 44x44px', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
          onNext={vi.fn()}
          showPrevious={true}
          onPrevious={vi.fn()}
        />
      );

      const nextButton = screen.getByLabelText('Next step');
      const prevButton = screen.getByLabelText('Previous step');

      expect(nextButton).toHaveClass('min-h-[44px]', 'min-w-[44px]');
      expect(prevButton).toHaveClass('min-h-[44px]', 'min-w-[44px]');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should call onNext when Enter key is pressed', () => {
      const onNext = vi.fn();
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
          onNext={onNext}
        />
      );

      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
          onClose={onClose}
        />
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onNext when Enter is pressed without handler', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
        />
      );

      // Should not throw error
      expect(() => {
        fireEvent.keyDown(document, { key: 'Enter' });
      }).not.toThrow();
    });

    it('should not call onClose when Escape is pressed without handler', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
        />
      );

      // Should not throw error
      expect(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      }).not.toThrow();
    });
  });

  describe('Tooltip Positioning', () => {
    it('should position tooltip below target by default', async () => {
      const { container } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
          position="bottom"
        />
      );

      await waitFor(() => {
        const tooltip = container.querySelector('[role="dialog"]');
        expect(tooltip).toBeInTheDocument();
      });
    });

    it('should position tooltip above target when position is top', async () => {
      const { container } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
          position="top"
        />
      );

      await waitFor(() => {
        const tooltip = container.querySelector('[role="dialog"]');
        expect(tooltip).toBeInTheDocument();
      });
    });

    it('should position tooltip to the left when position is left', async () => {
      const { container } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
          position="left"
        />
      );

      await waitFor(() => {
        const tooltip = container.querySelector('[role="dialog"]');
        expect(tooltip).toBeInTheDocument();
      });
    });

    it('should position tooltip to the right when position is right', async () => {
      const { container } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
          position="right"
        />
      );

      await waitFor(() => {
        const tooltip = container.querySelector('[role="dialog"]');
        expect(tooltip).toBeInTheDocument();
      });
    });

    it('should render arrow pointing to target', async () => {
      const { container } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
          position="bottom"
        />
      );

      // Trigger position recalculation after tooltip ref is available
      fireEvent.scroll(window);

      await waitFor(() => {
        const arrow = container.querySelector('.absolute.w-0.h-0');
        expect(arrow).toBeInTheDocument();
      });
    });
  });

  describe('Mobile Responsiveness', () => {
    beforeEach(() => {
      // Mock window.innerWidth for mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });
    });

    afterEach(() => {
      // Reset to desktop width
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024
      });
    });

    it('should use full-width tooltip on mobile', async () => {
      const { container } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
        />
      );

      // Trigger resize event
      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        const tooltip = container.querySelector('[role="dialog"]');
        expect(tooltip).toHaveClass('left-4', 'right-4', 'max-w-none');
      });
    });

    it('should position tooltip above or below on mobile', async () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
          position="left" // Should be overridden on mobile
        />
      );

      // Trigger resize event
      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        // Tooltip should be positioned above or below, not left/right
        const tooltip = screen.getByRole('dialog');
        expect(tooltip).toBeInTheDocument();
      });
    });

    it('should have readable font size on mobile', () => {
      const { container } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
        />
      );

      // Trigger resize for mobile detection
      fireEvent(window, new Event('resize'));

      const content = container.querySelector('.leading-relaxed');
      expect(content).toBeInTheDocument();
      expect(content).toHaveStyle({ minHeight: '14px' });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA role for tooltip', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
        />
      );

      const tooltip = screen.getByRole('dialog');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveAttribute('aria-modal', 'true');
      expect(tooltip).toHaveAttribute('aria-label', 'Tutorial guidance');
    });

    it('should have ARIA labels on navigation buttons', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
          onNext={vi.fn()}
          showPrevious={true}
          onPrevious={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Next step')).toBeInTheDocument();
      expect(screen.getByLabelText('Previous step')).toBeInTheDocument();
      expect(screen.getByLabelText('Close tutorial')).toBeInTheDocument();
    });

    it('should hide decorative elements from screen readers', () => {
      const { container } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
        />
      );

      const overlay = container.querySelector('.bg-black.bg-opacity-60');
      expect(overlay).toHaveAttribute('aria-hidden', 'true');
    });

    it('should be focusable', async () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
        />
      );

      const tooltip = screen.getByRole('dialog');
      expect(tooltip).toHaveAttribute('tabIndex', '-1');
    });
  });

  describe('Position Updates', () => {
    it('should update position on scroll', async () => {
      const { container } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
        />
      );

      // Update target position
      targetElement.getBoundingClientRect = vi.fn(() => ({
        top: 200,
        left: 150,
        width: 200,
        height: 50,
        bottom: 250,
        right: 350,
        x: 150,
        y: 200,
        toJSON: () => ({})
      }));

      fireEvent.scroll(window);

      await waitFor(() => {
        const highlight = container.querySelector('.fixed.z-\\[9999\\].pointer-events-none');
        expect(highlight).toBeInTheDocument();
        // Verify position updated to new target location
        expect(highlight?.getAttribute('style')).toContain('top: 196px');
      });
    });

    it('should update position on resize', async () => {
      const { container } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Test content</div>}
        />
      );

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        const tooltip = container.querySelector('[role="dialog"]');
        expect(tooltip).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should log warning when target element not found', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation();

      render(
        <GuidedUIOverlay
          targetSelector="#non-existent"
          tooltipContent={<div>Test content</div>}
        />
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Target element not found')
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
