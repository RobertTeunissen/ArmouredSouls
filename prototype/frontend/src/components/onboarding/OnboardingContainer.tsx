/**
 * OnboardingContainer component
 * Main orchestrator for the onboarding tutorial flow.
 * Manages step navigation, progress tracking, and budget monitoring.
 *
 * Performance: Uses React.lazy() for step components to enable code splitting.
 * Each step is loaded on demand, and the next step is preloaded for smooth transitions.
 */

import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import ProgressIndicator from './ProgressIndicator';
import BudgetTracker from './BudgetTracker';
import SkipConfirmationModal from './SkipConfirmationModal';
import OnboardingErrorBoundary from './OnboardingErrorBoundary';
import { LoadingScreen, ErrorScreen, CompletedScreen, NoStateScreen } from './OnboardingStatusScreens';
import { useStepFocusManagement } from './hooks/useStepFocusManagement';
import {
  trackStepStarted,
  trackStepCompleted,
  trackTutorialCompleted,
  trackTutorialSkipped,
  flushEvents,
} from '../../utils/onboardingAnalytics';

// Lazy-loaded step components for code splitting
// Display steps (5 total):
// Step 1: Welcome + Strategy + Robot Creation
// Step 2: Facility Investment
// Step 3: Battle-Ready (Loadout + Stance + Range + Weapons + Portrait)
// Step 4: Attribute Upgrades + Tag Team
// Step 5: Completion
// Backend still uses steps 1-9; the UI maps backend steps to display steps.
const Step1_Welcome = lazy(() => import('./steps/Step1_Welcome'));
const Step2_Facilities = lazy(() => import('./steps/Step2_Facilities'));
const Step3_BattleReady = lazy(() => import('./steps/Step3_BattleReady'));
const Step4_Upgrades = lazy(() => import('./steps/Step4_Upgrades'));
const Step5_Completion = lazy(() => import('./steps/Step5_Completion'));

/** Map of backend step number to lazy component import function for preloading */
const stepImports: Record<number, () => Promise<unknown>> = {
  1: () => import('./steps/Step1_Welcome'),
  2: () => import('./steps/Step1_Welcome'),
  3: () => import('./steps/Step2_Facilities'),
  4: () => import('./steps/Step2_Facilities'),
  5: () => import('./steps/Step2_Facilities'),
  6: () => import('./steps/Step3_BattleReady'),
  7: () => import('./steps/Step3_BattleReady'),
  8: () => import('./steps/Step4_Upgrades'),
  9: () => import('./steps/Step5_Completion'),
};

/**
 * Convert backend step (1-9) to display step (1-5).
 * Backend 1-2 → display 1 (welcome + strategy + robots)
 * Backend 3-5 → display 2 (facility investment)
 * Backend 6-7 → display 3 (battle-ready: loadout + stance + weapons)
 * Backend 8   → display 4 (battle readiness)
 * Backend 9   → display 5 (completion)
 */
const toDisplayStep = (backendStep: number): number => {
  if (backendStep <= 2) return 1;
  if (backendStep <= 5) return 2;
  if (backendStep <= 7) return 3;
  return backendStep - 4;
};

const TOTAL_DISPLAY_STEPS = 5;

/** Loading fallback shown while a step component is being loaded */
const StepLoadingFallback = () => (
  <div className="bg-surface p-8 rounded-lg border border-white/10 text-center animate-pulse">
    <div className="h-8 bg-surface-elevated rounded w-48 mx-auto mb-4" />
    <div className="h-4 bg-surface-elevated rounded w-64 mx-auto mb-2" />
    <div className="h-4 bg-surface-elevated rounded w-56 mx-auto" />
  </div>
);

interface OnboardingContainerProps {
  onComplete?: () => void;
}

/**
 * Main container component for the onboarding tutorial.
 *
 * Features:
 * - Renders current step based on tutorialState.currentStep
 * - Handles step navigation (next, previous, skip)
 * - Integrates ProgressIndicator and BudgetTracker
 * - Handles tutorial completion and skip confirmation
 * - Lazy loads step components and preloads the next step
 *
 * Requirements: 1.1-1.6, 2.1-2.7, 22.1-22.10, 28.1-28.7
 */
