/**
 * CycleComparisonPage
 * Displays cycle-to-cycle comparisons with deltas, percentage changes, and trend charts
 * 
 * Requirements: 6.2, 6.3
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';

interface MetricComparison {
  current: number;
  comparison: number;
  delta: number;
  percentChange: number;
}

interface StableComparison {
  userId: number;
  battlesParticipated: MetricComparison;
  totalCreditsEarned: MetricComparison;
  totalPrestigeEarned: MetricComparison;
  totalRepairCosts: MetricComparison;
  merchandisingIncome: MetricComparison;
  streamingIncome: MetricComparison;
  operatingCosts: MetricComparison;
  netProfit: MetricComparison;
}

interface ComparisonData {
  currentCycle: number;
  comparisonCycle: number;
  stableComparisons: StableComparison[];
  unavailableMetrics?: string[];
}

interface TrendDataPoint {
  cycleNumber: number;
  value: number;
  timestamp: string;
}

interface TrendData {
  metric: string;
  cycleRange: [number, number];
  data: TrendDataPoint[];
  movingAverage3?: Array<{ cycleNumber: number; value: number; average: number }>;
  trendLine?: {
    slope: number;
    intercept: number;
    points: Array<{ cycleNumber: number; value: number }>;
  };
}

function CycleComparisonPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [incomeTrend, setIncomeTrend] = useState<TrendData | null>(null);
  const [expensesTrend, setExpensesTrend] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentCycle, setCurrentCycle] = useState<number | null>(null);
  const [comparisonCycle, setComparisonCycle] = useState<number | null>(null);
  const [comparisonType, setComparisonType] = useState<'yesterday' | 'week' | 'custom'>('yesterday');

  useEffect(() => {
    if (user) {
      fetchLatestCycle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (currentCycle !== null && comparisonCycle !== null && user) {
      fetchComparisonData();
      fetchTrendData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCycle, comparisonCycle, user]);

  const fetchLatestCycle = async () => {
    try {
      if (!user) {
        throw new Error('User not logged in');
      }

      // Get latest cycle from summary endpoint
      const response = await fetch(
        `http://localhost:3001/api/analytics/stable/${user.id}/summary?lastNCycles=1`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch latest cycle');
      }

      const data = await response.json();
      const latest = data.cycleRange[1];
      setCurrentCycle(latest);
      
      // Default to yesterday comparison
      setComparisonCycle(Math.max(1, latest - 1));
    } catch (err) {
      console.error('Failed to fetch latest cycle:', err);
      setError(err instanceof Error ? err.message : 'Failed to load cycle data');
      setLoading(false);
    }
  };

  const fetchComparisonData = async () => {
    try {
      setLoading(true);
      if (!user) {
        throw new Error('User not logged in');
      }

      const response = await fetch(
        `http://localhost:3001/api/analytics/comparison?userId=${user.id}&current=${currentCycle}&comparison=${comparisonCycle}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch comparison data');
      }

      const data = await response.json();
      console.log('[CycleComparisonPage] Received comparison data:', data);
      setComparisonData(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch comparison data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load comparison');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendData = async () => {
    try {
      if (!user || currentCycle === null || comparisonCycle === null) {
        return;
      }

      const startCycle = Math.min(currentCycle, comparisonCycle);
      const endCycle = Math.max(currentCycle, comparisonCycle);

      // Fetch income trend
      const incomeResponse = await fetch(
        `http://localhost:3001/api/analytics/trends?userId=${user.id}&metric=income&startCycle=${startCycle}&endCycle=${endCycle}&includeMovingAverage=true&includeTrendLine=true`
      );

      if (incomeResponse.ok) {
        const incomeData = await incomeResponse.json();
        setIncomeTrend(incomeData);
      }

      // Fetch expenses trend
      const expensesResponse = await fetch(
        `http://localhost:3001/api/analytics/trends?userId=${user.id}&metric=expenses&startCycle=${startCycle}&endCycle=${endCycle}&includeMovingAverage=true&includeTrendLine=true`
      );

      if (expensesResponse.ok) {
        const expensesData = await expensesResponse.json();
        setExpensesTrend(expensesData);
      }
    } catch (err) {
      console.error('Failed to fetch trend data:', err);
      // Don't set error state - trends are optional
    }
  };

  const handleComparisonTypeChange = (type: 'yesterday' | 'week' | 'custom') => {
    setComparisonType(type);
    if (currentCycle !== null) {
      if (type === 'yesterday') {
        setComparisonCycle(Math.max(1, currentCycle - 1));
      } else if (type === 'week') {
        setComparisonCycle(Math.max(1, currentCycle - 7));
      }
    }
  };

  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '₡0';
    }
    return `₡${Math.floor(amount).toLocaleString()}`;
  };

  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return '0';
    }
    return Math.floor(value).toLocaleString();
  };

  const formatPercent = (percent: number | null | undefined): string => {
    if (percent === null || percent === undefined || isNaN(percent)) {
      return '0.0%';
    }
    const sign = percent > 0 ? '+' : '';
    return `${sign}${percent.toFixed(1)}%`;
  };

  const formatDelta = (delta: number | null | undefined): string => {
    if (delta === null || delta === undefined || isNaN(delta)) {
      return '₡0';
    }
    const sign = delta > 0 ? '+' : '';
    return `${sign}${formatCurrency(delta)}`;
  };

  const getPercentColor = (percent: number | null | undefined, inverse: boolean = false): string => {
    if (percent === null || percent === undefined || isNaN(percent)) {
      return 'text-gray-400';
    }
    const isPositive = inverse ? percent < 0 : percent > 0;
    if (isPositive) return 'text-green-400';
    if (percent === 0) return 'text-gray-400';
    return 'text-red-400';
  };

  const renderMetricCard = (
    label: string,
    metric: MetricComparison,
    inverse: boolean = false,
    isCurrency: boolean = true
  ) => {
    const formatter = isCurrency ? formatCurrency : formatNumber;
    return (
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-sm text-gray-400 mb-2">{label}</div>
        <div className="flex items-baseline justify-between mb-1">
          <div className="text-xl font-bold">{formatter(metric.current)}</div>
          <div className={`text-sm font-semibold ${getPercentColor(metric.percentChange, inverse)}`}>
            {formatPercent(metric.percentChange)}
          </div>
        </div>
        <div className="text-xs text-gray-500">
          vs {formatter(metric.comparison)}
        </div>
        <div className={`text-xs mt-1 ${getPercentColor(metric.delta, inverse)}`}>
          {isCurrency ? formatDelta(metric.delta) : `${metric.delta > 0 ? '+' : ''}${formatNumber(metric.delta)}`}
        </div>
      </div>
    );
  };

  const renderTrendChart = (trendData: TrendData | null, title: string, color: string) => {
    if (!trendData || trendData.data.length === 0) {
      return (
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">{title}</h3>
          <div className="text-center text-gray-500 py-8">No trend data available</div>
        </div>
      );
    }

    const maxValue = Math.max(...trendData.data.map(d => d.value));
    const minValue = Math.min(...trendData.data.map(d => d.value));
    const range = maxValue - minValue || 1;

    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="relative h-48">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Trend line */}
            {trendData.trendLine && (
              <line
                x1="0"
                y1={100 - ((trendData.trendLine.points[0].value - minValue) / range) * 100}
                x2="100"
                y2={100 - ((trendData.trendLine.points[trendData.trendLine.points.length - 1].value - minValue) / range) * 100}
                stroke="#6b7280"
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
            )}
            
            {/* Data line */}
            <polyline
              fill="none"
              stroke={color}
              strokeWidth="2"
              points={trendData.data.map((point, index) => {
                const x = (index / (trendData.data.length - 1)) * 100;
                const y = 100 - ((point.value - minValue) / range) * 100;
                return `${x},${y}`;
              }).join(' ')}
            />
            
            {/* Data points */}
            {trendData.data.map((point, index) => {
              const x = (index / (trendData.data.length - 1)) * 100;
              const y = 100 - ((point.value - minValue) / range) * 100;
              return (
                <circle
                  key={point.cycleNumber}
                  cx={x}
                  cy={y}
                  r="2"
                  fill={color}
                  className="hover:r-3 transition-all"
                >
                  <title>Cycle {point.cycleNumber}: {formatCurrency(point.value)}</title>
                </circle>
              );
            })}
            
            {/* Moving average */}
            {trendData.movingAverage3 && (
              <polyline
                fill="none"
                stroke={color}
                strokeWidth="1"
                opacity="0.5"
                strokeDasharray="3,3"
                points={trendData.movingAverage3.map((point, index) => {
                  const x = (index / (trendData.movingAverage3!.length - 1)) * 100;
                  const y = 100 - ((point.average - minValue) / range) * 100;
                  return `${x},${y}`;
                }).join(' ')}
              />
            )}
          </svg>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span>Cycle {trendData.cycleRange[0]}</span>
          <span>Cycle {trendData.cycleRange[1]}</span>
        </div>
        <div className="flex justify-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-0.5`} style={{ backgroundColor: color }}></div>
            <span className="text-gray-400">Actual</span>
          </div>
          {trendData.movingAverage3 && (
            <div className="flex items-center gap-2">
              <div className={`w-3 h-0.5 opacity-50`} style={{ backgroundColor: color, borderTop: '1px dashed' }}></div>
              <span className="text-gray-400">3-Cycle Avg</span>
            </div>
          )}
          {trendData.trendLine && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-gray-500" style={{ borderTop: '1px dashed' }}></div>
              <span className="text-gray-400">Trend</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12 text-gray-400">Loading comparison data...</div>
        </div>
      </div>
    );
  }

  if (error || !comparisonData) {
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

  const userComparison = comparisonData.stableComparisons?.[0];

  if (!userComparison) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12 text-gray-400">
            No comparison data available for your stable
          </div>
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

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Cycle Comparison</h1>
            <p className="text-gray-400 mt-2">
              Comparing Cycle {comparisonData.currentCycle} vs Cycle {comparisonData.comparisonCycle}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/cycle-summary')}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded transition-colors"
            >
              View Summary
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Comparison Type Selector */}
        <div className="bg-gray-800 p-4 rounded-lg mb-8">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">Compare with:</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleComparisonTypeChange('yesterday')}
                className={`px-4 py-2 rounded transition-colors ${
                  comparisonType === 'yesterday'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Yesterday (Cycle {currentCycle ? currentCycle - 1 : '-'})
              </button>
              <button
                onClick={() => handleComparisonTypeChange('week')}
                className={`px-4 py-2 rounded transition-colors ${
                  comparisonType === 'week'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Week Ago (Cycle {currentCycle ? Math.max(1, currentCycle - 7) : '-'})
              </button>
              <button
                onClick={() => handleComparisonTypeChange('custom')}
                className={`px-4 py-2 rounded transition-colors ${
                  comparisonType === 'custom'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Custom
              </button>
            </div>
            {comparisonType === 'custom' && (
              <div className="flex items-center gap-2 ml-4">
                <label className="text-sm text-gray-400">Cycle:</label>
                <input
                  type="number"
                  min="1"
                  max={currentCycle || 1}
                  value={comparisonCycle || 1}
                  onChange={(e) => setComparisonCycle(parseInt(e.target.value))}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-white w-24"
                />
              </div>
            )}
          </div>
        </div>

        {/* Unavailable Metrics Warning */}
        {comparisonData.unavailableMetrics && comparisonData.unavailableMetrics.length > 0 && (
          <div className="bg-yellow-900/20 border border-yellow-700 p-4 rounded-lg mb-8">
            <div className="text-yellow-400 font-semibold mb-2">⚠️ Some data unavailable</div>
            <div className="text-sm text-yellow-300">
              The following metrics are not available for the comparison cycle: {comparisonData.unavailableMetrics.join(', ')}
            </div>
          </div>
        )}

        {/* Income Metrics */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Income Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {renderMetricCard('Battle Credits', userComparison.totalCreditsEarned)}
            {renderMetricCard('Merchandising', userComparison.merchandisingIncome)}
            {renderMetricCard('Streaming', userComparison.streamingIncome)}
            {renderMetricCard('Total Income', {
              current: userComparison.totalCreditsEarned.current + 
                       userComparison.merchandisingIncome.current + 
                       userComparison.streamingIncome.current,
              comparison: userComparison.totalCreditsEarned.comparison + 
                          userComparison.merchandisingIncome.comparison + 
                          userComparison.streamingIncome.comparison,
              delta: userComparison.totalCreditsEarned.delta + 
                     userComparison.merchandisingIncome.delta + 
                     userComparison.streamingIncome.delta,
              percentChange: ((userComparison.totalCreditsEarned.current + 
                              userComparison.merchandisingIncome.current + 
                              userComparison.streamingIncome.current) - 
                             (userComparison.totalCreditsEarned.comparison + 
                              userComparison.merchandisingIncome.comparison + 
                              userComparison.streamingIncome.comparison)) / 
                            (userComparison.totalCreditsEarned.comparison + 
                             userComparison.merchandisingIncome.comparison + 
                             userComparison.streamingIncome.comparison || 1) * 100
            })}
          </div>
        </div>

        {/* Expense Metrics */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Expense Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderMetricCard('Repair Costs', userComparison.totalRepairCosts, true)}
            {renderMetricCard('Operating Costs', userComparison.operatingCosts, true)}
            {renderMetricCard('Total Expenses', {
              current: userComparison.totalRepairCosts.current + userComparison.operatingCosts.current,
              comparison: userComparison.totalRepairCosts.comparison + userComparison.operatingCosts.comparison,
              delta: userComparison.totalRepairCosts.delta + userComparison.operatingCosts.delta,
              percentChange: ((userComparison.totalRepairCosts.current + userComparison.operatingCosts.current) - 
                             (userComparison.totalRepairCosts.comparison + userComparison.operatingCosts.comparison)) / 
                            (userComparison.totalRepairCosts.comparison + userComparison.operatingCosts.comparison || 1) * 100
            }, true)}
          </div>
        </div>

        {/* Net Profit */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Net Profit</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderMetricCard('Net Profit', userComparison.netProfit)}
            {renderMetricCard('Battles Participated', userComparison.battlesParticipated, false, false)}
          </div>
        </div>

        {/* Trend Charts */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Trend Analysis</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderTrendChart(incomeTrend, 'Income Trend', '#10b981')}
            {renderTrendChart(expensesTrend, 'Expenses Trend', '#ef4444')}
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Other Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderMetricCard('Prestige Earned', userComparison.totalPrestigeEarned, false, false)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CycleComparisonPage;
