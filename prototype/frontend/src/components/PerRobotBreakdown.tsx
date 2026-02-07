/**
 * PerRobotBreakdown Component
 * Container for per-robot financial analysis with profitability ranking
 */

import { PerRobotFinancialReport, formatCurrency } from '../utils/financialApi';
import RobotFinancialCard from './RobotFinancialCard';

interface PerRobotBreakdownProps {
  report: PerRobotFinancialReport;
}

function PerRobotBreakdown({ report }: PerRobotBreakdownProps) {
  if (report.robots.length === 0) {
    return (
      <div className="bg-gray-800 p-8 rounded-lg text-center">
        <div className="text-gray-400 text-lg mb-4">No Robots Found</div>
        <div className="text-gray-500 text-sm">
          Create robots to see their financial performance and profitability analysis.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">Robot Profitability Ranking</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-700 p-4 rounded">
            <div className="text-sm text-gray-400 mb-1">Total Revenue</div>
            <div className="text-2xl font-bold text-green-400">
              {formatCurrency(report.summary.totalRevenue)}
            </div>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <div className="text-sm text-gray-400 mb-1">Total Costs</div>
            <div className="text-2xl font-bold text-red-400">
              {formatCurrency(report.summary.totalCosts)}
            </div>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <div className="text-sm text-gray-400 mb-1">Total Net Income</div>
            <div className={`text-2xl font-bold ${report.summary.totalNetIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {report.summary.totalNetIncome >= 0 ? '+' : ''}{formatCurrency(report.summary.totalNetIncome)}
            </div>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <div className="text-sm text-gray-400 mb-1">Average ROI</div>
            <div className={`text-2xl font-bold ${report.summary.averageROI >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {report.summary.averageROI >= 0 ? '+' : ''}{report.summary.averageROI}%
            </div>
          </div>
        </div>

        {/* Most/Least Profitable */}
        {report.summary.mostProfitable && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-green-900/20 border border-green-700 p-3 rounded">
              <div className="text-green-400 font-semibold">🏆 Most Profitable:</div>
              <div className="text-gray-200 mt-1">{report.summary.mostProfitable}</div>
            </div>
            {report.summary.leastProfitable && report.robots.length > 1 && (
              <div className="bg-red-900/20 border border-red-700 p-3 rounded">
                <div className="text-red-400 font-semibold">⚠️ Least Profitable:</div>
                <div className="text-gray-200 mt-1">{report.summary.leastProfitable}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Robot Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {report.robots.map((robot, index) => (
          <RobotFinancialCard key={robot.id} robot={robot} rank={index + 1} />
        ))}
      </div>
    </div>
  );
}

export default PerRobotBreakdown;
