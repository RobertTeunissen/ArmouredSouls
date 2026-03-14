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
    <div className="bg-surface p-6 rounded-lg font-mono text-sm">
      {/* Report Header */}
      <div className="border-t-2 border-l-2 border-r-2 border-gray-600 p-4">
        <h2 className="text-xl font-bold text-center text-gray-200">
          DAILY STABLE REPORT
        </h2>
        <p className="text-center text-secondary text-xs mt-1">{currentDate}</p>
      </div>

      {/* Report Body */}
      <div className="border-2 border-gray-600 p-4 space-y-4">
        {/* Revenue Streams Section */}
        <div>
          <h3 className="text-success font-semibold mb-2">REVENUE STREAMS:</h3>
          <div className="space-y-1 ml-2">
            <div className="flex justify-between">
              <span className="text-secondary">Battle Winnings:</span>
              <span className="text-gray-100">{formatCurrency(report.revenue.battleWinnings)}</span>
            </div>
            {prestigeBonusPercent > 0 && (
              <div className="flex justify-between">
                <span className="text-secondary">Prestige Bonus ({prestigeBonusPercent}%):</span>
                <span className="text-purple-400">{formatCurrency(report.revenue.prestigeBonus)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-secondary">Merchandising:</span>
              <span className="text-gray-100">{formatCurrency(report.revenue.merchandising)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Streaming (per battle):</span>
              <span className="text-gray-100">
                {formatCurrency(report.revenue.streaming)}
                {(report.revenue.streamingBattleCount ?? 0) > 0 && (
                  <span className="text-secondary text-xs ml-1">
                    (from {report.revenue.streamingBattleCount} {report.revenue.streamingBattleCount === 1 ? 'battle' : 'battles'})
                  </span>
                )}
              </span>
            </div>
            <div className="border-t border-gray-600 my-2"></div>
            <div className="flex justify-between font-bold">
              <span className="text-success">Total Revenue:</span>
              <span className="text-success">{formatCurrency(report.revenue.total)}</span>
            </div>
          </div>
        </div>

        {/* Operating Costs Section */}
        <div>
          <h3 className="text-warning font-semibold mb-2">OPERATING COSTS:</h3>
          <div className="space-y-1 ml-2">
            {report.expenses.operatingCostsBreakdown.map((item) => (
              <div key={item.facilityType} className="flex justify-between">
                <span className="text-secondary">
                  {/* eslint-disable @typescript-eslint/no-explicit-any */}
                  {item.facilityName} {(item as any).level !== undefined ? `(Lvl ${(item as any).level})` : ''}:
                  {/* eslint-enable @typescript-eslint/no-explicit-any */}
                </span>
                <span className="text-gray-100">{formatCurrency(item.cost)}</span>
              </div>
            ))}
            <div className="border-t border-gray-600 my-2"></div>
            <div className="flex justify-between font-bold">
              <span className="text-warning">Total Operating Costs:</span>
              <span className="text-warning">{formatCurrency(report.expenses.operatingCosts)}</span>
            </div>
          </div>
        </div>

        {/* Repairs Section */}
        {report.expenses.repairs > 0 && (
          <div>
            <h3 className="text-error font-semibold mb-2">REPAIRS:</h3>
            <div className="space-y-1 ml-2">
              <div className="flex justify-between">
                <span className="text-secondary">Total Repair Costs:</span>
                <span className="text-gray-100">{formatCurrency(report.expenses.repairs)}</span>
              </div>
              <div className="border-t border-gray-600 my-2"></div>
              <div className="flex justify-between font-bold">
                <span className="text-error">Total Repair Costs:</span>
                <span className="text-error">{formatCurrency(report.expenses.repairs)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Summary Section */}
        <div className="border-t-2 border-gray-600 pt-4 mt-4">
          <div className="space-y-2">
            <div className="flex justify-between text-lg font-bold">
              <span className="text-gray-200">NET INCOME:</span>
              <span className={report.netIncome >= 0 ? 'text-success' : 'text-error'}>
                {report.netIncome >= 0 ? '+' : ''}{formatCurrency(report.netIncome)}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span className="text-gray-200">CURRENT BALANCE:</span>
              <span className="text-success">{formatCurrency(report.currentBalance)}</span>
            </div>
          </div>
        </div>

        {/* Financial Metrics */}
        <div className="border-t border-gray-600 pt-4">
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-secondary">Financial Health:</span>
              <span className={
                report.financialHealth === 'excellent' || report.financialHealth === 'good'
                  ? 'text-success'
                  : report.financialHealth === 'stable'
                  ? 'text-warning'
                  : 'text-error'
              }>
                {report.financialHealth.charAt(0).toUpperCase() + report.financialHealth.slice(1)} {
                  report.financialHealth === 'excellent' || report.financialHealth === 'good' ? '✅' : 
                  report.financialHealth === 'stable' ? '⚠️' : '❌'
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Daily profit margin:</span>
              <span className="text-secondary">{report.profitMargin.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Days until bankruptcy:</span>
              <span className={report.daysToBankruptcy < 30 ? 'text-error' : 'text-secondary'}>
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
