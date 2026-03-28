/**
 * CycleSummaryPage
 * Displays last 10 cycles income/expenses with net profit trend and chart visualization
 * 
 * Requirements: 6.1, 6.3
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/formatters';
import Navigation from '../components/Navigation';
import apiClient from '../utils/apiClient';

interface CycleData {
  cycleNumber: number;
  income: number;
  expenses: number;
  purchases: number;
  netProfit: number;
  balance: number; // Balance at end of cycle
  breakdown: {
    battleCredits: number;
    merchandising: number;
    streaming: number;
    repairCosts: number;
    operatingCosts: number;
    weaponPurchases: number;
    facilityPurchases: number;
    robotPurchases: number;
    attributeUpgrades: number;
  };
}

interface CycleSummaryData {
  userId: number;
  cycleRange: [number, number];
  totalIncome: number;
  totalExpenses: number;
  totalPurchases: number;
  netProfit: number;
  cycles: CycleData[];
}

function CycleSummaryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<CycleSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cycleCount, setCycleCount] = useState(10);

  useEffect(() => {
    if (user) {
      fetchCycleSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleCount, user]);

  const fetchCycleSummary = async () => {
    try {
      setLoading(true);
      if (!user) {
        throw new Error('User not logged in');
      }

      const response = await apiClient.get(
        `/api/analytics/stable/${user.id}/summary?lastNCycles=${cycleCount}`
      );

      if (response.status !== 200) {
        throw new Error(response.data?.message || 'Failed to fetch cycle summary');
      }

      const summaryData = response.data;
      setData(summaryData);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch cycle summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to load cycle summary');
    } finally {
      setLoading(false);
    }
  };

  const getBarHeight = (value: number, maxValue: number): number => {
    if (maxValue === 0) return 0;
    return (Math.abs(value) / maxValue) * 100;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12 text-secondary">Loading cycle summary...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12 text-error">{error}</div>
          <div className="text-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-primary hover:bg-blue-700 px-6 py-2 rounded transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.cycles.length === 0) {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-secondary text-lg">No cycle data available yet.</p>
            <p className="text-tertiary mt-2">Cycle summaries will appear here once cycles have been completed.</p>
          </div>
          <div className="text-center mt-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-primary hover:bg-blue-700 px-6 py-2 rounded transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Cycle Summary</h1>
            <p className="text-secondary mt-1">
              Cycles {data.cycleRange[0]} - {data.cycleRange[1]}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={cycleCount}
              onChange={(e) => setCycleCount(parseInt(e.target.value))}
              className="bg-surface border border-white/10 rounded px-3 py-2 text-white text-sm"
            >
              <option value={5}>Last 5</option>
              <option value={10}>Last 10</option>
              <option value={20}>Last 20</option>
              <option value={50}>Last 50</option>
            </select>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-surface-elevated hover:bg-gray-600 px-4 py-2 rounded transition-colors text-sm"
            >
              Dashboard
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <div className="bg-surface p-3 sm:p-6 rounded-lg">
            <div className="text-xs sm:text-sm text-secondary mb-1">Total Income</div>
            <div className="text-lg sm:text-2xl font-bold text-success">
              {formatCurrency(data.totalIncome)}
            </div>
          </div>
          <div className="bg-surface p-3 sm:p-6 rounded-lg">
            <div className="text-xs sm:text-sm text-secondary mb-1">Total Expenses</div>
            <div className="text-lg sm:text-2xl font-bold text-error">
              {formatCurrency(data.totalExpenses)}
            </div>
          </div>
          <div className="bg-surface p-3 sm:p-6 rounded-lg">
            <div className="text-xs sm:text-sm text-secondary mb-1">Total Purchases</div>
            <div className="text-lg sm:text-2xl font-bold text-orange-400">
              {formatCurrency(data.totalPurchases)}
            </div>
          </div>
          <div className="bg-surface p-3 sm:p-6 rounded-lg">
            <div className="text-xs sm:text-sm text-secondary mb-1">Net Profit</div>
            <div className={`text-lg sm:text-2xl font-bold ${data.netProfit >= 0 ? 'text-success' : 'text-error'}`}>
              {data.netProfit >= 0 ? '+' : ''}{formatCurrency(data.netProfit)}
            </div>
          </div>
        </div>

        {/* Chart Visualization */}
        <div className="bg-surface p-4 sm:p-6 rounded-lg mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-6">Income vs Expenses Trend</h2>
          <div className="overflow-x-auto">
            <div className="relative" style={{ minWidth: `${Math.max(800, data.cycles.length * 40)}px` }}>
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-12 flex flex-col justify-between text-xs text-secondary pr-3 py-2">
                {(() => {
                  const globalMax = Math.max(...data.cycles.map(c => Math.max(c.income, c.expenses)));
                  const maxRounded = Math.ceil(globalMax / 1000) * 1000;
                  return (
                    <>
                      <span>₡{(maxRounded / 1000).toFixed(0)}k</span>
                      <span>₡{(maxRounded * 0.75 / 1000).toFixed(0)}k</span>
                      <span>₡{(maxRounded * 0.5 / 1000).toFixed(0)}k</span>
                      <span>₡{(maxRounded * 0.25 / 1000).toFixed(0)}k</span>
                      <span>₡0</span>
                    </>
                  );
                })()}
              </div>
              
              {/* Chart area */}
              <div className="ml-16 flex items-end justify-between h-64 gap-1">
                {data.cycles.map((cycle) => {
                  const globalMax = Math.max(...data.cycles.map(c => Math.max(c.income, c.expenses)));
                  return (
                    <div key={cycle.cycleNumber} className="flex flex-col items-center" style={{ width: '36px' }}>
                      <div className="flex-1 w-full flex items-end justify-center gap-0.5">
                        {/* Income Bar */}
                        <div className="flex-1 flex flex-col justify-end">
                          <div className="relative group">
                            <div
                              className="bg-green-500 hover:bg-green-400 transition-colors rounded-t w-full"
                              style={{ height: `${getBarHeight(cycle.income, globalMax) * 2.5}px`, minHeight: cycle.income > 0 ? '4px' : '0px' }}
                            />
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-background text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                              Income: {formatCurrency(cycle.income)}
                            </div>
                          </div>
                        </div>
                        {/* Expenses Bar */}
                        <div className="flex-1 flex flex-col justify-end">
                          <div className="relative group">
                            <div
                              className="bg-red-500 hover:bg-red-400 transition-colors rounded-t w-full"
                              style={{ height: `${getBarHeight(cycle.expenses, globalMax) * 2.5}px`, minHeight: cycle.expenses > 0 ? '4px' : '0px' }}
                            />
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-background text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                              Expenses: {formatCurrency(cycle.expenses)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* X-axis labels below the chart */}
              <div className="ml-16 flex justify-between mt-2">
                {data.cycles.map((cycle, index) => {
                  // Show every Nth label to avoid overlap
                  const showEvery = data.cycles.length > 30 ? 5 : data.cycles.length > 20 ? 3 : data.cycles.length > 10 ? 2 : 1;
                  if (index % showEvery === 0 || index === data.cycles.length - 1) {
                    return (
                      <div key={cycle.cycleNumber} className="text-xs text-secondary" style={{ width: `${36 * showEvery}px`, textAlign: index === data.cycles.length - 1 ? 'right' : 'left' }}>
                        C{cycle.cycleNumber}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm text-secondary">Income</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-sm text-secondary">Expenses</span>
            </div>
          </div>
        </div>

        {/* Detailed Cycle Data */}
        <div className="bg-surface rounded-lg overflow-hidden">
          <h2 className="text-xl font-semibold p-6 pb-4">Cycle Details</h2>

          {/* Desktop Table - hidden on mobile */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-elevated">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Cycle</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wider">Battle</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wider">Merch</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wider">Stream</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wider">Income</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wider">Repairs</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wider">Ops</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wider">Expenses</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wider">Purchases</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wider">Net</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wider">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {data.cycles.map((cycle) => (
                  <tr key={cycle.cycleNumber} className="hover:bg-gray-750">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">C{cycle.cycleNumber}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-secondary">{formatCurrency(cycle.breakdown.battleCredits)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-secondary">{formatCurrency(cycle.breakdown.merchandising)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-secondary">{formatCurrency(cycle.breakdown.streaming)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-success">{formatCurrency(cycle.income)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-secondary">{formatCurrency(cycle.breakdown.repairCosts)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-secondary">{formatCurrency(cycle.breakdown.operatingCosts)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-error">{formatCurrency(cycle.expenses)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                      <div className="group relative">
                        <span className="font-medium text-orange-400 cursor-help">{formatCurrency(cycle.purchases)}</span>
                        {cycle.purchases > 0 && (
                          <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block bg-background text-white text-xs rounded py-2 px-3 whitespace-nowrap z-10 border border-white/10">
                            <div>Weapons: {formatCurrency(cycle.breakdown.weaponPurchases)}</div>
                            <div>Facilities: {formatCurrency(cycle.breakdown.facilityPurchases)}</div>
                            <div>Robots: {formatCurrency(cycle.breakdown.robotPurchases || 0)}</div>
                            <div>Upgrades: {formatCurrency(cycle.breakdown.attributeUpgrades)}</div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-bold ${cycle.netProfit >= 0 ? 'text-success' : 'text-error'}`}>
                      {cycle.netProfit >= 0 ? '+' : ''}{formatCurrency(cycle.netProfit)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-primary">{formatCurrency(cycle.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards - hidden on desktop */}
          <div className="lg:hidden space-y-3 px-4 pb-4">
            {data.cycles.map((cycle) => (
              <div key={cycle.cycleNumber} className="bg-surface-elevated rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-semibold">Cycle {cycle.cycleNumber}</span>
                  <span className={`font-bold ${cycle.netProfit >= 0 ? 'text-success' : 'text-error'}`}>
                    {cycle.netProfit >= 0 ? '+' : ''}{formatCurrency(cycle.netProfit)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-secondary">Income</span>
                    <span className="text-success">{formatCurrency(cycle.income)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Expenses</span>
                    <span className="text-error">{formatCurrency(cycle.expenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Battle</span>
                    <span>{formatCurrency(cycle.breakdown.battleCredits)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Repairs</span>
                    <span>{formatCurrency(cycle.breakdown.repairCosts)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Merch</span>
                    <span>{formatCurrency(cycle.breakdown.merchandising)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Ops</span>
                    <span>{formatCurrency(cycle.breakdown.operatingCosts)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Stream</span>
                    <span>{formatCurrency(cycle.breakdown.streaming)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Purchases</span>
                    <span className="text-orange-400">{formatCurrency(cycle.purchases)}</span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-white/10 flex justify-between text-sm">
                  <span className="text-secondary">Balance</span>
                  <span className="font-bold text-primary">{formatCurrency(cycle.balance)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CycleSummaryPage;
