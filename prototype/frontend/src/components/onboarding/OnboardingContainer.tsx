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
import { useStepFocusManagement } from './hooks/useStepFocusManagement';
import {
  trackStepStarted,
  trackStepCompleted,
  trackTutorialCompleted,
  trackTutorialSkipped,
  flushEvents,
} from '../../utils/onboardingAnalytics';

// Lazy-loaded step components for code splitting
const Step1_Welcome = lazy(() => import('./steps/Step1_Welcome'));
const Step2_RosterStrategy = lazy(() => import('./steps/Step2_RosterStrategy'));
const Step3_FacilityTiming = lazy(() => import('./steps/Step3_FacilityTiming'));
const Step4_BudgetAllocation = lazy(() => import('./steps/Step4_BudgetAllocation'));
const Step5_RobotCreation = lazy(() => import('./steps/Step5_RobotCreation'));
const Step6_WeaponEducation = lazy(() => import('./steps/Step6_WeaponEducation'));
const Step7_WeaponPurchase = lazy(() => import('./steps/Step7_WeaponPurchase'));
const Step8_BattleReadiness = lazy(() => import('./steps/Step8_BattleReadiness'));
const Step9_Completion = lazy(() => import('./steps/Step9_Completion'));

/** Map of step number to lazy component import function for preloading */
const stepImports: Record<number, () => Promise<unknown>> = {
  1: () => import('./steps/Step1_Welcome'),
  2: () => import('./steps/Step2_RosterStrategy'),
  3: () => import('./steps/Step3_FacilityTiming'),
  4: () => import('./steps/Step4_BudgetAllocation'),
  5: () => import('./steps/Step5_RobotCreation'),
  6: () => import('./steps/Step6_WeaponEducation'),
  7: () => import('./steps/Step7_WeaponPurchase'),
  8: () => import('./steps/Step8_BattleReadiness'),
  9: () => import('./steps/Step9_Completion'),
};

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

  const currentStep = tutorialState?.currentStep ?? 1;

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
  if (loading && !tutorialState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-secondary">Loading tutorial...</div>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error && !tutorialState) {
    const isNetwork = errorInfo?.isNetworkError ?? false;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" role="alert">
        <div className="text-center max-w-md mx-auto p-6">
          <h2 className="text-xl font-bold text-error mb-2">
            {isNetwork ? 'Connection Problem' : 'Failed to Load Tutorial'}
          </h2>
          <p className="text-secondary mb-4">
            {isNetwork
              ? 'Unable to reach the server. Please check your internet connection.'
              : error}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => retry()}
              className="px-6 py-2 bg-primary hover:bg-primary-dark rounded transition-colors text-white min-h-[44px]"
            >
              Retry
            </button>
            <button
              onClick={() => { window.location.href = '/dashboard'; }}
              className="px-6 py-2 border border-gray-600 hover:border-gray-400 rounded transition-colors text-secondary min-h-[44px]"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle no tutorial state (shouldn't happen, but defensive)
  if (!tutorialState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-secondary">No tutorial state found</div>
        </div>
      </div>
    );
  }

  // Handle tutorial already completed
  if (tutorialState.hasCompletedOnboarding) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-100">Tutorial Already Completed</h2>
          <p className="text-secondary mb-6">
            You've already completed the onboarding tutorial.
          </p>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="px-6 py-2 bg-primary hover:bg-primary-dark rounded transition-colors min-h-[44px]"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

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
      onPrevious: currentStep > 1 ? handlePrevious : undefined,
    };

    switch (currentStep) {
      case 1: return <Step1_Welcome onNext={handleNext} />;
      case 2: return <Step2_RosterStrategy onNext={handleNext} />;
      case 3: return <Step3_FacilityTiming onNext={handleNext} />;
      case 4: return <Step4_BudgetAllocation onNext={handleNext} />;
      case 5: return <Step5_RobotCreation onNext={handleNext} />;
      case 6: return <Step6_WeaponEducation onNext={handleNext} />;
      case 7: return <Step7_WeaponPurchase onNext={handleNext} />;
      case 8: return <Step8_BattleReadiness {...stepProps} />;
      case 9: return <Step9_Completion onNext={handleNext} onPrevious={handlePrevious} />;
      default: return <Step1_Welcome onNext={handleNext} />;
    }
  };

  // Step names for screen reader announcements
  const stepNames: Record<number, string> = {
    1: 'Welcome and Strategic Overview',
    2: 'Roster Strategy Selection',
    3: 'Facility Timing and Priority',
    4: 'Budget Allocation Guidance',
    5: 'Robot Creation',
    6: 'Weapon and Loadout Education',
    7: 'Weapon Purchase',
    8: 'Battle Readiness',
    9: 'Completion and Recommendations',
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
        {`Step ${currentStep} of 9: ${stepNames[currentStep] || ''}`}
      </div>

      {/* Header with progress and budget */}
      <div className="bg-surface border-b border-white/10 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <ProgressIndicator current={currentStep} total={9} />
            </div>
            <div className="flex-shrink-0">
              <BudgetTracker />
            </div>
            <button
              onClick={() => setShowSkipConfirmation(true)}
              className="flex-shrink-0 px-4 py-2 text-sm text-secondary hover:text-white hover:bg-surface-elevated border border-gray-600 hover:border-gray-400 rounded transition-colors cursor-pointer min-h-[44px]"
              aria-label="Skip Tutorial"
              type="button"
            >
              Skip Tutorial
            </button>
          </div>
        </div>
      </div>

      {/* Main content area with error boundary and Suspense for lazy-loaded steps */}
      <main className="container mx-auto px-4 py-8" aria-label={`Tutorial step ${currentStep}: ${stepNames[currentStep] || ''}`}>
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
