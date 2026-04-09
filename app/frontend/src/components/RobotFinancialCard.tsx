/**
 * RobotFinancialCard Component
 * Displays financial performance for an individual robot
 */

import { RobotFinancialData, formatCurrency } from '../utils/financialApi';
import { useState } from 'react';

interface RobotFinancialCardProps {
  robot: RobotFinancialData;
  rank: number;
}

function RobotFinancialCard({ robot, rank }: RobotFinancialCardProps) {
  const [showBattles, setShowBattles] = useState(false);
  const isProfitable = robot.netIncome >= 0;
  const netIncomeColor = isProfitable ? 'text-success' : 'text-error';

  // Generate recommendations for this robot
  const recommendations = [];
  if (robot.metrics.repairCostPercentage > 50) {
    recommendations.push({
      type: 'warning',
      message: `High repair costs (${robot.metrics.repairCostPercentage}% of revenue). Consider upgrading Medical Bay or avoiding risky battles.`,
    });
  }
  if (robot.netIncome < 0) {
    recommendations.push({
      type: 'error',
      message: `Negative net income (${formatCurrency(robot.netIncome)}). Focus on winning battles and reducing repair costs.`,
    });
  }
  if (robot.roi > 100) {
    recommendations.push({
      type: 'success',
      message: `Excellent ROI (${robot.roi}%). Consider entering tournaments to maximize earnings.`,
    });
  }
  if (robot.metrics.totalBattles < 5) {
    recommendations.push({
      type: 'info',
      message: `Low battle activity (${robot.metrics.totalBattles} battles in last 7 days). Increase battles to maximize streaming revenue.`,
    });
  }

  return (
    <div className="bg-surface rounded-lg p-6 border-2 border-white/10 font-mono text-sm">
      {/* Header */}
      <div className="mb-4 pb-4 border-b border-gray-600">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-secondary text-xs">#{rank}</span>
              <h3 className="text-xl font-bold text-gray-100">{robot.name}</h3>
            </div>
            <div className="text-xs text-secondary mt-1">
              {robot.currentLeague.replace('_', ' ').toUpperCase()} | ELO: {robot.elo}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${netIncomeColor}`}>
              {isProfitable ? '+' : ''}{formatCurrency(robot.netIncome)}
            </div>
            <div className="text-xs text-secondary">Net Income</div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mb-4 p-3 bg-surface-elevated/50 rounded border-l-4 border-blue-500">
          <div className="text-xs font-semibold text-primary mb-2">💡 Recommendations</div>
          <ul className="space-y-1">
            {recommendations.map((rec, index) => (
              <li key={index} className="text-xs text-secondary flex items-start">
                <span className="mr-2">
                  {rec.type === 'error' && '⚠️'}
                  {rec.type === 'warning' && '⚡'}
                  {rec.type === 'success' && '✅'}
                  {rec.type === 'info' && 'ℹ️'}
                </span>
                <span>{rec.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Revenue Section */}
      <div className="mb-4">
        <h4 className="text-success font-semibold mb-2">REVENUE:</h4>
        <div className="ml-2 space-y-1">
          <div className="flex justify-between">
            <span className="text-secondary">Battle Winnings:</span>
            <span className="text-gray-100">{formatCurrency(robot.revenue.battleWinnings)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Merchandising:</span>
            <span className="text-gray-100">{formatCurrency(robot.revenue.merchandising)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Streaming:</span>
            <span className="text-gray-100">{formatCurrency(robot.revenue.streaming)}</span>
          </div>
          <div className="border-t border-gray-600 my-1"></div>
          <div className="flex justify-between font-bold">
            <span className="text-success">Robot Revenue:</span>
            <span className="text-success">{formatCurrency(robot.revenue.total)}</span>
          </div>
        </div>
      </div>

      {/* Costs Section */}
      <div className="mb-4">
        <h4 className="text-error font-semibold mb-2">COSTS:</h4>
        <div className="ml-2 space-y-1">
          <div className="flex justify-between">
            <span className="text-secondary">Repair Costs:</span>
            <span className="text-gray-100">{formatCurrency(robot.costs.repairs)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Allocated Facilities*:</span>
            <span className="text-gray-100">{formatCurrency(robot.costs.allocatedFacilities)}</span>
          </div>
          <div className="border-t border-gray-600 my-1"></div>
          <div className="flex justify-between font-bold">
            <span className="text-error">Robot Costs:</span>
            <span className="text-error">{formatCurrency(robot.costs.total)}</span>
          </div>
        </div>
      </div>

      {/* Battle Breakdown */}
      {robot.battles.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowBattles(!showBattles)}
            className="w-full text-left px-3 py-2 bg-surface-elevated hover:bg-gray-600 rounded transition-colors"
          >
            <div className="flex justify-between items-center">
              <span className="text-purple-400 font-semibold">
                📊 Battle Breakdown ({robot.battles.length} battles)
              </span>
              <span className="text-secondary">{showBattles ? '▼' : '▶'}</span>
            </div>
          </button>
          
          {showBattles && (
            <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
              {robot.battles.map((battle) => (
                <div
                  key={battle.id}
                  className="bg-surface-elevated/50 p-2 rounded text-xs border-l-2"
                  style={{
                    borderLeftColor: battle.isWinner ? '#10b981' : '#ef4444',
                  }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <span className={battle.isWinner ? 'text-success' : 'text-error'}>
                        {battle.isWinner ? '✓ WIN' : '✗ LOSS'}
                      </span>
                      <span className="text-secondary ml-2">
                        {battle.battleType === 'tournament' ? '🏆 Tournament' : '⚔️ League'}
                      </span>
                    </div>
                    <span className="text-tertiary">
                      {new Date(battle.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Earnings:</span>
                    <span className="text-success">{formatCurrency(battle.reward)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Repairs:</span>
                    <span className="text-error">{formatCurrency(battle.repairCost)}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-1 border-t border-gray-600 mt-1">
                    <span className="text-secondary">Net:</span>
                    <span className={battle.reward - battle.repairCost >= 0 ? 'text-success' : 'text-error'}>
                      {formatCurrency(battle.reward - battle.repairCost)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
            <span className="text-secondary">ROI:</span>
            <span className={robot.roi >= 0 ? 'text-success' : 'text-error'}>
              {robot.roi >= 0 ? '+' : ''}{robot.roi}%
            </span>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="pt-4 border-t border-gray-600">
        <h4 className="text-secondary text-xs font-semibold mb-2">PERFORMANCE METRICS:</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-tertiary">Win Rate:</div>
            <div className="text-gray-200 font-semibold">{robot.metrics.winRate}%</div>
          </div>
          <div>
            <div className="text-tertiary">Avg Earnings/Battle:</div>
            <div className="text-gray-200 font-semibold">{formatCurrency(robot.metrics.avgEarningsPerBattle)}</div>
          </div>
          <div>
            <div className="text-tertiary">Total Battles (7d):</div>
            <div className="text-gray-200 font-semibold">{robot.metrics.totalBattles}</div>
          </div>
          <div>
            <div className="text-tertiary">Fame:</div>
            <div className="text-gray-200 font-semibold">{robot.metrics.fameContribution.toLocaleString()}</div>
          </div>
          <div className="col-span-2">
            <div className="text-tertiary">Repair Cost %:</div>
            <div className={`font-semibold ${robot.metrics.repairCostPercentage > 50 ? 'text-error' : 'text-gray-200'}`}>
              {robot.metrics.repairCostPercentage}% of revenue
            </div>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="mt-4 pt-2 border-t border-white/10 text-xs text-tertiary italic">
        *Facilities costs split evenly across active robots
      </div>
    </div>
  );
}

export default RobotFinancialCard;
