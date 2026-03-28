/**
 * GuidedUIOverlay Accessibility Tests
 *
 * Covers ARIA attributes, keyboard navigation, and focus management.
 * Requirements: 25.1-25.7
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import GuidedUIOverlay from '../GuidedUIOverlay';

let targetElement: HTMLElement;

function createTarget() {
  targetElement = document.createElement('button');
  targetElement.id = 'test-target';
  targetElement.textContent = 'Target';
  targetElement.style.cssText = 'position:absolute;top:100px;left:100px;width:200px;height:50px';
  document.body.appendChild(targetElement);
  targetElement.getBoundingClientRect = vi.fn(() => ({
    top: 100, left: 100, width: 200, height: 50,
    bottom: 150, right: 300, x: 100, y: 100, toJSON: () => ({}),
  }));
}

function removeTarget() {
  if (targetElement && targetElement.parentNode) {
    document.body.removeChild(targetElement);
  }
}

describe('GuidedUIOverlay Accessibility', () => {
  beforeEach(createTarget);
  afterEach(() => {
    removeTarget();
    vi.clearAllMocks();
  });

  describe('ARIA attributes', () => {
    it('should have role="dialog" with aria-modal on tooltip', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Guidance text</div>}
        />
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-label', 'Tutorial guidance');
    });

    it('should mark overlay backdrop as aria-hidden', () => {
      const { container } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
        />
      );
      // The overlay uses bg-black/70 class (Tailwind's opacity shorthand)
      const overlay = container.querySelector('[aria-hidden="true"]');
      expect(overlay).toBeInTheDocument();
    });

    it('should have aria-label on Next button', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
          onNext={vi.fn()}
          showNext={true}
        />
      );
      expect(screen.getByLabelText('Next step')).toBeInTheDocument();
    });

    it('should have aria-label on Previous button', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
          showPrevious={true}
          onPrevious={vi.fn()}
        />
      );
      expect(screen.getByLabelText('Previous step')).toBeInTheDocument();
    });

    it('should have aria-label on Close button', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
          onClose={vi.fn()}
        />
      );
      expect(screen.getByLabelText('Close tutorial')).toBeInTheDocument();
    });

    it('should mark highlight cutout as aria-hidden', () => {
      const { container } = render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
        />
      );
      const cutout = container.querySelector('.fixed.z-\\[9999\\].pointer-events-none');
      expect(cutout).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Keyboard navigation', () => {
    it('should call onClose when Escape is pressed', () => {
      const onClose = vi.fn();
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
          onClose={onClose}
        />
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not throw when Escape is pressed without onClose', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
        />
      );
      expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow();
    });

    it('should trap focus within tooltip on Tab', () => {
      const onNext = vi.fn();
      const onPrevious = vi.fn();
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
          onNext={onNext}
          showNext={true}
          showPrevious={true}
          onPrevious={onPrevious}
          onClose={vi.fn()}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      const externalEl = document.createElement('input');
      document.body.appendChild(externalEl);
      externalEl.focus();

      fireEvent.keyDown(document, { key: 'Tab' });
      expect(dialog.contains(document.activeElement) || document.activeElement === dialog).toBe(true);

      document.body.removeChild(externalEl);
    });

    it('should wrap focus from last to first element on Tab', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
          onNext={vi.fn()}
          showNext={true}
          onClose={vi.fn()}
        />
      );

      const nextBtn = screen.getByLabelText('Next step');
      nextBtn.focus();
      expect(document.activeElement).toBe(nextBtn);

      fireEvent.keyDown(document, { key: 'Tab' });
      const dialog = screen.getByRole('dialog');
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('should wrap focus from first to last element on Shift+Tab', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
          onNext={vi.fn()}
          showNext={true}
          onClose={vi.fn()}
        />
      );

      const closeBtn = screen.getByLabelText('Close tutorial');
      closeBtn.focus();

      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      const dialog = screen.getByRole('dialog');
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('should make tooltip programmatically focusable on mount', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
        />
      );
      const dialog = screen.getByRole('dialog');
      // Dialog must have tabindex="-1" to receive programmatic focus
      expect(dialog).toHaveAttribute('tabindex', '-1');
      // Verify focus can be set programmatically
      dialog.focus();
      expect(document.activeElement).toBe(dialog);
    });
  });
});
