/**
 * RobotFinancialCard Component
 * Displays financial performance for an individual robot
 */

import { RobotFinancialData, formatCurrency } from '../utils/financialApi';

interface RobotFinancialCardProps {
  robot: RobotFinancialData;
  rank: number;
}

function RobotFinancialCard({ robot, rank }: RobotFinancialCardProps) {
  const isProfitable = robot.netIncome >= 0;
  const netIncomeColor = isProfitable ? 'text-green-400' : 'text-red-400';

  return (
    <div className="bg-gray-800 rounded-lg p-6 border-2 border-gray-700 font-mono text-sm">
      {/* Header */}
      <div className="mb-4 pb-4 border-b border-gray-600">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-xs">#{rank}</span>
              <h3 className="text-xl font-bold text-gray-100">{robot.name}</h3>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {robot.league.replace('_', ' ').toUpperCase()} | ELO: {robot.elo}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${netIncomeColor}`}>
              {isProfitable ? '+' : ''}{formatCurrency(robot.netIncome)}
            </div>
            <div className="text-xs text-gray-400">Net Income</div>
          </div>
        </div>
      </div>

      {/* Revenue Section */}
      <div className="mb-4">
        <h4 className="text-green-400 font-semibold mb-2">REVENUE:</h4>
        <div className="ml-2 space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-300">Battle Winnings:</span>
            <span className="text-gray-100">{formatCurrency(robot.revenue.battleWinnings)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">Merchandising:</span>
            <span className="text-gray-100">{formatCurrency(robot.revenue.merchandising)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">Streaming:</span>
            <span className="text-gray-100">{formatCurrency(robot.revenue.streaming)}</span>
          </div>
          <div className="border-t border-gray-600 my-1"></div>
          <div className="flex justify-between font-bold">
            <span className="text-green-400">Robot Revenue:</span>
            <span className="text-green-400">{formatCurrency(robot.revenue.total)}</span>
          </div>
        </div>
      </div>

      {/* Costs Section */}
      <div className="mb-4">
        <h4 className="text-red-400 font-semibold mb-2">COSTS:</h4>
        <div className="ml-2 space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-300">Repair Costs:</span>
            <span className="text-gray-100">{formatCurrency(robot.costs.repairs)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">Allocated Facilities*:</span>
            <span className="text-gray-100">{formatCurrency(robot.costs.allocatedFacilities)}</span>
          </div>
          <div className="border-t border-gray-600 my-1"></div>
          <div className="flex justify-between font-bold">
            <span className="text-red-400">Robot Costs:</span>
            <span className="text-red-400">{formatCurrency(robot.costs.total)}</span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-4 py-4 border-t-2 border-gray-600">
        <div className="space-y-2">
          <div className="flex justify-between text-lg font-bold">
            <span className="text-gray-200">NET INCOME:</span>
            <span className={netIncomeColor}>
              {isProfitable ? '+' : ''}{formatCurrency(robot.netIncome)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">ROI:</span>
            <span className={robot.roi >= 0 ? 'text-green-400' : 'text-red-400'}>
              {robot.roi >= 0 ? '+' : ''}{robot.roi}%
            </span>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="pt-4 border-t border-gray-600">
        <h4 className="text-gray-400 text-xs font-semibold mb-2">PERFORMANCE METRICS:</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-gray-500">Win Rate:</div>
            <div className="text-gray-200 font-semibold">{robot.metrics.winRate}%</div>
          </div>
          <div>
            <div className="text-gray-500">Avg Earnings/Battle:</div>
            <div className="text-gray-200 font-semibold">{formatCurrency(robot.metrics.avgEarningsPerBattle)}</div>
          </div>
          <div>
            <div className="text-gray-500">Total Battles (7d):</div>
            <div className="text-gray-200 font-semibold">{robot.metrics.totalBattles}</div>
          </div>
          <div>
            <div className="text-gray-500">Fame:</div>
            <div className="text-gray-200 font-semibold">{robot.metrics.fameContribution.toLocaleString()}</div>
          </div>
          <div className="col-span-2">
            <div className="text-gray-500">Repair Cost %:</div>
            <div className={`font-semibold ${robot.metrics.repairCostPercentage > 50 ? 'text-red-400' : 'text-gray-200'}`}>
              {robot.metrics.repairCostPercentage}% of revenue
            </div>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="mt-4 pt-2 border-t border-gray-700 text-xs text-gray-500 italic">
        *Facilities costs split evenly across active robots
      </div>
    </div>
  );
}

export default RobotFinancialCard;
