/**
 * CycleSummaryPage
 * Displays last 10 cycles income/expenses with net profit trend and chart visualization
 * 
 * Requirements: 6.1, 6.3
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';

interface CycleData {
  cycleNumber: number;
  income: number;
  expenses: number;
  netProfit: number;
  breakdown: {
    battleCredits: number;
    merchandising: number;
    streaming: number;
    repairCosts: number;
    operatingCosts: number;
  };
}

interface CycleSummaryData {
  userId: number;
  cycleRange: [number, number];
  totalIncome: number;
  totalExpenses: number;
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

      const response = await fetch(
        `http://localhost:3001/api/analytics/stable/${user.id}/summary?lastNCycles=${cycleCount}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch cycle summary');
      }

      const summaryData = await response.json();
      setData(summaryData);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch cycle summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to load cycle summary');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return `₡${Math.floor(amount).toLocaleString()}`;
  };

  const getBarHeight = (value: number, maxValue: number): number => {
    if (maxValue === 0) return 0;
    return (Math.abs(value) / maxValue) * 100;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12 text-gray-400">Loading cycle summary...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12 text-red-400">{error || 'No data available'}</div>
          <div className="text-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const avgNetProfit = data.cycles.length > 0 
    ? data.cycles.reduce((sum, c) => sum + c.netProfit, 0) / data.cycles.length 
    : 0;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Cycle Summary</h1>
            <p className="text-gray-400 mt-2">
              Cycles {data.cycleRange[0]} - {data.cycleRange[1]}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={cycleCount}
              onChange={(e) => setCycleCount(parseInt(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white"
            >
              <option value={5}>Last 5 Cycles</option>
              <option value={10}>Last 10 Cycles</option>
              <option value={20}>Last 20 Cycles</option>
              <option value={50}>Last 50 Cycles</option>
            </select>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-lg">
            <div className="text-sm text-gray-400 mb-2">Total Income</div>
            <div className="text-2xl font-bold text-green-400">
              {formatCurrency(data.totalIncome)}
            </div>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <div className="text-sm text-gray-400 mb-2">Total Expenses</div>
            <div className="text-2xl font-bold text-red-400">
              {formatCurrency(data.totalExpenses)}
            </div>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <div className="text-sm text-gray-400 mb-2">Net Profit</div>
            <div className={`text-2xl font-bold ${data.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.netProfit >= 0 ? '+' : ''}{formatCurrency(data.netProfit)}
            </div>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <div className="text-sm text-gray-400 mb-2">Avg Net Profit/Cycle</div>
            <div className={`text-2xl font-bold ${avgNetProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {avgNetProfit >= 0 ? '+' : ''}{formatCurrency(avgNetProfit)}
            </div>
          </div>
        </div>

        {/* Chart Visualization */}
        <div className="bg-gray-800 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold mb-6">Income vs Expenses Trend</h2>
          <div className="overflow-x-auto">
            <div className="relative" style={{ minWidth: `${Math.max(800, data.cycles.length * 40)}px` }}>
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-12 flex flex-col justify-between text-xs text-gray-400 pr-3 py-2">
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
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
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
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
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
                      <div key={cycle.cycleNumber} className="text-xs text-gray-400" style={{ width: `${36 * showEvery}px`, textAlign: index === data.cycles.length - 1 ? 'right' : 'left' }}>
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
              <span className="text-sm text-gray-400">Income</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-sm text-gray-400">Expenses</span>
            </div>
          </div>
        </div>

        {/* Detailed Cycle Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <h2 className="text-xl font-semibold p-6 pb-4">Cycle Details</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Cycle
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Battle Credits
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Merchandising
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Streaming
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Total Income
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Repair Costs
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Operating Costs
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Total Expenses
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Net Profit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {data.cycles.map((cycle) => (
                  <tr key={cycle.cycleNumber} className="hover:bg-gray-750">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      Cycle {cycle.cycleNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                      {formatCurrency(cycle.breakdown.battleCredits)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                      {formatCurrency(cycle.breakdown.merchandising)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                      {formatCurrency(cycle.breakdown.streaming)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-green-400">
                      {formatCurrency(cycle.income)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                      {formatCurrency(cycle.breakdown.repairCosts)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                      {formatCurrency(cycle.breakdown.operatingCosts)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-red-400">
                      {formatCurrency(cycle.expenses)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${
                      cycle.netProfit >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {cycle.netProfit >= 0 ? '+' : ''}{formatCurrency(cycle.netProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CycleSummaryPage;
