/**
 * Step4_BudgetAllocation component
 * Educates players about recommended budget allocation for their chosen strategy.
 *
 * Features:
 * - Display BudgetAllocationChart for chosen strategy
 * - Show recommended spending ranges by category
 * - Explain these are guidelines, not strict requirements
 * - Highlight facility discount compounding
 * - Explain weapon storage limits and Storage Facility benefits
 *
 * Requirements: 6.1-6.9, 19.1-19.9
 */

import { useState, memo } from 'react';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import BudgetAllocationChart from '../BudgetAllocationChart';
import BudgetComparisonTable from '../BudgetComparisonTable';

interface Step4_BudgetAllocationProps {
  onNext?: () => void;
  onPrevious?: () => void;
}

/** Strategy-specific budget breakdowns from requirements 6.2-6.4 */
const STRATEGY_DETAILS: Record<string, {
  name: string;
  highlights: string[];
  storageNote: string;
}> = {
  '1_mighty': {
    name: '1 Mighty Robot',
    highlights: [
      'Heavy investment in attribute upgrades (₡1,550K) for a single powerful robot',
      'Moderate facility costs (₡350K) — no Roster Expansion needed',
      '1-2 quality weapons (₡550K) — focus on the best gear',
      'Small reserve (₡50K) for immediate repairs',
    ],
    storageNote: 'With only 1 robot, weapon storage is rarely an issue. Focus on quality over quantity.',
  },
  '2_average': {
    name: '2 Average Robots',
    highlights: [
      'Balanced spending across all categories',
      'Roster Expansion required (included in ₡350K facility budget)',
      '2-4 weapons (₡500K) — consider weapon type variety',
      'Attribute upgrades split between robots (₡1,100K)',
    ],
    storageNote: 'With 2 robots, you may need Storage Facility if equipping multiple weapon sets. Plan weapon purchases carefully.',
  },
  '3_flimsy': {
    name: '3 Flimsy Robots',
    highlights: [
      'Highest facility investment (₡350K) — Roster Expansion Level 2 required',
      '3 robot frames cost ₡1,500K — the largest single expense',
      '3-6 weapons needed (₡450K) — one per robot minimum',
      'Minimal attribute upgrades (₡650K) spread thin across 3 robots',
    ],
    storageNote: 'With 3 robots, Storage Facility is useful if you want to own many weapons for experimentation. Not required if you buy 3 weapons for 3 robots.',
  },
};

/** Budget recommendations matching BudgetAllocationChart data */
const BUDGET_RECOMMENDATIONS: Record<string, {
  facilities: { min: number; max: number; color: string; label: string };
  robots: { min: number; max: number; color: string; label: string };
  weapons: { min: number; max: number; color: string; label: string };
  attributes: { min: number; max: number; color: string; label: string };
  reserve: { min: number; max: number; color: string; label: string };
}> = {
  '1_mighty': {
    facilities: { min: 350000, max: 350000, color: '#3B82F6', label: 'Facilities' },
    robots: { min: 500000, max: 500000, color: '#10B981', label: 'Robots' },
    weapons: { min: 550000, max: 550000, color: '#EF4444', label: 'Weapons' },
    attributes: { min: 1550000, max: 1550000, color: '#F59E0B', label: 'Attributes' },
    reserve: { min: 50000, max: 50000, color: '#6B7280', label: 'Reserve' },
  },
  '2_average': {
    facilities: { min: 350000, max: 350000, color: '#3B82F6', label: 'Facilities' },
    robots: { min: 1000000, max: 1000000, color: '#10B981', label: 'Robots' },
    weapons: { min: 500000, max: 500000, color: '#EF4444', label: 'Weapons' },
    attributes: { min: 1100000, max: 1100000, color: '#F59E0B', label: 'Attributes' },
    reserve: { min: 50000, max: 50000, color: '#6B7280', label: 'Reserve' },
  },
  '3_flimsy': {
    facilities: { min: 350000, max: 350000, color: '#3B82F6', label: 'Facilities' },
    robots: { min: 1500000, max: 1500000, color: '#10B981', label: 'Robots' },
    weapons: { min: 450000, max: 450000, color: '#EF4444', label: 'Weapons' },
    attributes: { min: 650000, max: 650000, color: '#F59E0B', label: 'Attributes' },
    reserve: { min: 50000, max: 50000, color: '#6B7280', label: 'Reserve' },
  },
};

