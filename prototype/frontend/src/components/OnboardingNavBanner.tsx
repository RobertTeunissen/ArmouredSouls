/**
 * OnboardingNavBanner component
 * Persistent banner shown below the Navigation bar on ALL pages when the user
 * has an active (incomplete, not skipped) onboarding tutorial.
 *
 * Shows:
 * - Current step name and progress
 * - Action buttons relevant to the current step
 * - "Back to Tutorial" / "Next Step" button
 *
 * Hidden when:
 * - On the /onboarding page itself
 * - Tutorial is completed or skipped
 * - State hasn't loaded yet
 */

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getTutorialState, TutorialState } from '../utils/onboardingApi';

/** Step metadata: name and relevant action buttons */
const STEP_CONFIG: Record<number, {
  name: string;
  actions: Array<{ label: string; path: string; icon: string }>;
}> = {
  1: {
    name: 'Welcome',
    actions: [],
  },
  2: {
    name: 'Roster Strategy',
    actions: [],
  },
  3: {
    name: 'Facility Timing',
    actions: [
      { label: 'Facilities', path: '/facilities', icon: '🏭' },
    ],
  },
  4: {
    name: 'Budget Allocation',
    actions: [
      { label: 'Facilities', path: '/facilities', icon: '🏭' },
    ],
  },
  5: {
    name: 'Robot Creation',
    actions: [
      { label: 'Create Robot', path: '/robots/create', icon: '🤖' },
      { label: 'My Robots', path: '/robots', icon: '📋' },
    ],
  },
  6: {
    name: 'Weapon Education',
    actions: [
      { label: 'Weapon Shop', path: '/weapon-shop', icon: '⚔️' },
    ],
  },
  7: {
    name: 'Weapon Purchase',
    actions: [
      { label: 'Weapon Shop', path: '/weapon-shop', icon: '⚔️' },
      { label: 'My Robots', path: '/robots', icon: '🤖' },
    ],
  },
  8: {
    name: 'Battle Readiness',
    actions: [
      { label: 'My Robots', path: '/robots', icon: '🤖' },
      { label: 'Weapon Shop', path: '/weapon-shop', icon: '⚔️' },
    ],
  },
  9: {
    name: 'Completion',
    actions: [
      { label: 'Dashboard', path: '/dashboard', icon: '🏠' },
    ],
  },
};

function OnboardingNavBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<TutorialState | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    getTutorialState()
      .then((data) => { if (mounted) setState(data); })
      .catch(() => { /* silently ignore */ })
      .finally(() => { if (mounted) setLoaded(true); });
    return () => { mounted = false; };
  }, []);

  // Don't render on the onboarding page itself
  if (location.pathname === '/onboarding') return null;

  // Don't render until loaded
  if (!loaded || !state) return null;

  // Don't render if completed or skipped
  if (state.hasCompletedOnboarding || state.onboardingSkipped) return null;

  const step = state.currentStep;
  const config = STEP_CONFIG[step] || STEP_CONFIG[1];
  const progressPercent = ((step - 1) / 9) * 100;

  return (
    <div className="sticky top-14 lg:top-16 z-[999] bg-blue-900/30 border-b border-blue-700/50 backdrop-blur-sm" role="banner" aria-label="Onboarding progress">
      <div className="container mx-auto px-4 py-2 flex items-center gap-3 flex-wrap">
        {/* Step info */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-blue-400 text-sm">🎓</span>
          <span className="text-sm text-gray-300 whitespace-nowrap">
            Step {step}/9:
          </span>
          <span className="text-sm font-medium text-gray-100 truncate">
            {config.name}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons for current step */}
        {config.actions
          .filter((a) => a.path !== location.pathname)
          .map((action) => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className="px-3 py-1 text-xs font-medium text-gray-200 bg-gray-700/60 hover:bg-gray-600 border border-gray-600 rounded transition-colors whitespace-nowrap"
            >
              {action.icon} {action.label}
            </button>
          ))}

        {/* Back to Tutorial button */}
        <button
          onClick={() => navigate('/onboarding')}
          className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors whitespace-nowrap"
        >
          ← Back to Tutorial
        </button>
      </div>
    </div>
  );
}

export default OnboardingNavBanner;
