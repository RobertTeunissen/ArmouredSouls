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
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">Financial Overview</h2>
        <div className="text-center py-4 text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">Financial Overview</h2>
        <div className="text-center py-4 text-red-400">{error || 'No data available'}</div>
      </div>
    );
  }

  const isPositive = summary.netPassiveIncome >= 0;
  const prestigeBonusPercent = Math.round((summary.prestigeMultiplier - 1) * 100);

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <h2 className="text-2xl font-semibold mb-4">Financial Overview</h2>
      
      <div className="space-y-4">
        {/* Current Balance */}
        <div className="pb-4 border-b border-gray-700">
          <div className="text-sm text-gray-400 mb-1">Current Balance</div>
          <div className="text-3xl font-bold text-green-400">
            {formatCurrency(summary.currentBalance)}
          </div>
        </div>

        {/* Daily Net Income */}
        <div className="pb-4 border-b border-gray-700">
          <div className="text-sm text-gray-400 mb-1">Daily Passive Net</div>
          <div className={`text-2xl font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{formatCurrency(summary.netPassiveIncome)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Income: {formatCurrency(summary.dailyPassiveIncome)} | 
            Costs: {formatCurrency(summary.dailyOperatingCosts)}
          </div>
        </div>

        {/* Prestige & Bonus */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-400 mb-1">Prestige</div>
            <div className="text-xl font-semibold text-purple-400">
              {summary.prestige.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Battle Bonus</div>
            <div className="text-xl font-semibold text-blue-400">
              {prestigeBonusPercent > 0 ? `+${prestigeBonusPercent}%` : '0%'}
            </div>
          </div>
        </div>

        {/* Financial Tips */}
        {summary.netPassiveIncome < 0 && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-700 rounded">
            <div className="text-sm text-red-400">
              ⚠️ Your facilities cost more than passive income generates. Win battles to stay profitable!
            </div>
          </div>
        )}
        
        {summary.currentBalance < 100000 && (
          <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded">
            <div className="text-sm text-yellow-400">
              ⚠️ Low balance warning. Consider reducing operating costs or winning more battles.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FinancialSummary;
