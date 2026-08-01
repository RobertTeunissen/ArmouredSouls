/**
 * RobotSetupWizard — Shell component for the 7-step guided robot setup flow.
 *
 * Fetches eligibility on mount, manages step navigation via useRobotSetupWizard,
 * renders lazy-loaded step components, and provides a sticky bottom action bar.
 *
 * Requirements: 3.1, 4.5, 4.6, 5.1, 9.1-9.6, 10.4, 11.2, 11.3
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { ApiError } from '../../utils/ApiError';
import { useRobotSetupWizard } from './useRobotSetupWizard';
import type { SchedulingEligibilityReport, StepProps } from './types';

// Lazy-loaded step components
const PortraitStep = lazy(() => import('./steps/PortraitStep'));
const WeaponEquipStep = lazy(() => import('./steps/WeaponEquipStep'));
const BattleConfigStep = lazy(() => import('./steps/BattleConfigStep'));
const TuningAllocationStep = lazy(() => import('./steps/TuningAllocationStep'));
const TeamAssignmentStep = lazy(() => import('./steps/TeamAssignmentStep'));
const EventSubscriptionStep = lazy(() => import('./steps/EventSubscriptionStep'));
const AttributeUpgradeStep = lazy(() => import('./steps/AttributeUpgradeStep'));

interface RobotSetupWizardProps {
  robotId: number;
  robotName: string;
  loadoutType: string;
  onComplete: () => void;
  onSkip: () => void;
}

const STEP_LABELS = [
  'Portrait',
  'Weapon',
  'Battle Config',
  'Tuning',
  'Team',
  'Subscriptions',
  'Upgrades',
];

function StepLoadingFallback() {
  return (
    <div className="bg-surface-elevated rounded-lg p-6 animate-pulse">
      <div className="h-6 bg-surface rounded w-48 mb-4" />
      <div className="h-4 bg-surface rounded w-64 mb-2" />
      <div className="h-4 bg-surface rounded w-56" />
    </div>
  );
}

function RobotSetupWizard({ robotId, robotName, loadoutType, onComplete, onSkip }: RobotSetupWizardProps) {
  const navigate = useNavigate();
  const wizard = useRobotSetupWizard(robotId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch eligibility on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.get<SchedulingEligibilityReport>(`/api/robots/${robotId}/scheduling-eligibility`)
      .then((report) => {
        if (cancelled) return;

        // Already fully configured → redirect to robot detail
        if (report.isFullyConfigured) {
          onComplete();
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.statusCode === 403) {
            setError('You do not have access to this robot.');
          } else if (err.statusCode === 404) {
            setError('Robot not found.');
          } else {
            setError(err.message || 'Failed to load robot eligibility.');
          }
        } else {
          setError('Failed to load robot eligibility.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [robotId, onComplete]);

  // Handle wizard completion
  useEffect(() => {
    if (wizard.isComplete) {
      onComplete();
    }
  }, [wizard.isComplete, onComplete]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-secondary">Loading setup...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-error/10 border border-error rounded-lg p-6 text-center">
          <span className="text-3xl mb-3 block">⚠️</span>
          <p className="text-error font-semibold mb-2">{error}</p>
          <button
            onClick={() => navigate('/robots')}
            className="bg-primary hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg min-h-[44px] transition-colors mt-4"
          >
            Back to Robots
          </button>
        </div>
      </div>
    );
  }

  // Step rendering
  const stepProps: StepProps = {
    robotId,
    loadoutType,
    onComplete: wizard.advance,
    onSkip: wizard.skipStep,
  };

  const renderStep = (): React.ReactNode => {
    switch (wizard.currentStep) {
      case 1: return <PortraitStep {...stepProps} />;
      case 2: return <WeaponEquipStep {...stepProps} />;
      case 3: return <BattleConfigStep {...stepProps} />;
      case 4: return <TuningAllocationStep {...stepProps} />;
      case 5: return <TeamAssignmentStep {...stepProps} />;
      case 6: return <EventSubscriptionStep {...stepProps} />;
      case 7: return <AttributeUpgradeStep {...stepProps} />;
      default: return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pb-28">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Set Up {robotName}</h1>
        <p className="text-secondary text-sm">
          Step {wizard.currentStep} of {wizard.totalSteps} — {STEP_LABELS[wizard.currentStep - 1]}
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-6" aria-label="Setup progress">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const isCurrent = stepNum === wizard.currentStep;
          const isCompleted = wizard.state.completedSteps.includes(stepNum);
          const isSkipped = wizard.state.skippedSteps.includes(stepNum);

          return (
            <div
              key={stepNum}
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                ${isCurrent ? 'bg-primary text-white ring-2 ring-primary/50' : ''}
                ${isCompleted ? 'bg-primary/60 text-white' : ''}
                ${isSkipped ? 'bg-surface-elevated text-secondary' : ''}
                ${!isCurrent && !isCompleted && !isSkipped ? 'bg-surface-elevated text-secondary' : ''}
              `}
              title={label}
              aria-label={`Step ${stepNum}: ${label}${isCurrent ? ' (current)' : ''}${isCompleted ? ' (completed)' : ''}${isSkipped ? ' (skipped)' : ''}`}
            >
              {stepNum}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="bg-surface-elevated border border-gray-700 rounded-lg p-4 sm:p-6 motion-safe:animate-fade-in">
        <Suspense fallback={<StepLoadingFallback />}>
          {renderStep()}
        </Suspense>
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-700 p-4 z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          {/* Back */}
          <button
            onClick={() => wizard.goBack()}
            disabled={wizard.currentStep <= 1}
            className="bg-surface-elevated hover:bg-gray-600 text-white px-4 py-3 rounded-lg min-h-[44px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Go back"
          >
            ← Back
          </button>

          <div className="flex items-center gap-3">
            {/* Skip All */}
            <button
              onClick={() => {
                wizard.skipAll();
                onSkip();
              }}
              className="text-secondary hover:text-white text-sm px-3 py-3 min-h-[44px] transition-colors"
            >
              Skip All
            </button>

            {/* Skip Step */}
            <button
              onClick={wizard.skipStep}
              className="bg-surface-elevated hover:bg-gray-600 text-white px-4 py-3 rounded-lg min-h-[44px] transition-colors"
            >
              Skip
            </button>

            {/* Next / Complete */}
            <button
              onClick={wizard.advance}
              className="bg-primary hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg min-h-[44px] transition-colors"
            >
              {wizard.currentStep === wizard.totalSteps ? 'Complete' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RobotSetupWizard;
