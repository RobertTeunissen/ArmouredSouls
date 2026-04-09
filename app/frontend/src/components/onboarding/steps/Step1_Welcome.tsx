/**
 * Step 1: Welcome + Roster Strategy Selection + Robot Creation (merged)
 *
 * Streamlined first page: brief welcome, strategy selection, then a naming
 * modal that auto-purchases roster expansions and creates robots in one go.
 *
 * Requirements: 2.2, 4.1-4.8, 8.1-8.9, 9.1-9.10
 */

import { useState, useEffect, memo } from 'react';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import RosterStrategyCard, { RosterStrategy } from '../RosterStrategyCard';
import RobotNamingModal from '../RobotNamingModal';
import { trackStrategySelected } from '../../../utils/onboardingAnalytics';
import apiClient from '../../../utils/apiClient';

interface Step1_WelcomeProps {
  onNext: () => void;
}

/** How many robots each strategy creates */
const STRATEGY_ROBOT_COUNT: Record<RosterStrategy, number> = {
  '1_mighty': 1,
  '2_average': 2,
  '3_flimsy': 3,
};

const Step1_Welcome = ({ onNext: _onNext }: Step1_WelcomeProps) => {
  const { tutorialState, updateStrategy, updateChoices, refreshState } = useOnboarding();

  const [selectedStrategy, setSelectedStrategy] = useState<RosterStrategy | null>(
    tutorialState?.strategy || null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNamingModal, setShowNamingModal] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  /** Tracks how many roster expansions were purchased so we can record them later */
  const [expansionsPurchased, setExpansionsPurchased] = useState(0);

  useEffect(() => {
    if (tutorialState?.strategy) {
      setSelectedStrategy(tutorialState.strategy);
    }
  }, [tutorialState?.strategy]);

  const handleStrategySelect = (strategy: RosterStrategy) => {
    if (!isSubmitting) {
      setSelectedStrategy(strategy);
    }
  };

  /**
   * When the user clicks "Create My Robot(s)":
   * 1. Save strategy to backend
   * 2. Purchase required Roster Expansions
   * 3. Then show the naming modal
   */
  const handleCreateClick = async () => {
    if (!selectedStrategy) return;

    try {
      setIsSubmitting(true);
      setCreationError(null);

      // Save strategy
      await updateStrategy(selectedStrategy);
      trackStrategySelected(selectedStrategy, 1);

      // Buy Roster Expansion(s) before showing the naming modal
      const robotCount = STRATEGY_ROBOT_COUNT[selectedStrategy];
      const expansionsNeeded = robotCount - 1;
      for (let i = 0; i < expansionsNeeded; i++) {
        await apiClient.post('/api/facilities/upgrade', {
          facilityType: 'roster_expansion',
        });
      }
      setExpansionsPurchased(expansionsNeeded);

      setShowNamingModal(true);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Something went wrong. Please try again.';
      setCreationError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * After the user confirms names in the modal:
   * 1. Create each robot
   * 2. Track onboarding choices
   * 3. Advance to step 3
   */
  const handleConfirmNames = async (names: string[]) => {
    if (!selectedStrategy) return;

    try {
      setIsSubmitting(true);
      setCreationError(null);

      // Create robots
      const createdIds: number[] = [];
      for (const name of names) {
        const res = await apiClient.post('/api/robots', { name });
        createdIds.push(res.data.robot.id);
      }

      // Track onboarding choices
      await updateChoices({
        rosterStrategy: selectedStrategy,
        robotsCreated: createdIds,
        facilitiesPurchased: expansionsPurchased > 0
          ? Array(expansionsPurchased).fill('roster_expansion')
          : [],
      });

      // Advance backend step 1 → 2 → 3 via direct API calls
      // (context helpers swallow errors, so we call the API directly)
      await apiClient.post('/api/onboarding/state', { step: 2 });
      await apiClient.post('/api/onboarding/state', { step: 3 });

      // Sync context with the new backend state so the container re-renders
      await refreshState();

      setShowNamingModal(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Something went wrong. Please try again.';
      setCreationError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const robotCount = selectedStrategy ? STRATEGY_ROBOT_COUNT[selectedStrategy] : 0;
  const strategies: RosterStrategy[] = ['1_mighty', '2_average', '3_flimsy'];

  const buttonLabel = selectedStrategy
    ? `Create My Robot${robotCount > 1 ? 's' : ''}`
    : 'Select a strategy';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          <img
            src="/assets/onboarding/game-logo.png"
            alt="Armoured Souls"
            className="h-20 w-auto"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        <h1 className="text-3xl font-bold mb-2 text-gray-100">
          Welcome to Armoured Souls, Commander
        </h1>

        <p className="text-lg text-secondary max-w-3xl mx-auto mb-1">
          Build and manage combat robots that fight in leagues and tournaments.
          Your starting budget is{' '}
          <span className="font-semibold text-primary">₡3,000,000</span> — how
          you spend it starts with one question:
        </p>
        <p className="text-xl font-semibold text-gray-100">
          How many robots should I build?
        </p>
      </div>

      {/* Strategy Cards Grid */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
        role="radiogroup"
        aria-label="Roster strategy options"
      >
        {strategies.map((strategy) => (
          <RosterStrategyCard
            key={strategy}
            strategy={strategy}
            selected={selectedStrategy === strategy}
            onSelect={handleStrategySelect}
          />
        ))}
      </div>

      {/* Action Button */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={handleCreateClick}
          disabled={!selectedStrategy || isSubmitting}
          className={`
            px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-200 min-h-[44px]
            ${selectedStrategy && !isSubmitting
              ? 'bg-primary hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
              : 'bg-surface-elevated text-secondary cursor-not-allowed'
            }
          `}
          aria-label={
            selectedStrategy
              ? `${buttonLabel} for the ${selectedStrategy === '1_mighty' ? '1 Mighty Robot' : selectedStrategy === '2_average' ? '2 Average Robots' : '3 Flimsy Robots'} strategy`
              : 'Select a strategy first'
          }
        >
          {buttonLabel}
        </button>

        {!selectedStrategy && (
          <p className="text-sm text-secondary">
            Select a strategy above to continue
          </p>
        )}

        {creationError && !showNamingModal && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 max-w-lg">
            <p className="text-error text-sm">{creationError}</p>
          </div>
        )}
      </div>

      {/* Robot Naming Modal */}
      {showNamingModal && selectedStrategy && (
        <RobotNamingModal
          robotCount={robotCount}
          onConfirm={handleConfirmNames}
          onCancel={() => setShowNamingModal(false)}
          isSubmitting={isSubmitting}
          error={creationError}
        />
      )}
    </div>
  );
};

export default memo(Step1_Welcome);
