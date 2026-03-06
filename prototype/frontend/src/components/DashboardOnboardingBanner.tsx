/**
 * DashboardOnboardingBanner component
 * Displays a compact, dismissible progress banner below the dashboard header
 * when the user has incomplete onboarding (not completed and not skipped).
 *
 * Shows:
 * - Progress bar with step X of 9
 * - "Resume Tutorial" button navigating to /onboarding
 *
 * Hidden when:
 * - onboardingState is null
 * - hasCompletedOnboarding is true
 * - onboardingSkipped is true
 *
 * Requirements: 1.5, 2.4
 */

import { useNavigate } from 'react-router-dom';
import { TutorialState } from '../utils/onboardingApi';

interface DashboardOnboardingBannerProps {
  onboardingState: TutorialState | null;
}

function DashboardOnboardingBanner({ onboardingState }: DashboardOnboardingBannerProps) {
  const navigate = useNavigate();

  // Hide for null state, completed, or skipped users
  if (
    !onboardingState ||
    onboardingState.hasCompletedOnboarding ||
    onboardingState.onboardingSkipped
  ) {
    return null;
  }

  const completedSteps = onboardingState.currentStep - 1;
  const totalSteps = 9;
  const progressPercent = (completedSteps / totalSteps) * 100;

  return (
    <div
      data-testid="onboarding-banner"
      className="mb-6 bg-primary/10 border border-primary/30 rounded-lg px-4 py-3 flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <span className="text-primary text-lg">🎓</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">
              Setup Progress
            </span>
            <span className="text-xs text-gray-400">
              Step {onboardingState.currentStep} of {totalSteps}
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all"
              data-testid="onboarding-progress-bar"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
      <button
        onClick={() => navigate('/onboarding')}
        className="bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-4 py-1.5 rounded transition-colors whitespace-nowrap"
      >
        Resume Tutorial
      </button>
    </div>
  );
}

export default DashboardOnboardingBanner;
