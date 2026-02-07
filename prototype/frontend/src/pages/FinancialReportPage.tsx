/**
 * FinancialReportPage
 * Comprehensive financial report with detailed breakdown
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import {
  getDailyFinancialReport,
  getFinancialProjections,
  FinancialReport,
  FinancialProjections,
  formatCurrency,
  getHealthColor,
  getHealthIcon,
} from '../utils/financialApi';

function FinancialReportPage() {
  const navigate = useNavigate();
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [projections, setProjections] = useState<FinancialProjections | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      const [reportData, projectionsData] = await Promise.all([
        getDailyFinancialReport(),
        getFinancialProjections(),
      ]);
      setReport(reportData);
      setProjections(projectionsData);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch financial data:', err);
      setError('Failed to load financial report');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12 text-gray-400">Loading financial report...</div>
        </div>
      </div>
    );
  }

  if (error || !report || !projections) {
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

  const healthColor = getHealthColor(report.financialHealth);
  const healthIcon = getHealthIcon(report.financialHealth);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Income Dashboard</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded transition-colors"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Financial Health Overview */}
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Financial Health</h2>
              <div className={`text-4xl font-bold ${healthColor}`}>
                {healthIcon} {report.financialHealth.toUpperCase()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400 mb-1">Current Balance</div>
              <div className="text-3xl font-bold text-green-400">
                {formatCurrency(report.currentBalance)}
              </div>
            </div>
          </div>
        </div>

        {/* Revenue & Expenses Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-green-400">Total Revenue</h3>
            <div className="text-3xl font-bold mb-4">
              {formatCurrency(report.revenue.total)}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Battle Winnings:</span>
                <span>{formatCurrency(report.revenue.battleWinnings)}</span>
              </div>
              {report.revenue.prestigeBonus > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Prestige Bonus:</span>
                  <span className="text-purple-400">+{formatCurrency(report.revenue.prestigeBonus)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Merchandising:</span>
                <span>{formatCurrency(report.revenue.merchandising)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Streaming:</span>
                <span>{formatCurrency(report.revenue.streaming)}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-red-400">Total Expenses</h3>
            <div className="text-3xl font-bold mb-4">
              {formatCurrency(report.expenses.total)}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Operating Costs:</span>
                <span>{formatCurrency(report.expenses.operatingCosts)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Repairs:</span>
                <span>{formatCurrency(report.expenses.repairs)}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Net Income</h3>
            <div className={`text-3xl font-bold mb-4 ${report.netIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {report.netIncome >= 0 ? '+' : ''}{formatCurrency(report.netIncome)}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Profit Margin:</span>
                <span>{report.profitMargin.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Days to Bankruptcy:</span>
                <span className={report.daysToBankruptcy < 30 ? 'text-red-400' : 'text-gray-300'}>
                  {report.daysToBankruptcy} days
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Operating Costs Breakdown */}
        {report.expenses.operatingCostsBreakdown.length > 0 && (
          <div className="bg-gray-800 p-6 rounded-lg mb-6">
            <h3 className="text-xl font-semibold mb-4">Operating Costs Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {report.expenses.operatingCostsBreakdown.map((item) => (
                <div key={item.facilityType} className="flex justify-between p-3 bg-gray-700 rounded">
                  <span className="text-gray-300">{item.facilityName}</span>
                  <span className="font-semibold">{formatCurrency(item.cost)}/day</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projections */}
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h3 className="text-xl font-semibold mb-4">Financial Projections</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-400 mb-1">Weekly Projection</div>
              <div className={`text-2xl font-bold ${projections.projections.weekly >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {projections.projections.weekly >= 0 ? '+' : ''}{formatCurrency(projections.projections.weekly)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Monthly Projection</div>
              <div className={`text-2xl font-bold ${projections.projections.monthly >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {projections.projections.monthly >= 0 ? '+' : ''}{formatCurrency(projections.projections.monthly)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Current Daily Net</div>
              <div className={`text-2xl font-bold ${projections.current.dailyNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {projections.current.dailyNet >= 0 ? '+' : ''}{formatCurrency(projections.current.dailyNet)}
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {projections.recommendations.length > 0 && (
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">💡 Recommendations</h3>
            <ul className="space-y-3">
              {projections.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-blue-400 mr-2">•</span>
                  <span className="text-gray-300">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default FinancialReportPage;
