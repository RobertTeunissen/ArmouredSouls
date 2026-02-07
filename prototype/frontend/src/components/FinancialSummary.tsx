/**
 * FinancialSummary component
 * Displays financial overview on the dashboard
 */

import { useEffect, useState } from 'react';
import { 
  getFinancialSummary, 
  FinancialSummary as FinancialSummaryType,
  formatCurrency
} from '../utils/financialApi';

function FinancialSummary() {
  const [summary, setSummary] = useState<FinancialSummaryType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const data = await getFinancialSummary();
      setSummary(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch financial summary:', err);
      setError('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-surface p-6 rounded-lg border border-gray-700">
        <h2 className="text-2xl font-semibold mb-4">Financial Overview</h2>
        <div className="text-center py-4 text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="bg-surface p-6 rounded-lg border border-gray-700">
        <h2 className="text-2xl font-semibold mb-4">Financial Overview</h2>
        <div className="text-center py-4 text-error">{error || 'No data available'}</div>
      </div>
    );
  }

  const isPositive = summary.netPassiveIncome >= 0;
  const prestigeBonusPercent = Math.round((summary.prestigeMultiplier - 1) * 100);

  return (
    <div className="bg-surface p-4 rounded-lg border border-gray-700">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">Financial Overview</h2>
        <button
          onClick={() => window.location.href = '/income'}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          View Income Dashboard →
        </button>
      </div>
      
      <div className="space-y-3">
        {/* Current Balance */}
        <div className="pb-3 border-b border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Current Balance</div>
          <div className="text-xl font-bold text-success">
            {formatCurrency(summary.currentBalance)}
          </div>
        </div>

        {/* Daily Net Income */}
        <div className="pb-3 border-b border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Daily Passive Net</div>
          <div className={`text-lg font-bold ${isPositive ? 'text-success' : 'text-error'}`}>
            {isPositive ? '+' : ''}{formatCurrency(summary.netPassiveIncome)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Income: {formatCurrency(summary.dailyPassiveIncome)} | 
            Costs: {formatCurrency(summary.dailyOperatingCosts)}
          </div>
        </div>

        {/* Prestige & Bonus */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-400 mb-1">Prestige</div>
            <div className="text-base font-semibold text-info">
              {summary.prestige.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Battle Bonus</div>
            <div className="text-base font-semibold text-primary">
              {prestigeBonusPercent > 0 ? `+${prestigeBonusPercent}%` : '0%'}
            </div>
          </div>
        </div>

        {/* Financial Tips */}
        {summary.netPassiveIncome < 0 && (
          <div className="mt-3 p-2 bg-error/20 border border-error rounded text-xs text-error">
            ⚠️ Facilities cost more than passive income. Win battles to stay profitable!
          </div>
        )}
        
        {summary.currentBalance < 100000 && (
          <div className="mt-3 p-2 bg-warning/20 border border-warning rounded text-xs text-warning">
            ⚠️ Low balance. Consider reducing costs or winning more battles.
          </div>
        )}
      </div>
    </div>
  );
}

export default FinancialSummary;
