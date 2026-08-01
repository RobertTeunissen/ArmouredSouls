/**
 * useRobotSetupWizard hook
 * Manages wizard step navigation with localStorage persistence.
 * State is persisted per robot and gracefully degrades when localStorage is unavailable.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WizardState {
  currentStep: number; // 1-7
  completedSteps: number[];
  skippedSteps: number[];
}

export interface UseRobotSetupWizardReturn {
  state: WizardState;
  currentStep: number;
  totalSteps: number;
  advance: () => void;
  goBack: () => void;
  skipStep: () => void;
  skipAll: () => void;
  isComplete: boolean;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_STEPS = 7;
const STORAGE_KEY = (robotId: number): string => `robot-setup-${robotId}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readState(robotId: number): WizardState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY(robotId));
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'currentStep' in parsed &&
        'completedSteps' in parsed &&
        'skippedSteps' in parsed
      ) {
        return parsed as WizardState;
      }
    }
  } catch {
    // localStorage unavailable or corrupted — graceful degradation
  }
  return null;
}

function writeState(robotId: number, state: WizardState): void {
  try {
    localStorage.setItem(STORAGE_KEY(robotId), JSON.stringify(state));
  } catch {
    // localStorage unavailable — graceful degradation
  }
}

function removeState(robotId: number): void {
  try {
    localStorage.removeItem(STORAGE_KEY(robotId));
  } catch {
    // localStorage unavailable — graceful degradation
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const INITIAL_STATE: WizardState = {
  currentStep: 1,
  completedSteps: [],
  skippedSteps: [],
};

export function useRobotSetupWizard(robotId: number): UseRobotSetupWizardReturn {
  const [state, setState] = useState<WizardState>(() => {
    return readState(robotId) ?? INITIAL_STATE;
  });

  // Re-read from localStorage when robotId changes
  useEffect(() => {
    setState(readState(robotId) ?? INITIAL_STATE);
  }, [robotId]);

  // Persist state to localStorage on every change
  useEffect(() => {
    writeState(robotId, state);
  }, [state, robotId]);

  const advance = useCallback((): void => {
    setState((prev) => ({
      ...prev,
      completedSteps: [...prev.completedSteps, prev.currentStep],
      currentStep: prev.currentStep + 1,
    }));
  }, []);

  const goBack = useCallback((): void => {
    setState((prev) => {
      if (prev.currentStep <= 1) return prev;
      return {
        ...prev,
        currentStep: prev.currentStep - 1,
        // Remove the previous step from completed/skipped so it shows as active again
        completedSteps: prev.completedSteps.filter((s) => s !== prev.currentStep - 1),
        skippedSteps: prev.skippedSteps.filter((s) => s !== prev.currentStep - 1),
      };
    });
  }, []);

  const skipStep = useCallback((): void => {
    setState((prev) => ({
      ...prev,
      skippedSteps: [...prev.skippedSteps, prev.currentStep],
      currentStep: prev.currentStep + 1,
    }));
  }, []);

  const skipAll = useCallback((): void => {
    removeState(robotId);
  }, [robotId]);

  const reset = useCallback((): void => {
    removeState(robotId);
    setState(INITIAL_STATE);
  }, [robotId]);

  return {
    state,
    currentStep: state.currentStep,
    totalSteps: TOTAL_STEPS,
    advance,
    goBack,
    skipStep,
    skipAll,
    isComplete: state.currentStep > TOTAL_STEPS,
    reset,
  };
}
