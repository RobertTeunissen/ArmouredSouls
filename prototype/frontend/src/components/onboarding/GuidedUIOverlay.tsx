import React, { useEffect, useState, useRef } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { calculateTooltipPosition, type TooltipPosition } from './tooltipPositioning';

interface GuidedUIOverlayProps {
  targetSelector: string;           // CSS selector for target element
  tooltipContent: React.ReactNode;  // Tooltip content
  position?: 'top' | 'bottom' | 'left' | 'right';
  onNext?: () => void;
  onPrevious?: () => void;
  showNext?: boolean;
  showPrevious?: boolean;
  onClose?: () => void;
}

const GuidedUIOverlay: React.FC<GuidedUIOverlayProps> = ({
  targetSelector,
  tooltipContent,
  position = 'bottom',
  onNext,
  onPrevious,
  showNext = true,
  showPrevious = false,
  onClose
}) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const isMobile = useIsMobile();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Disable horizontal scrolling during tutorial on mobile
  useEffect(() => {
    if (isMobile) {
      document.body.style.overflowX = 'hidden';
    }
    return () => {
      document.body.style.overflowX = '';
    };
  }, [isMobile]);

  // Find target element and calculate positions
  useEffect(() => {
    const element = document.querySelector(targetSelector);
    if (!element) {
      // Element not found - overlay won't be positioned
      return;
    }

    const updatePositions = () => {
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);
      
      // Add highlight class
      element.classList.add('onboarding-highlight');
      
      // Calculate tooltip position after tooltip is rendered
      if (tooltipRef.current) {
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const calculatedPosition = calculateTooltipPosition(rect, tooltipRect, position, isMobile);
        setTooltipPosition(calculatedPosition);
      }
    };

    updatePositions();
    
    // Update on scroll and resize
    window.addEventListener('scroll', updatePositions, true);
    window.addEventListener('resize', updatePositions);
    
    return () => {
      element.classList.remove('onboarding-highlight');
      window.removeEventListener('scroll', updatePositions, true);
      window.removeEventListener('resize', updatePositions);
    };
  }, [targetSelector, position, isMobile]);

  // Keyboard navigation with focus trapping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && onNext) {
        // Only trigger onNext for Enter when not on a button (avoid double-fire)
        const target = e.target as HTMLElement;
        if (!target || target.tagName !== 'BUTTON') {
          onNext();
        }
      } else if (e.key === 'Tab' && tooltipRef.current) {
        // Focus trap: keep focus within the tooltip
        const focusableElements = tooltipRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const focusable = Array.from(focusableElements);
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const firstFocusable = focusable[0];
        const lastFocusable = focusable[focusable.length - 1];

        if (e.shiftKey) {
          // Shift+Tab: if focus is on first element or the tooltip itself, wrap to last
          if (document.activeElement === firstFocusable || document.activeElement === tooltipRef.current) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          // Tab: if focus is on last element, wrap to first
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          } else if (!tooltipRef.current.contains(document.activeElement)) {
            // If focus is outside tooltip, bring it back
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onClose]);

  // Focus management - auto-focus tooltip on mount and when target changes
  useEffect(() => {
    if (tooltipRef.current) {
      tooltipRef.current.focus();
    }
  }, [targetSelector, targetRect]);

  if (!targetRect) {
    // Don't render anything if target element not found
    return null;
  }

  return (
    <>
      {/* Semi-transparent overlay */}
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/70 z-[9998]"
        style={{ pointerEvents: 'none' }}
        aria-hidden="true"
      />

      {/* Highlighted target cutout */}
      <div
        className="fixed z-[9999] pointer-events-none"
        style={{
          top: targetRect.top - 4,
          left: targetRect.left - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8,
          border: '3px solid #3B82F6',
          borderRadius: '8px',
          boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.3), 0 0 20px rgba(59, 130, 246, 0.5)',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
        }}
        aria-hidden="true"
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={`fixed z-[10000] bg-surface border border-white/20 text-white rounded-lg shadow-2xl ${
          isMobile ? 'left-4 right-4 max-w-none' : 'max-w-md'
        }`}
        style={
          tooltipPosition && !isMobile
            ? {
                top: tooltipPosition.top,
                left: tooltipPosition.left
              }
            : tooltipPosition && isMobile
            ? {
                top: tooltipPosition.top,
                left: tooltipPosition.left,
                right: 16
              }
            : {}
        }
        role="dialog"
        aria-modal="true"
        aria-label="Tutorial guidance"
        tabIndex={-1}
      >
        {/* Arrow */}
        {tooltipPosition && !isMobile && (
          <div
            className="absolute w-0 h-0"
            style={{
              ...(tooltipPosition.arrowPosition === 'top' && {
                top: -12,
                left: '50%',
                transform: 'translateX(-50%)',
                borderLeft: '12px solid transparent',
                borderRight: '12px solid transparent',
                borderBottom: '12px solid #1a1f29'
              }),
              ...(tooltipPosition.arrowPosition === 'bottom' && {
                bottom: -12,
                left: '50%',
                transform: 'translateX(-50%)',
                borderLeft: '12px solid transparent',
                borderRight: '12px solid transparent',
                borderTop: '12px solid #1a1f29'
              }),
              ...(tooltipPosition.arrowPosition === 'left' && {
                left: -12,
                top: '50%',
                transform: 'translateY(-50%)',
                borderTop: '12px solid transparent',
                borderBottom: '12px solid transparent',
                borderRight: '12px solid #1a1f29'
              }),
              ...(tooltipPosition.arrowPosition === 'right' && {
                right: -12,
                top: '50%',
                transform: 'translateY(-50%)',
                borderTop: '12px solid transparent',
                borderBottom: '12px solid transparent',
                borderLeft: '12px solid #1a1f29'
              })
            }}
            aria-hidden="true"
          />
        )}

        {/* Content */}
        <div className={`p-6 ${isMobile ? 'text-sm' : ''}`}>
          <div
            className="leading-relaxed mb-4"
            style={{ fontSize: isMobile ? '14px' : undefined, minHeight: '14px' }}
          >
            {tooltipContent}
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-between items-center gap-3">
            <div className="flex gap-2">
              {showPrevious && onPrevious && (
                <button
                  onClick={onPrevious}
                  className="px-4 py-2 bg-surface-elevated hover:bg-gray-600 text-white rounded transition-colors min-h-[44px] min-w-[44px]"
                  aria-label="Previous step"
                >
                  Previous
                </button>
              )}
            </div>

            <div className="flex gap-2">
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-surface-elevated hover:bg-gray-600 text-white rounded transition-colors min-h-[44px] min-w-[44px]"
                  aria-label="Close tutorial"
                >
                  Close
                </button>
              )}
              {showNext && onNext && (
                <button
                  onClick={onNext}
                  className="px-4 py-2 bg-primary hover:bg-blue-700 text-white rounded transition-colors min-h-[44px] min-w-[44px]"
                  aria-label="Next step"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>
    </>
  );
};

export default GuidedUIOverlay;
