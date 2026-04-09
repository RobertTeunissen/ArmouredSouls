/**
 * FinancialSummary component
 * Displays financial overview on the dashboard
 * Reads data from the stable Zustand store instead of fetching independently.
 */

import { useEffect } from 'react';
import { formatCurrency } from '../utils/financialApi';
import { useStableStore } from '../stores';

function FinancialSummary() {
  const financialSummary = useStableStore(state => state.financialSummary);
  const loading = useStableStore(state => state.loading);
  const error = useStableStore(state => state.error);
  const fetchStableData = useStableStore(state => state.fetchStableData);

  useEffect(() => {
    // Only fetch if we don't already have data (avoids redundant calls when store is shared)
    if (!financialSummary) {
      fetchStableData();
    }
  }, [financialSummary, fetchStableData]);

  if (loading) {
    return (
      <div className="bg-surface p-6 rounded-lg border border-white/10">
        <h2 className="text-2xl font-semibold mb-4">Financial Overview</h2>
        <div className="text-center py-4 text-secondary">Loading...</div>
      </div>
    );
  }

  if (error || !financialSummary) {
    return (
      <div className="bg-surface p-6 rounded-lg border border-white/10">
        <h2 className="text-2xl font-semibold mb-4">Financial Overview</h2>
        <div className="text-center py-4 text-error">{error || 'No data available'}</div>
      </div>
    );
  }

  const isPositive = financialSummary.netPassiveIncome >= 0;

  return (
    <div className="bg-surface p-4 rounded-lg border border-white/10">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">Financial Overview</h2>
        <button
          onClick={() => window.location.href = '/income'}
          className="text-sm text-primary hover:text-blue-300 transition-colors"
        >
          View Income Dashboard →
        </button>
      </div>
      
      <div className="space-y-3">
        {/* Current Balance */}
        <div className="pb-3 border-b border-white/10">
          <div className="text-xs text-secondary mb-1">Current Balance</div>
          <div className="text-xl font-bold text-success">
            {formatCurrency(financialSummary.currentBalance)}
          </div>
        </div>

        {/* Daily Net Income */}
        <div className="pb-3">
          <div className="text-xs text-secondary mb-1">Daily Passive Net</div>
          <div className={`text-lg font-bold ${isPositive ? 'text-success' : 'text-error'}`}>
            {isPositive ? '+' : ''}{formatCurrency(financialSummary.netPassiveIncome)}
          </div>
          <div className="text-xs text-tertiary mt-1">
            Income: {formatCurrency(financialSummary.dailyPassiveIncome)} | 
            Costs: {formatCurrency(financialSummary.dailyOperatingCosts)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FinancialSummary;