const Step4_BudgetAllocation = ({ onNext, onPrevious }: Step4_BudgetAllocationProps) => {
  const { tutorialState, advanceStep } = useOnboarding();
  const [showComparison, setShowComparison] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const strategy = tutorialState?.strategy || '1_mighty';
  const details = STRATEGY_DETAILS[strategy] || STRATEGY_DETAILS['1_mighty'];
  const recommendations = BUDGET_RECOMMENDATIONS[strategy] || BUDGET_RECOMMENDATIONS['1_mighty'];
  
  // Get spending data from onboarding choices
  const budgetSpent = tutorialState?.choices?.budgetSpent || {
    facilities: 0,
    robots: 0,
    weapons: 0,
    attributes: 0,
  };
  const hasSpendingData = budgetSpent.facilities > 0 || budgetSpent.robots > 0 || 
                          budgetSpent.weapons > 0 || budgetSpent.attributes > 0;

  const handleNext = async () => {
    try {
      setIsSubmitting(true);
      await advanceStep();
      onNext?.();
    } catch {
      // Error handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-3 text-gray-100">Budget Allocation Guide</h1>
        <p className="text-lg text-secondary max-w-3xl mx-auto">
          See how to distribute your ₡3,000,000 starting budget across facilities, robots,
          weapons, and attributes for the <strong className="text-primary">{details.name}</strong> strategy.
        </p>
      </div>

      {/* Guidelines Disclaimer */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
        <div className="flex items-start gap-4">
          <span className="text-3xl flex-shrink-0">📋</span>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-primary mb-2">
              These Are Guidelines, Not Rules
            </h2>
            <p className="text-secondary">
              The budget ranges below are recommendations based on your chosen strategy.
              You have full flexibility to adjust spending based on your preferences and playstyle.
              Think of these as a starting framework, not strict requirements.
            </p>
          </div>
        </div>
      </div>

      {/* Budget Allocation Chart */}
      <div className="mb-8 max-w-4xl mx-auto">
        <BudgetAllocationChart strategy={strategy} />
      </div>

      {/* Strategy-Specific Highlights */}
      <div className="bg-surface border border-white/10 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-4 text-gray-100">
          Key Points for {details.name}
        </h2>
        <div className="space-y-3">
          {details.highlights.map((highlight, index) => (
            <div key={index} className="flex items-start gap-3">
              <span className="text-success text-xl flex-shrink-0">✓</span>
              <p className="text-secondary">{highlight}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Discount Facilities Timing */}
      <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
        <div className="flex items-start gap-4">
          <span className="text-3xl flex-shrink-0">💰</span>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-warning mb-3">
              Why Buy Discount Facilities Early?
            </h2>
            <p className="text-gray-200 mb-3">
              Discount facilities save you money on every future purchase. The earlier you buy them,
              the more you save overall. This is why facilities appear first in the budget.
            </p>
            <div className="bg-background/50 rounded-lg p-4 space-y-2 text-sm">
              <p className="text-secondary">
                <strong className="text-yellow-300">Training Facility:</strong> Saves 10-90% on attribute upgrades.
                Since you'll upgrade attributes many times, this facility pays for itself quickly.
              </p>
              <p className="text-secondary">
                <strong className="text-yellow-300">Repair Bay:</strong> Reduces repair costs after every battle.
                The more battles you fight, the more you save.
              </p>
              <p className="text-secondary">
                <strong className="text-yellow-300">Merchandising Hub & Streaming Studio:</strong> Generate passive income.
                The earlier you buy them, the more total income they generate over time.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Weapon Storage Note */}
      <div className="bg-surface border border-white/10 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
        <div className="flex items-start gap-4">
          <span className="text-3xl flex-shrink-0">📦</span>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-100 mb-2">
              Weapon Storage & Storage Facility
            </h2>
            <p className="text-secondary">{details.storageNote}</p>
          </div>
        </div>
      </div>

      {/* Toggle Comparison Table */}
      <div className="text-center mb-6">
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="px-6 py-3 bg-surface-elevated hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors flex items-center gap-2 mx-auto min-h-[44px]"
        >
          {showComparison ? (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Hide Budget Comparison Table
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              Show Budget Comparison Table
            </>
          )}
        </button>
      </div>

      {/* Budget Comparison Table */}
      {showComparison && (
        <div className="mb-8 max-w-4xl mx-auto bg-surface rounded-lg p-6">
          <h2 className="text-xl font-bold mb-2 text-center text-gray-100">Budget Reference</h2>
          <p className="text-sm text-secondary text-center mb-4">
            Recommended spending targets for your strategy. Use the Budget Tracker in the header to monitor your actual spending.
          </p>
          
          <BudgetComparisonTable
            recommendations={recommendations}
            currentSpending={budgetSpent}
            referenceOnly={!hasSpendingData}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col items-center gap-4">
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
            {isSubmitting ? 'Loading...' : 'Next: Create Your Robot'}
          </button>
        </div>

        <p className="text-sm text-tertiary text-center max-w-md">
          These budget guidelines will help you make informed spending decisions throughout the game
        </p>
      </div>

      {/* Educational Note */}
      <div className="mt-8 max-w-3xl mx-auto bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-secondary">
            <strong className="text-primary">Remember:</strong> You can always revisit this information later.
            The budget tracker will help you stay on track as you make purchases.
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(Step4_BudgetAllocation);
