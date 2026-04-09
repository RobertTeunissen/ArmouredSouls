/**
 * useStepFocusManagement hook
 * Manages focus transitions when onboarding steps change,
 * focus trapping for the skip confirmation modal,
 * and the Escape key shortcut to open skip confirmation.
 *
 * Requirements: 25.1-25.7 (Keyboard navigation and focus management)
 */

import { useRef, useEffect, useCallback } from 'react';

interface UseStepFocusManagementOptions {
  currentStep: number | undefined;
  showSkipConfirmation: boolean;
  setShowSkipConfirmation: (show: boolean) => void;
}

export function useStepFocusManagement({
  currentStep,
  showSkipConfirmation,
  setShowSkipConfirmation,
}: UseStepFocusManagementOptions) {
  const stepContentRef = useRef<HTMLDivElement>(null);
  const skipModalRef = useRef<HTMLDivElement>(null);
  const previousStepRef = useRef<number | null>(null);

  // Focus management: move focus to step content when step changes
  useEffect(() => {
    if (currentStep !== undefined && previousStepRef.current !== null && previousStepRef.current !== currentStep) {
      requestAnimationFrame(() => {
        stepContentRef.current?.focus();
      });
    }
    if (currentStep !== undefined) {
      previousStepRef.current = currentStep;
    }
  }, [currentStep]);

  // Focus trap for skip confirmation modal
  useEffect(() => {
    if (!showSkipConfirmation || !skipModalRef.current) return;

    const modal = skipModalRef.current;
    const firstButton = modal.querySelector<HTMLElement>('button');
    firstButton?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSkipConfirmation(false);
        return;
      }
      if (e.key === 'Tab') {
        const focusable = modal.querySelectorAll<HTMLElement>('button:not([disabled])');
        const arr = Array.from(focusable);
        if (arr.length === 0) return;
        const first = arr[0];
        const last = arr[arr.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSkipConfirmation, setShowSkipConfirmation]);

  // Keyboard shortcut: Escape to open skip confirmation from main view
  const handleContainerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !showSkipConfirmation) {
      setShowSkipConfirmation(true);
    }
  }, [showSkipConfirmation, setShowSkipConfirmation]);

  return {
    stepContentRef,
    skipModalRef,
    handleContainerKeyDown,
  };
}
