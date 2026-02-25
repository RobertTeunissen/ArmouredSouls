/**
 * DailyStableReport Component
 * Displays financial report in ASCII-style format matching PRD_INCOME_DASHBOARD.md
 */

import { FinancialReport, formatCurrency } from '../utils/financialApi';

interface DailyStableReportProps {
  report: FinancialReport;
}

function DailyStableReport({ report }: DailyStableReportProps) {
  // Get current date for report header
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Calculate prestige bonus percentage
  const prestigeBonusPercent = report.revenue.battleWinnings > 0
    ? Math.round((report.revenue.prestigeBonus / report.revenue.battleWinnings) * 100)
    : 0;

  return (
    <div className="bg-gray-800 p-6 rounded-lg font-mono text-sm">
      {/* Report Header */}
      <div className="border-t-2 border-l-2 border-r-2 border-gray-600 p-4">
        <h2 className="text-xl font-bold text-center text-gray-200">
          DAILY STABLE REPORT
        </h2>
        <p className="text-center text-gray-400 text-xs mt-1">{currentDate}</p>
      </div>

      {/* Report Body */}
      <div className="border-2 border-gray-600 p-4 space-y-4">
        {/* Revenue Streams Section */}
        <div>
          <h3 className="text-green-400 font-semibold mb-2">REVENUE STREAMS:</h3>
          <div className="space-y-1 ml-2">
            <div className="flex justify-between">
              <span className="text-gray-300">Battle Winnings:</span>
              <span className="text-gray-100">{formatCurrency(report.revenue.battleWinnings)}</span>
            </div>
            {prestigeBonusPercent > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-300">Prestige Bonus ({prestigeBonusPercent}%):</span>
                <span className="text-purple-400">{formatCurrency(report.revenue.prestigeBonus)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-300">Merchandising:</span>
              <span className="text-gray-100">{formatCurrency(report.revenue.merchandising)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Streaming (per battle):</span>
              <span className="text-gray-100">
                {formatCurrency(report.revenue.streaming)}
                {(report.revenue.streamingBattleCount ?? 0) > 0 && (
                  <span className="text-gray-400 text-xs ml-1">
                    (from {report.revenue.streamingBattleCount} {report.revenue.streamingBattleCount === 1 ? 'battle' : 'battles'})
                  </span>
                )}
              </span>
            </div>
            <div className="border-t border-gray-600 my-2"></div>
            <div className="flex justify-between font-bold">
              <span className="text-green-400">Total Revenue:</span>
              <span className="text-green-400">{formatCurrency(report.revenue.total)}</span>
            </div>
          </div>
        </div>

        {/* Operating Costs Section */}
        <div>
          <h3 className="text-yellow-400 font-semibold mb-2">OPERATING COSTS:</h3>
          <div className="space-y-1 ml-2">
            {report.expenses.operatingCostsBreakdown.map((item) => (
              <div key={item.facilityType} className="flex justify-between">
                <span className="text-gray-300">
                  {item.facilityName} {(item as any).level !== undefined ? `(Lvl ${(item as any).level})` : ''}:
                </span>
                <span className="text-gray-100">{formatCurrency(item.cost)}</span>
              </div>
            ))}
            <div className="border-t border-gray-600 my-2"></div>
            <div className="flex justify-between font-bold">
              <span className="text-yellow-400">Total Operating Costs:</span>
              <span className="text-yellow-400">{formatCurrency(report.expenses.operatingCosts)}</span>
            </div>
          </div>
        </div>

        {/* Repairs Section */}
        {report.expenses.repairs > 0 && (
          <div>
            <h3 className="text-red-400 font-semibold mb-2">REPAIRS:</h3>
            <div className="space-y-1 ml-2">
              <div className="flex justify-between">
                <span className="text-gray-300">Total Repair Costs:</span>
                <span className="text-gray-100">{formatCurrency(report.expenses.repairs)}</span>
              </div>
              <div className="border-t border-gray-600 my-2"></div>
              <div className="flex justify-between font-bold">
                <span className="text-red-400">Total Repair Costs:</span>
                <span className="text-red-400">{formatCurrency(report.expenses.repairs)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Summary Section */}
        <div className="border-t-2 border-gray-600 pt-4 mt-4">
          <div className="space-y-2">
            <div className="flex justify-between text-lg font-bold">
              <span className="text-gray-200">NET INCOME:</span>
              <span className={report.netIncome >= 0 ? 'text-green-400' : 'text-red-400'}>
                {report.netIncome >= 0 ? '+' : ''}{formatCurrency(report.netIncome)}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span className="text-gray-200">CURRENT BALANCE:</span>
              <span className="text-green-400">{formatCurrency(report.currentBalance)}</span>
            </div>
          </div>
        </div>

        {/* Financial Metrics */}
        <div className="border-t border-gray-600 pt-4">
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Financial Health:</span>
              <span className={
                report.financialHealth === 'excellent' || report.financialHealth === 'good'
                  ? 'text-green-400'
                  : report.financialHealth === 'stable'
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }>
                {report.financialHealth.charAt(0).toUpperCase() + report.financialHealth.slice(1)} {
                  report.financialHealth === 'excellent' || report.financialHealth === 'good' ? '✅' : 
                  report.financialHealth === 'stable' ? '⚠️' : '❌'
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Daily profit margin:</span>
              <span className="text-gray-300">{report.profitMargin.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Days until bankruptcy:</span>
              <span className={report.daysToBankruptcy < 30 ? 'text-red-400' : 'text-gray-300'}>
                {report.daysToBankruptcy} days
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DailyStableReport;
