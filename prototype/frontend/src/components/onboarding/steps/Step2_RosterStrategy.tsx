/**
 * Step2_RosterStrategy component
 * Allows players to select their roster strategy (1, 2, or 3 robots).
 * 
 * Features:
 * - Display 3 RosterStrategyCard components
 * - Handle strategy selection and confirmation
 * - Store selected strategy in onboarding context
 * - Allow changing selection before confirming
 * - Show "Next" button after strategy confirmed
 * 
 * Requirements: 4.1-4.8, 8.1-8.9
 */

import { useState, useEffect, memo } from 'react';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import RosterStrategyCard, { RosterStrategy } from '../RosterStrategyCard';
import { trackStrategySelected } from '../../../utils/onboardingAnalytics';

interface Step2_RosterStrategyProps {
  onNext?: () => void;
}

const Step2_RosterStrategy = ({ onNext }: Step2_RosterStrategyProps) => {
  const { tutorialState, updateStrategy, advanceStep } = useOnboarding();
  
  // Local state for selection before confirmation
  const [selectedStrategy, setSelectedStrategy] = useState<RosterStrategy | null>(
    tutorialState?.strategy || null
  );
  const [isConfirmed, setIsConfirmed] = useState(!!tutorialState?.strategy);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update local state when context state changes
  useEffect(() => {
    if (tutorialState?.strategy) {
      setSelectedStrategy(tutorialState.strategy);
      setIsConfirmed(true);
    }
  }, [tutorialState?.strategy]);

  /**
   * Handle strategy card selection
   */
  const handleStrategySelect = (strategy: RosterStrategy) => {
    if (!isConfirmed) {
      setSelectedStrategy(strategy);
    }
  };

  /**
   * Confirm the selected strategy and save to context
   */
  const handleConfirm = async () => {
    if (!selectedStrategy) return;

    try {
      setIsSubmitting(true);
      await updateStrategy(selectedStrategy);
      trackStrategySelected(selectedStrategy, 2);
      setIsConfirmed(true);
    } catch {
      // Error is handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Allow changing the strategy selection
   */
  const handleChangeSelection = () => {
    setIsConfirmed(false);
  };

  /**
   * Proceed to next step
   */
  const handleNext = async () => {
    try {
      setIsSubmitting(true);
      await advanceStep();
      onNext?.();
    } catch {
      // Error is handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  const strategies: RosterStrategy[] = ['1_mighty', '2_average', '3_flimsy'];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-3 text-gray-100">Choose Your Roster Strategy</h1>
        <p className="text-lg text-secondary max-w-3xl mx-auto">
          This is the most important decision you'll make. Your roster strategy affects facility priorities,
          weapon needs, budget allocation, and long-term progression. Choose the approach that matches your playstyle.
        </p>
      </div>

      {/* Strategy Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8" role="radiogroup" aria-label="Roster strategy options">
        {strategies.map((strategy) => (
          <RosterStrategyCard
            key={strategy}
            strategy={strategy}
            selected={selectedStrategy === strategy}
            onSelect={handleStrategySelect}
          />
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col items-center gap-4">
        {!isConfirmed ? (
          <>
            {/* Confirm Button */}
            <button
              onClick={handleConfirm}
              disabled={!selectedStrategy || isSubmitting}
              className={`
                px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-200 min-h-[44px]
                ${selectedStrategy && !isSubmitting
                  ? 'bg-primary hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                  : 'bg-surface-elevated text-secondary cursor-not-allowed'
                }
              `}
              aria-label={selectedStrategy ? `Confirm ${selectedStrategy === '1_mighty' ? '1 Mighty Robot' : selectedStrategy === '2_average' ? '2 Average Robots' : '3 Flimsy Robots'} strategy` : 'Confirm strategy selection'}
            >
              {isSubmitting ? 'Confirming...' : 'Confirm Strategy'}
            </button>
            
            {/* Helper text */}
            {!selectedStrategy && (
              <p className="text-sm text-secondary">
                Select a strategy above to continue
              </p>
            )}
          </>
        ) : (
          <>
            {/* Next Button */}
            <button
              onClick={handleNext}
              disabled={isSubmitting}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              aria-label="Next step: Facility Planning"
            >
              {isSubmitting ? 'Loading...' : 'Next: Facility Planning'}
            </button>

            {/* Change Selection Button */}
            <button
              onClick={handleChangeSelection}
              disabled={isSubmitting}
              className="px-6 py-2 text-primary hover:text-blue-300 underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Change Strategy Selection
            </button>

            {/* Confirmation message */}
            <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-4 max-w-2xl">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-success flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="font-semibold text-success mb-1">Strategy Confirmed!</h3>
                  <p className="text-sm text-secondary">
                    You've chosen the <strong>{selectedStrategy === '1_mighty' ? '1 Mighty Robot' : selectedStrategy === '2_average' ? '2 Average Robots' : '3 Flimsy Robots'}</strong> strategy.
                    The next steps will guide you through facility priorities and budget allocation for this approach.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Educational Note */}
      <div className="mt-8 max-w-3xl mx-auto bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-secondary">
            <strong className="text-primary">Don't worry!</strong> If you make mistakes during setup, you can reset your account
            and start over. The reset option is available in your profile settings (as long as you don't have scheduled battles).
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(Step2_RosterStrategy);
