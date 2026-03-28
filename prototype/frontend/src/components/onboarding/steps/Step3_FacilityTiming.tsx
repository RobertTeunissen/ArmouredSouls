/**
 * Step3_FacilityTiming component
 * Educates players about facility timing and priorities for their chosen strategy.
 * 
 * Features:
 * - Display FacilityPriorityList for chosen strategy
 * - Explain "you can spend your money only once" principle
 * - Show facility categories (Mandatory, Recommended, Optional)
 * - Display FacilityBenefitCards with concrete savings examples
 * - Emphasize timing: buy discount facilities BEFORE spending on items
 * 
 * Requirements: 5.1-5.14, 18.1-18.9
 */

import { useState, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import FacilityPriorityList from '../FacilityPriorityList';
import FacilityBenefitCards from '../FacilityBenefitCards';

interface Step3_FacilityTimingProps {
  onNext?: () => void;
  onPrevious?: () => void;
}

const Step3_FacilityTiming = ({ onNext, onPrevious }: Step3_FacilityTimingProps) => {
  const { tutorialState, advanceStep } = useOnboarding();
  const navigate = useNavigate();
  const [showDetailedExamples, setShowDetailedExamples] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const strategy = tutorialState?.strategy || '1_mighty';

  /**
   * Get strategy display name
   */
  const getStrategyName = useCallback(() => {
    switch (strategy) {
      case '1_mighty':
        return '1 Mighty Robot';
      case '2_average':
        return '2 Average Robots';
      case '3_flimsy':
        return '3 Flimsy Robots';
      default:
        return 'Unknown Strategy';
    }
  }, [strategy]);

  /**
   * Toggle detailed examples visibility
   */
  const toggleDetailedExamples = useCallback(() => {
    setShowDetailedExamples(prev => !prev);
  }, []);

  /**
   * Proceed to next step
   */
  const handleNext = useCallback(async () => {
    try {
      setIsSubmitting(true);
      await advanceStep();
      onNext?.();
    } catch {
      // Error handled by context
    } finally {
      setIsSubmitting(false);
    }
  }, [advanceStep, onNext]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-3 text-gray-100">Facility Timing & Priorities</h1>
        <p className="text-lg text-secondary max-w-3xl mx-auto">
          Learn which facilities to purchase and in what order to maximize your ₡3,000,000 starting budget.
          Facility order matters because <strong className="text-warning">you can spend your money only once</strong>.
        </p>
      </div>

      {/* Strategy Context */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-primary mb-2">
              Your Strategy: {getStrategyName()}
            </h2>
            <p className="text-secondary">
              The facility priorities below are tailored to your chosen strategy. 
              Follow this order to maximize the value of your investments and avoid wasting credits.
            </p>
          </div>
        </div>
      </div>

      {/* Key Principle: Spend Money Only Once */}
      <div className="bg-yellow-900/20 border-2 border-yellow-600 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
        <div className="flex items-start gap-4">
          <span className="text-4xl">⚠️</span>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-warning mb-3">
              Critical Principle: You Can Spend Your Money Only Once
            </h2>
            <div className="space-y-3 text-gray-200">
              <p>
                <strong>Why facility order matters:</strong> Discount facilities (Weapons Workshop, Training Facility) 
                reduce the cost of future purchases. If you buy weapons BEFORE purchasing Weapons Workshop, 
                you pay full price and miss out on savings.
              </p>
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mt-3">
                <p className="font-semibold text-error mb-2">❌ Wrong Order (Wastes Credits):</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Buy weapon for ₡275,000 (full price)</li>
                  <li>Buy Weapons Workshop Level 1 for ₡75,000</li>
                  <li>Result: Paid ₡350,000 total, missed ₡27,500 in savings</li>
                </ol>
              </div>
              <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mt-3">
                <p className="font-semibold text-success mb-2">✓ Correct Order (Maximizes Value):</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Buy Weapons Workshop Level 1 for ₡75,000</li>
                  <li>Buy weapon for ₡247,500 (10% discount)</li>
                  <li>Result: Paid ₡322,500 total, saved ₡27,500</li>
                </ol>
              </div>
              <p className="text-yellow-300 font-semibold mt-4">
                💡 The same principle applies to Training Facility and attribute upgrades. 
                Always buy discount facilities FIRST!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Facility Priority List */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-center text-gray-100">
          Facility Purchase Order for {getStrategyName()}
        </h2>
        <FacilityPriorityList strategy={strategy} />
      </div>

      {/* Toggle Detailed Examples */}
      <div className="text-center mb-6">
        <button
          onClick={toggleDetailedExamples}
          className="px-6 py-3 bg-surface-elevated hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors flex items-center gap-2 mx-auto min-h-[44px]"
        >
          {showDetailedExamples ? (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Hide Detailed Examples
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              Show Detailed Savings Examples
            </>
          )}
        </button>
      </div>

      {/* Detailed Facility Benefit Cards */}
      <div className={`mb-8 transition-all duration-300 ${showDetailedExamples ? 'block' : 'hidden'}`}>
        <h2 className="text-2xl font-bold mb-4 text-center text-gray-100">
          Detailed Facility Benefits & Savings
        </h2>
        <FacilityBenefitCards />
      </div>

      {/* Key Takeaways */}
      <div className="bg-surface border border-white/10 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-4 text-gray-100">Key Takeaways</h2>
        <div className="space-y-3">
          {(strategy === '2_average' || strategy === '3_flimsy') && (
            <div className="flex items-start gap-3">
              <span className="text-error text-xl flex-shrink-0">!</span>
              <p className="text-secondary">
                <strong className="text-gray-100">Roster Expansion first:</strong> You MUST purchase Roster Expansion 
                before creating additional robots. This is the only truly mandatory facility.
              </p>
            </div>
          )}
          <div className="flex items-start gap-3">
            <span className="text-success text-xl flex-shrink-0">✓</span>
            <p className="text-secondary">
              <strong className="text-gray-100">Discount facilities save money:</strong> Weapons Workshop and Training Facility 
              provide immediate savings on all future purchases. Buy them before spending on weapons or upgrades.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-success text-xl flex-shrink-0">✓</span>
            <p className="text-secondary">
              <strong className="text-gray-100">Timing is everything:</strong> Buying facilities in the wrong order 
              can waste tens or hundreds of thousands of credits.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-success text-xl flex-shrink-0">✓</span>
            <p className="text-secondary">
              <strong className="text-gray-100">Optional facilities:</strong> Training Academies, Repair Bay, and passive 
              income facilities can be purchased based on your playstyle and remaining budget.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={() => navigate('/facilities?onboarding=true')}
          className="px-8 py-3 bg-primary hover:bg-blue-700 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 min-h-[44px]"
        >
          Go to Facilities Page
        </button>

        <p className="text-sm text-secondary text-center max-w-md">
          Buy your discount facilities now to save credits on future purchases. You can return to the tutorial afterwards.
        </p>

        <div className="flex gap-4">
          {onPrevious && (
            <button
              onClick={onPrevious}
              className="px-6 py-2 bg-surface-elevated hover:bg-gray-600 text-secondary rounded-lg font-medium transition-colors min-h-[44px]"
              aria-label="Previous step"
            >
              Previous
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={isSubmitting}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {isSubmitting ? 'Loading...' : 'Next: Budget Allocation'}
          </button>
        </div>

        <p className="text-sm text-tertiary text-center max-w-md">
          Understanding facility timing will help you make the most of your ₡3,000,000 starting budget
        </p>
      </div>

      {/* Educational Note */}
      <div className="mt-8 max-w-3xl mx-auto bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-secondary">
            <strong className="text-primary">Remember:</strong> These are recommendations, not strict requirements. 
            You have flexibility in how you spend your credits, but following this order will maximize your value.
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(Step3_FacilityTiming);
