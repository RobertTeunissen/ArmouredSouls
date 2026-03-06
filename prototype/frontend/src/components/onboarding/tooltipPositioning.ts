/**
 * Tooltip positioning utility for GuidedUIOverlay.
 * Calculates optimal tooltip placement relative to a target element,
 * with viewport boundary checks and mobile-specific behavior.
 */

export interface TooltipPosition {
  top: number;
  left: number;
  arrowPosition: 'top' | 'bottom' | 'left' | 'right';
}

const PADDING = 16;
const ARROW_SIZE = 12;

/**
 * Calculate tooltip position relative to a target element.
 * On mobile, always positions above or below with full-width layout.
 * On desktop, respects preferred position with automatic fallback.
 */
export function calculateTooltipPosition(
  targetRect: DOMRect,
  tooltipRect: DOMRect,
  preferredPosition: string,
  isMobile: boolean,
): TooltipPosition {
  if (isMobile) {
    return calculateMobilePosition(targetRect, tooltipRect);
  }
  return calculateDesktopPosition(targetRect, tooltipRect, preferredPosition);
}

function calculateMobilePosition(
  targetRect: DOMRect,
  tooltipRect: DOMRect,
): TooltipPosition {
  const spaceAbove = targetRect.top;
  const spaceBelow = window.innerHeight - targetRect.bottom;

  if (spaceBelow > tooltipRect.height + PADDING || spaceBelow > spaceAbove) {
    return {
      top: targetRect.bottom + ARROW_SIZE + PADDING,
      left: PADDING,
      arrowPosition: 'top',
    };
  }
  return {
    top: targetRect.top - tooltipRect.height - ARROW_SIZE - PADDING,
    left: PADDING,
    arrowPosition: 'bottom',
  };
}

function calculateDesktopPosition(
  targetRect: DOMRect,
  tooltipRect: DOMRect,
  preferredPosition: string,
): TooltipPosition {
  let top = 0;
  let left = 0;
  let arrowPosition: TooltipPosition['arrowPosition'] = 'top';

  switch (preferredPosition) {
    case 'top':
      top = targetRect.top - tooltipRect.height - ARROW_SIZE - PADDING;
      left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
      arrowPosition = 'bottom';
      if (top < PADDING) {
        top = targetRect.bottom + ARROW_SIZE + PADDING;
        arrowPosition = 'top';
      }
      break;

    case 'bottom':
      top = targetRect.bottom + ARROW_SIZE + PADDING;
      left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
      arrowPosition = 'top';
      if (top + tooltipRect.height > window.innerHeight - PADDING) {
        top = targetRect.top - tooltipRect.height - ARROW_SIZE - PADDING;
        arrowPosition = 'bottom';
      }
      break;

    case 'left':
      top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
      left = targetRect.left - tooltipRect.width - ARROW_SIZE - PADDING;
      arrowPosition = 'right';
      if (left < PADDING) {
        left = targetRect.right + ARROW_SIZE + PADDING;
        arrowPosition = 'left';
      }
      break;

    case 'right':
      top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
      left = targetRect.right + ARROW_SIZE + PADDING;
      arrowPosition = 'left';
      if (left + tooltipRect.width > window.innerWidth - PADDING) {
        left = targetRect.left - tooltipRect.width - ARROW_SIZE - PADDING;
        arrowPosition = 'right';
      }
      break;
  }

  // Clamp to viewport
  left = Math.max(PADDING, Math.min(left, window.innerWidth - tooltipRect.width - PADDING));
  top = Math.max(PADDING, Math.min(top, window.innerHeight - tooltipRect.height - PADDING));

  return { top, left, arrowPosition };
}