const OnboardingContainer = ({ onComplete }: OnboardingContainerProps) => {
  const {
    tutorialState,
    loading,
    error,
    errorInfo,
    advanceStep,
    setStep,
    skipTutorial,
    completeTutorial,
    retry,
  } = useOnboarding();

  const [showSkipConfirmation, setShowSkipConfirmation] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);

  const { skipModalRef } = useStepFocusManagement({
    currentStep: tutorialState?.currentStep,
    showSkipConfirmation,
    setShowSkipConfirmation,
  });

  const backendStep = tutorialState?.currentStep ?? 1;
  const currentStep = backendStep; // keep for backend interactions
  const displayStep = toDisplayStep(backendStep);

  // Track step_started whenever the current step changes
  const prevStepRef = useRef<number | null>(null);
  useEffect(() => {
    if (tutorialState && !tutorialState.hasCompletedOnboarding) {
      if (prevStepRef.current !== currentStep) {
        trackStepStarted(currentStep);
        prevStepRef.current = currentStep;
      }
    }
  }, [currentStep, tutorialState]);

  // Preload the next step component for smooth transitions
  useEffect(() => {
    const nextStep = currentStep + 1;
    if (nextStep <= 9 && stepImports[nextStep]) {
      stepImports[nextStep]();
    }
  }, [currentStep]);

  // Handle loading state
  if (loading && !tutorialState) return <LoadingScreen />;

  // Handle error state
  if (error && !tutorialState) {
    return <ErrorScreen error={error} isNetwork={errorInfo?.isNetworkError ?? false} onRetry={retry} />;
  }

  // Handle no tutorial state (shouldn't happen, but defensive)
  if (!tutorialState) return <NoStateScreen />;

  // Handle tutorial already completed
  if (tutorialState.hasCompletedOnboarding) return <CompletedScreen />;

  const handleNext = async () => {
    trackStepCompleted(currentStep);
    if (currentStep === 9) {
      trackTutorialCompleted(currentStep);
      await flushEvents();
      await completeTutorial();
      if (onComplete) {
        onComplete();
      } else {
        window.location.href = '/dashboard';
      }
    } else {
      await advanceStep();
    }
  };

  const handlePrevious = async () => {
    if (currentStep > 1) {
      await setStep(currentStep - 1);
    }
  };

  const handleSkipConfirm = async () => {
    setSkipLoading(true);
    try {
      trackTutorialSkipped(currentStep);
      await flushEvents();
      await skipTutorial();
      setShowSkipConfirmation(false);
      if (onComplete) {
        onComplete();
      } else {
        window.location.href = '/dashboard';
      }
    } catch {
      // Error handled by context
      setSkipLoading(false);
    }
  };

  const renderStep = () => {
    const stepProps = {
      onNext: handleNext,
      onPrevious: currentStep > 2 ? handlePrevious : undefined,
    };

    switch (currentStep) {
      case 1:
      case 2:
        return <Step1_Welcome onNext={handleNext} />;
      case 3:
      case 4:
      case 5:
        return <Step2_Facilities {...stepProps} />;
      case 6:
      case 7:
        return <Step3_BattleReady {...stepProps} />;
      case 8: return <Step4_Upgrades {...stepProps} />;
      case 9: return <Step5_Completion onNext={handleNext} onPrevious={handlePrevious} />;
      default: return <Step1_Welcome onNext={handleNext} />;
    }
  };

  // Step names for screen reader announcements
  const stepNames: Record<number, string> = {
    1: 'Welcome and Strategy Selection',
    2: 'Welcome and Strategy Selection',
    3: 'Facility Investment',
    4: 'Facility Investment',
    5: 'Facility Investment',
    6: 'Battle-Ready Setup',
    7: 'Battle-Ready Setup',
    8: 'Attribute Upgrades',
    9: 'Completion',
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Screen reader announcement for step changes */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {`Step ${displayStep} of ${TOTAL_DISPLAY_STEPS}: ${stepNames[currentStep] || ''}`}
      </div>

      {/* Header with progress and budget */}
      <div className="bg-surface border-b border-white/10 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex-1 min-w-0">
              <ProgressIndicator current={displayStep} total={TOTAL_DISPLAY_STEPS} />
            </div>
            <div className="flex-shrink-0 hidden sm:block">
              <BudgetTracker />
            </div>
            <button
              onClick={() => setShowSkipConfirmation(true)}
              className="flex-shrink-0 px-2 py-2 sm:px-4 text-sm text-secondary hover:text-white hover:bg-surface-elevated border border-gray-600 hover:border-gray-400 rounded transition-colors cursor-pointer min-h-[44px]"
              aria-label="Skip Tutorial"
              type="button"
            >
              <span className="hidden sm:inline">Skip Tutorial</span>
              <span className="sm:hidden" aria-hidden="true">Skip</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main content area with error boundary and Suspense for lazy-loaded steps */}
      <main className="container mx-auto px-4 py-8" aria-label={`Tutorial step ${displayStep}: ${stepNames[currentStep] || ''}`}>
        <OnboardingErrorBoundary onRetry={() => retry()}>
          <Suspense fallback={<StepLoadingFallback />}>
            {renderStep()}
          </Suspense>
        </OnboardingErrorBoundary>
      </main>

      {/* Skip Confirmation Modal */}
      {showSkipConfirmation && (
        <SkipConfirmationModal
          modalRef={skipModalRef}
          onCancel={() => setShowSkipConfirmation(false)}
          onConfirm={handleSkipConfirm}
          loading={skipLoading}
        />
      )}
    </div>
  );
};

export default OnboardingContainer;
