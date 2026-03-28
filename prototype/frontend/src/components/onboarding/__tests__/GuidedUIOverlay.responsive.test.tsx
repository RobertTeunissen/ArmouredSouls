/**
 * Responsive design tests for GuidedUIOverlay
 *
 * Requirements: 24.1-24.7
 *
 * NOTE (Task 35.2): Manual device testing is required for:
 * - iOS Safari
 * - Android Chrome
 * - Tablet devices (iPad, Android tablets)
 * These cannot be automated in unit tests and should be verified manually
 * before deployment.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import GuidedUIOverlay from '../GuidedUIOverlay';

describe('GuidedUIOverlay - Responsive Design', () => {
  let targetElement: HTMLElement;
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  function setViewport(width: number, height = 800) {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height,
    });
  }

  beforeEach(() => {
    targetElement = document.createElement('button');
    targetElement.id = 'test-target';
    targetElement.textContent = 'Test Button';
    targetElement.style.position = 'absolute';
    targetElement.style.top = '200px';
    targetElement.style.left = '100px';
    targetElement.style.width = '200px';
    targetElement.style.height = '50px';
    document.body.appendChild(targetElement);

    targetElement.getBoundingClientRect = vi.fn(() => ({
      top: 200,
      left: 100,
      width: 200,
      height: 50,
      bottom: 250,
      right: 300,
      x: 100,
      y: 200,
      toJSON: () => ({}),
    }));
  });

  afterEach(() => {
    if (document.body.contains(targetElement)) {
      document.body.removeChild(targetElement);
    }
    setViewport(originalInnerWidth, originalInnerHeight);
    document.body.style.overflowX = '';
    vi.clearAllMocks();
  });

  describe('Mobile Tooltip Positioning (<768px)', () => {
    beforeEach(() => {
      setViewport(375);
      window.dispatchEvent(new Event('resize'));
    });

    it('should use full-width tooltip on mobile viewport', async () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Mobile tooltip content</div>}
        />,
      );

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        const tooltip = screen.getByRole('dialog');
        expect(tooltip).toHaveClass('left-4', 'right-4', 'max-w-none');
      });
    });

    it('should not use max-w-md on mobile', async () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
        />,
      );

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        const tooltip = screen.getByRole('dialog');
        expect(tooltip).not.toHaveClass('max-w-md');
      });
    });

    it('should position tooltip below target when space is available', async () => {
      // Target at y=200, plenty of space below
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
          position="left"
        />,
      );

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        const tooltip = screen.getByRole('dialog');
        // On mobile, left/right positions should be overridden to top/bottom
        expect(tooltip).toBeInTheDocument();
        const style = tooltip.style;
        // Tooltip should be positioned below the target (target.bottom=250 + arrow + padding)
        const topValue = parseFloat(style.top);
        expect(topValue).toBeGreaterThan(250);
      });
    });

    it('should position tooltip above target when no space below', async () => {
      // Place target near bottom of viewport so spaceAbove > spaceBelow
      setViewport(375, 400);
      targetElement.getBoundingClientRect = vi.fn(() => ({
        top: 350,
        left: 100,
        width: 200,
        height: 50,
        bottom: 400,
        right: 300,
        x: 100,
        y: 350,
        toJSON: () => ({}),
      }));

      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
          position="right"
        />,
      );

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        const tooltip = screen.getByRole('dialog');
        expect(tooltip).toBeInTheDocument();
        const topValue = parseFloat(tooltip.style.top);
        // spaceAbove (350) > spaceBelow (0), so tooltip should be above
        // With zero-height tooltip in jsdom: top = 350 - 0 - 12 - 16 = 322
        expect(topValue).toBeLessThan(350);
      });
    });

    it('should override left position to top/bottom on mobile', async () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
          position="left"
        />,
      );

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        const tooltip = screen.getByRole('dialog');
        // On mobile, tooltip should not be positioned to the left of target
        // It should be above or below
        const topValue = parseFloat(tooltip.style.top);
        const targetTop = 200;
        const targetBottom = 250;
        // Either above target or below target
        expect(topValue < targetTop || topValue > targetBottom).toBe(true);
      });
    });

    it('should override right position to top/bottom on mobile', async () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
          position="right"
        />,
      );

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        const tooltip = screen.getByRole('dialog');
        const topValue = parseFloat(tooltip.style.top);
        const targetTop = 200;
        const targetBottom = 250;
        expect(topValue < targetTop || topValue > targetBottom).toBe(true);
      });
    });

    it('should not render arrow on mobile', async () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
        />,
      );

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        const tooltip = screen.getByRole('dialog');
        expect(tooltip).toBeInTheDocument();
        // Arrow is conditionally rendered with !isMobile
        const arrow = tooltip.querySelector('.absolute.w-0.h-0');
        expect(arrow).toBeNull();
      });
    });
  });

  describe('Desktop Tooltip Positioning (>=768px)', () => {
    beforeEach(() => {
      setViewport(1024);
      window.dispatchEvent(new Event('resize'));
    });

    it('should use max-w-md on desktop', async () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Desktop content</div>}
        />,
      );

      await waitFor(() => {
        const tooltip = screen.getByRole('dialog');
        expect(tooltip).toHaveClass('max-w-md');
        expect(tooltip).not.toHaveClass('left-4', 'right-4', 'max-w-none');
      });
    });

    it('should render arrow on desktop', async () => {
      const { container } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
        />,
      );

      // Trigger position recalculation after tooltip ref is available
      fireEvent.scroll(window);

      await waitFor(() => {
        const arrow = container.querySelector('.absolute.w-0.h-0');
        expect(arrow).toBeInTheDocument();
      });
    });

    it('should support left/right positioning on desktop', async () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
          position="right"
        />,
      );

      // Trigger position recalculation after tooltip ref is available
      fireEvent.scroll(window);

      await waitFor(() => {
        const tooltip = screen.getByRole('dialog');
        expect(tooltip).toBeInTheDocument();
        // On desktop, right position should place tooltip to the right of target
        const leftValue = parseFloat(tooltip.style.left);
        expect(leftValue).toBeGreaterThan(300); // target.right = 300
      });
    });
  });

  describe('Touch Target Sizes', () => {
    it('should have minimum 44x44px touch targets for Next button', () => {
      setViewport(375);

      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
          onNext={vi.fn()}
        />,
      );

      fireEvent(window, new Event('resize'));

      const nextButton = screen.getByLabelText('Next step');
      expect(nextButton).toHaveClass('min-h-[44px]', 'min-w-[44px]');
    });

    it('should have minimum 44x44px touch targets for Previous button', () => {
      setViewport(375);

      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
          showPrevious={true}
          onPrevious={vi.fn()}
        />,
      );

      fireEvent(window, new Event('resize'));

      const prevButton = screen.getByLabelText('Previous step');
      expect(prevButton).toHaveClass('min-h-[44px]', 'min-w-[44px]');
    });

    it('should have minimum 44x44px touch targets for Close button', () => {
      setViewport(375);

      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
          onClose={vi.fn()}
        />,
      );

      fireEvent(window, new Event('resize'));

      const closeButton = screen.getByLabelText('Close tutorial');
      expect(closeButton).toHaveClass('min-h-[44px]', 'min-w-[44px]');
    });

    it('should maintain touch target sizes on desktop too', () => {
      setViewport(1024);

      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
          onNext={vi.fn()}
          showPrevious={true}
          onPrevious={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByLabelText('Next step')).toHaveClass('min-h-[44px]', 'min-w-[44px]');
      expect(screen.getByLabelText('Previous step')).toHaveClass('min-h-[44px]', 'min-w-[44px]');
      expect(screen.getByLabelText('Close tutorial')).toHaveClass('min-h-[44px]', 'min-w-[44px]');
    });
  });

  describe('Font Readability', () => {
    it('should enforce minimum 14px font size on mobile', async () => {
      setViewport(375);

      const { container } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Readable content</div>}
        />,
      );

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        const contentDiv = container.querySelector('[style*="font-size: 14px"]');
        expect(contentDiv).toBeInTheDocument();
      });
    });

    it('should not force font size on desktop', async () => {
      setViewport(1024);

      const { container } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Desktop content</div>}
        />,
      );

      await waitFor(() => {
        const tooltip = screen.getByRole('dialog');
        expect(tooltip).toBeInTheDocument();
        // On desktop, font-size should not be explicitly set to 14px
        const contentDiv = container.querySelector('.leading-relaxed');
        expect(contentDiv).toBeInTheDocument();
        expect(contentDiv!.getAttribute('style')).not.toContain('font-size: 14px');
      });
    });

    it('should have minimum height of 14px for content area', () => {
      setViewport(375);

      const { container } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
        />,
      );

      fireEvent(window, new Event('resize'));

      const contentDiv = container.querySelector('.leading-relaxed');
      expect(contentDiv).toHaveStyle({ minHeight: '14px' });
    });
  });

  describe('Horizontal Scroll Prevention', () => {
    it('should disable horizontal scrolling on mobile', async () => {
      setViewport(375);

      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
        />,
      );

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        expect(document.body.style.overflowX).toBe('hidden');
      });
    });

    it('should restore horizontal scrolling on unmount', async () => {
      setViewport(375);

      const { unmount } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
        />,
      );

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        expect(document.body.style.overflowX).toBe('hidden');
      });

      unmount();

      expect(document.body.style.overflowX).toBe('');
    });

    it('should not disable horizontal scrolling on desktop', () => {
      setViewport(1024);

      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
        />,
      );

      expect(document.body.style.overflowX).not.toBe('hidden');
    });
  });

  describe('Viewport Transitions', () => {
    it('should switch to mobile layout when resized below 768px', async () => {
      setViewport(1024);

      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
        />,
      );

      // Initially desktop
      await waitFor(() => {
        const tooltip = screen.getByRole('dialog');
        expect(tooltip).toHaveClass('max-w-md');
      });

      // Resize to mobile
      setViewport(375);
      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        const tooltip = screen.getByRole('dialog');
        expect(tooltip).toHaveClass('left-4', 'right-4', 'max-w-none');
      });
    });

    it('should switch to desktop layout when resized above 768px', async () => {
      setViewport(375);

      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
        />,
      );

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        const tooltip = screen.getByRole('dialog');
        expect(tooltip).toHaveClass('max-w-none');
      });

      // Resize to desktop
      setViewport(1024);
      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        const tooltip = screen.getByRole('dialog');
        expect(tooltip).toHaveClass('max-w-md');
      });
    });
  });

  describe('Tablet Viewport (768px-1024px)', () => {
    it('should use mobile layout at exactly 768px', async () => {
      setViewport(768);

      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Tablet content</div>}
        />,
      );

      await waitFor(() => {
        const tooltip = screen.getByRole('dialog');
        // 768px is below the 1024px breakpoint, so it uses mobile layout
        expect(tooltip).toHaveClass('max-w-none');
        expect(tooltip).not.toHaveClass('max-w-md');
      });
    });

    it('should use desktop layout at 1024px', async () => {
      setViewport(1024);

      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Tablet content</div>}
        />,
      );

      await waitFor(() => {
        const tooltip = screen.getByRole('dialog');
        expect(tooltip).toHaveClass('max-w-md');
      });
    });
  });
});
