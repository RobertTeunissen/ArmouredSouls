/**
 * DashboardWelcome component
 * Displays the appropriate welcome/onboarding message on the dashboard
 * when the player has no robots yet.
 *
 * Three states:
 * 1. New user (onboarding not started) → "Start Your Journey" with tutorial CTA
 * 2. Partially completed onboarding → "Welcome Back" with resume CTA and progress bar
 * 3. Completed/skipped/no state → Original 4-step getting started guide
 */

import { useNavigate } from 'react-router-dom';
import { TutorialState } from '../utils/onboardingApi';

interface DashboardWelcomeProps {
  onboardingState: TutorialState | null;
  currency: number;
}

function DashboardWelcome({ onboardingState, currency }: DashboardWelcomeProps) {
  const navigate = useNavigate();

  const isNewUser =
    onboardingState &&
    !onboardingState.hasCompletedOnboarding &&
    !onboardingState.onboardingSkipped &&
    onboardingState.currentStep <= 1;

  const isResumeUser =
    onboardingState &&
    !onboardingState.hasCompletedOnboarding &&
    !onboardingState.onboardingSkipped &&
    onboardingState.currentStep > 1;

  const isCompletedOrSkipped =
    !onboardingState ||
    onboardingState.hasCompletedOnboarding ||
    onboardingState.onboardingSkipped;

  return (
    <div className="bg-surface-elevated p-8 rounded-lg mb-8 border border-white/10 text-center">
      <div className="max-w-2xl mx-auto">
        {/* New user: hasn't started or is at step 1 */}
        {isNewUser && (
          <>
            <h2 className="text-3xl font-bold mb-4">Start Your Journey</h2>
            <p className="text-lg text-secondary mb-6">
              Learn strategic decisions in 9 guided steps
            </p>
            <button
              onClick={() => navigate('/onboarding')}
              className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors"
            >
              Begin Interactive Tutorial
            </button>
            <p className="text-sm text-secondary mt-6">
              You have ₡{currency.toLocaleString()} to spend on upgrades and robots.
            </p>
          </>
        )}

        {/* Partially completed: step > 1 and not completed/skipped */}
        {isResumeUser && (
          <>
            <h2 className="text-3xl font-bold mb-4">Welcome Back!</h2>
            <p className="text-lg text-secondary mb-4">
              Continue from Step {onboardingState!.currentStep} of 9
            </p>
            <div className="w-full bg-surface-elevated rounded-full h-2 mb-6 max-w-md mx-auto">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${((onboardingState!.currentStep - 1) / 9) * 100}%` }}
              />
            </div>
            <button
              onClick={() => navigate('/onboarding')}
              className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors"
            >
              Resume Tutorial
            </button>
            <p className="text-sm text-secondary mt-6">
              You have ₡{currency.toLocaleString()} to spend on upgrades and robots.
            </p>
          </>
        )}

        {/* Completed or skipped onboarding, or no onboarding state: show original guide */}
        {isCompletedOrSkipped && (
          <>
            <h2 className="text-3xl font-bold mb-4">Welcome to Your Stable!</h2>
            <p className="text-lg text-secondary mb-6">
              You&apos;re ready to build your robot fighting empire. Here&apos;s how to get started:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left mb-8">
              <div className="bg-surface p-4 rounded-lg border border-gray-600">
                <div className="text-primary font-bold text-xl mb-2">1. Upgrade Facilities</div>
                <p className="text-sm text-secondary">
                  Unlock robot creation and improve your stable&apos;s capabilities
                </p>
              </div>
              <div className="bg-surface p-4 rounded-lg border border-gray-600">
                <div className="text-primary font-bold text-xl mb-2">2. Create Your Robot</div>
                <p className="text-sm text-secondary">
                  Build your first battle robot with unique attributes
                </p>
              </div>
              <div className="bg-surface p-4 rounded-lg border border-gray-600">
                <div className="text-primary font-bold text-xl mb-2">3. Equip Weapons</div>
                <p className="text-sm text-secondary">
                  Visit the weapon shop and configure loadouts
                </p>
              </div>
              <div className="bg-surface p-4 rounded-lg border border-gray-600">
                <div className="text-primary font-bold text-xl mb-2">4. Enter Battles</div>
                <p className="text-sm text-secondary">
                  Compete in leagues and climb the rankings!
                </p>
              </div>
            </div>
            
            <button
              onClick={() => navigate('/facilities')}
              className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors"
            >
              Get Started
            </button>
            
            <p className="text-sm text-secondary mt-6">
              You have ₡{currency.toLocaleString()} to spend on upgrades and robots.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default DashboardWelcome;
