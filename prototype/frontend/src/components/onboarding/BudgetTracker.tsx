/**
 * BudgetTracker component
 * Real-time budget tracking during onboarding tutorial.
 * Adapted from FinancialSummary component.
 * 
 * Features:
 * - Display starting budget (₡3,000,000)
 * - Show spent amount by category
 * - Show remaining credits
 * - Display warnings when credits < ₡600K or < ₡200K
 * - Update in real-time as purchases are made
 * 
 * Requirements: 3.2, 3.3, 3.6, 19.1-19.9
 */

import { useEffect, useState } from 'react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { formatCurrency } from '../../utils/financialApi';
import apiClient from '../../utils/apiClient';

interface UserCredits {
  currency: number;
}

const STARTING_BUDGET = 3000000; // ₡3,000,000
const WARNING_THRESHOLD_HIGH = 600000; // ₡600K
const WARNING_THRESHOLD_CRITICAL = 200000; // ₡200K
const RESERVE_RECOMMENDATION = 50000; // ₡50K

const BudgetTracker = () => {
  const { tutorialState } = useOnboarding();
  const [currentCredits, setCurrentCredits] = useState<number>(STARTING_BUDGET);
  const [initialLoading, setInitialLoading] = useState(true);

  // Fetch current credits from user profile (once on mount)
  useEffect(() => {
    let mounted = true;

    const fetchCredits = async () => {
      try {
        const response = await apiClient.get('/api/user/profile');
        const userData = response.data as UserCredits;
        if (mounted) {
          setCurrentCredits(userData.currency);
          setInitialLoading(false);
        }
      } catch {
        if (mounted) setInitialLoading(false);
      }
    };

    fetchCredits();

    return () => { mounted = false; };
  }, []);

  // Calculate spending from onboarding choices
  const budgetSpent = tutorialState?.choices.budgetSpent || {
    facilities: 0,
    robots: 0,
    weapons: 0,
    attributes: 0,
  };

  const totalSpent = STARTING_BUDGET - currentCredits;
  const remaining = currentCredits;
  const percentageRemaining = (remaining / STARTING_BUDGET) * 100;

  // Determine warning level
  const getWarningLevel = () => {
    if (remaining < WARNING_THRESHOLD_CRITICAL) {
      return 'critical';
    } else if (remaining < WARNING_THRESHOLD_HIGH) {
      return 'warning';
    }
    return 'normal';
  };

  const warningLevel = getWarningLevel();

  // Get warning message
  const getWarningMessage = () => {
    if (warningLevel === 'critical') {
      return `Critical: Only ${formatCurrency(remaining)} remaining! Avoid additional spending.`;
    } else if (warningLevel === 'warning') {
      return `Warning: ${formatCurrency(remaining)} remaining. Be careful with spending.`;
    }
    return null;
  };

  const warningMessage = getWarningMessage();

  if (initialLoading) {
    return (
      <div className="bg-surface px-4 py-2 rounded border border-gray-700">
        <div className="text-xs text-gray-400">Loading budget...</div>
      </div>
    );
  }

  return (
    <div className="bg-surface px-3 py-1.5 rounded border border-gray-700" role="region" aria-label="Budget Tracker">
      {/* Current balance inline with progress bar */}
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className={`text-sm font-bold whitespace-nowrap ${
            warningLevel === 'critical'
              ? 'text-red-500'
              : warningLevel === 'warning'
              ? 'text-yellow-500'
              : 'text-green-500'
          }`}
          aria-label={`Remaining credits: ${formatCurrency(remaining)}`}
          aria-live="polite"
        >
          {formatCurrency(remaining)}
        </div>
        <div
          className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(percentageRemaining)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Budget: ${Math.round(percentageRemaining)}% remaining`}
        >
          <div
            className={`h-full transition-all duration-300 ${
              warningLevel === 'critical'
                ? 'bg-red-500'
                : warningLevel === 'warning'
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${percentageRemaining}%` }}
          />
        </div>
      </div>

      {/* Spending breakdown - compact */}
      <div className="space-y-0.5 text-xs">
        <div className="flex justify-between text-gray-400">
          <span>Starting:</span>
          <span className="font-medium">{formatCurrency(STARTING_BUDGET)}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Spent:</span>
          <span className="font-medium">{formatCurrency(totalSpent)}</span>
        </div>
        
        {/* Category breakdown (if any spending occurred) */}
        {totalSpent > 0 && (
          <div className="pl-3 space-y-0.5 mt-0.5 pt-0.5 border-t border-gray-700">
            {budgetSpent.facilities > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>• Facilities:</span>
                <span>{formatCurrency(budgetSpent.facilities)}</span>
              </div>
            )}
            {budgetSpent.robots > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>• Robots:</span>
                <span>{formatCurrency(budgetSpent.robots)}</span>
              </div>
            )}
            {budgetSpent.weapons > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>• Weapons:</span>
                <span>{formatCurrency(budgetSpent.weapons)}</span>
              </div>
            )}
            {budgetSpent.attributes > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>• Attributes:</span>
                <span>{formatCurrency(budgetSpent.attributes)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Warning message */}
      {warningMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className={`text-xs p-1 rounded mt-1.5 ${
            warningLevel === 'critical'
              ? 'bg-red-900 bg-opacity-30 text-red-400 border border-red-700'
              : 'bg-yellow-900 bg-opacity-30 text-yellow-400 border border-yellow-700'
          }`}
        >
          {warningMessage}
        </div>
      )}

      {/* Reserve recommendation */}
      {remaining < RESERVE_RECOMMENDATION * 2 && remaining > RESERVE_RECOMMENDATION && (
        <div role="status" className="text-xs p-1 rounded bg-blue-900 bg-opacity-30 text-blue-400 border border-blue-700 mt-1.5">
          Tip: Keep at least {formatCurrency(RESERVE_RECOMMENDATION)} for repairs.
        </div>
      )}
    </div>
  );
};

export default BudgetTracker;
