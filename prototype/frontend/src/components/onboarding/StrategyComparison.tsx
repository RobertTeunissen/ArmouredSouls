/**
 * StrategyComparison component
 * Displays side-by-side comparison of all three roster strategies.
 * 
 * Features:
 * - Display all 3 strategies side-by-side
 * - Show comparison table with key metrics
 * - Highlight differences between strategies
 * 
 * Requirements: 8.1-8.9
 */

import { RosterStrategy, STRATEGY_DATA, StrategyData } from './RosterStrategyCard';
import { formatCurrency } from '../../utils/financialApi';

interface StrategyComparisonProps {
  selectedStrategy?: RosterStrategy;
  onSelectStrategy?: (strategy: RosterStrategy) => void;
}

interface ComparisonMetric {
  label: string;
  getValue: (data: StrategyData) => string | number;
  description?: string;
  highlight?: boolean;
}

const COMPARISON_METRICS: ComparisonMetric[] = [
  {
    label: 'Robot Count',
    getValue: (data) => data.robotCount,
    description: 'Number of robots in your roster',
    highlight: true,
  },
  {
    label: 'Battles Per Day',
    getValue: (data) => data.battlesPerDay,
    description: 'Average number of battles your robots participate in daily',
    highlight: true,
  },
  {
    label: 'Power Level',
    getValue: (data) => data.powerLevel,
    description: 'Individual robot power concentration',
  },
  {
    label: 'Complexity',
    getValue: (data) => data.complexity,
    description: 'Management complexity and strategic depth',
  },
  {
    label: 'Facility Investment',
    getValue: (data) => data.facilityInvestment,
    description: 'Required facility spending',
  },
  {
    label: 'Risk Profile',
    getValue: (data) => data.riskProfile,
    description: 'Risk distribution across your roster',
  },
];

/**
 * ComparisonTable component
 * Displays a detailed comparison table of key metrics.
 */
const ComparisonTable = ({ selectedStrategy }: { selectedStrategy?: RosterStrategy }) => {
  const strategies: RosterStrategy[] = ['1_mighty', '2_average', '3_flimsy'];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-700">
            <th className="text-left p-3 text-sm font-semibold text-gray-400">Metric</th>
            {strategies.map((strategy) => {
              const data = STRATEGY_DATA[strategy];
              const isSelected = selectedStrategy === strategy;
              
              return (
                <th
                  key={strategy}
                  className={`p-3 text-sm font-semibold text-center transition-colors ${
                    isSelected ? 'bg-blue-900 bg-opacity-30 text-blue-400' : 'text-gray-300'
                  }`}
                >
                  {data.name}
                  {isSelected && (
                    <div className="text-xs font-normal text-blue-400 mt-1">SELECTED</div>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_METRICS.map((metric) => (
            <tr
              key={metric.label}
              className={`border-b border-gray-800 ${
                metric.highlight ? 'bg-gray-800 bg-opacity-30' : ''
              }`}
            >
              <td className="p-3">
                <div className="text-sm font-medium">{metric.label}</div>
                {metric.description && (
                  <div className="text-xs text-gray-400 mt-1">{metric.description}</div>
                )}
              </td>
              {strategies.map((strategy) => {
                const data = STRATEGY_DATA[strategy];
                const value = metric.getValue(data);
                const isSelected = selectedStrategy === strategy;
                
                return (
                  <td
                    key={strategy}
                    className={`p-3 text-center text-sm transition-colors ${
                      isSelected ? 'bg-blue-900 bg-opacity-20 font-semibold' : ''
                    }`}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * BudgetComparisonChart component
 * Visual comparison of budget allocations across strategies.
 */
const BudgetComparisonChart = ({ selectedStrategy }: { selectedStrategy?: RosterStrategy }) => {
  const strategies: RosterStrategy[] = ['1_mighty', '2_average', '3_flimsy'];
  const categories = [
    { key: 'facilities', label: 'Facilities', color: 'bg-blue-500' },
    { key: 'robots', label: 'Robots', color: 'bg-green-500' },
    { key: 'weapons', label: 'Weapons', color: 'bg-red-500' },
    { key: 'attributes', label: 'Attributes', color: 'bg-yellow-500' },
    { key: 'reserve', label: 'Reserve', color: 'bg-gray-500' },
  ] as const;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold mb-4">Budget Allocation Comparison</h3>
      
      {strategies.map((strategy) => {
        const data = STRATEGY_DATA[strategy];
        const isSelected = selectedStrategy === strategy;
        const total = 3000000;

        return (
          <div
            key={strategy}
            className={`p-4 rounded-lg border transition-all ${
              isSelected
                ? 'border-blue-500 bg-blue-900 bg-opacity-20'
                : 'border-gray-700 bg-gray-800 bg-opacity-30'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-100">{data.name}</h4>
              {isSelected && (
                <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">
                  SELECTED
                </span>
              )}
            </div>

            {/* Stacked bar */}
            <div className="h-8 flex rounded overflow-hidden mb-3">
              {categories.map(({ key, color }) => {
                const avg = (data.budgetBreakdown[key].min + data.budgetBreakdown[key].max) / 2;
                const percentage = (avg / total) * 100;
                
                return (
                  <div
                    key={key}
                    className={`${color} transition-all duration-300 flex items-center justify-center`}
                    style={{ width: `${percentage}%` }}
                    title={`${key}: ${formatCurrency(avg)}`}
                  >
                    {percentage > 10 && (
                      <span className="text-xs font-bold text-white">
                        {Math.round(percentage)}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Category breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              {categories.map(({ key, label, color }) => {
                const { min, max } = data.budgetBreakdown[key];
                const avg = (min + max) / 2;
                
                return (
                  <div key={key} className="flex flex-col">
                    <div className="flex items-center gap-1 mb-1">
                      <div className={`w-2 h-2 rounded-full ${color}`} />
                      <span className="text-gray-400">{label}</span>
                    </div>
                    <div className="font-medium">{formatCurrency(avg)}</div>
                    <div className="text-gray-500">
                      {formatCurrency(min)}-{formatCurrency(max)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * TradeoffsComparison component
 * Highlights key trade-offs between strategies.
 */
const TradeoffsComparison = () => {
  const tradeoffs = [
    {
      title: 'Power vs Participation',
      description: 'More robots = more battles but less power per robot',
      comparison: [
        { strategy: '1_mighty', value: 'Highest power, ~2.2 battles/day' },
        { strategy: '2_average', value: 'Moderate power, ~3.6 battles/day' },
        { strategy: '3_flimsy', value: 'Lowest power, ~5 battles/day' },
      ],
    },
    {
      title: 'Simplicity vs Flexibility',
      description: 'Fewer robots = simpler management but less strategic options',
      comparison: [
        { strategy: '1_mighty', value: 'Simplest, limited flexibility' },
        { strategy: '2_average', value: 'Moderate complexity, balanced flexibility' },
        { strategy: '3_flimsy', value: 'Most complex, maximum flexibility' },
      ],
    },
    {
      title: 'Risk Distribution',
      description: 'More robots = distributed risk but potentially more total repair costs',
      comparison: [
        { strategy: '1_mighty', value: 'Single point of failure, high risk if damaged' },
        { strategy: '2_average', value: 'Risk spread across 2 robots' },
        { strategy: '3_flimsy', value: 'Risk spread across 3 robots' },
      ],
    },
    {
      title: 'Facility Investment',
      description: 'More robots require more facilities (Roster Expansion, Storage)',
      comparison: [
        { strategy: '1_mighty', value: '₡400K-₡600K (lowest)' },
        { strategy: '2_average', value: '₡600K-₡800K (moderate)' },
        { strategy: '3_flimsy', value: '₡700K-₡900K (highest)' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-100">Key Trade-offs</h3>
      
      {tradeoffs.map((tradeoff, index) => (
        <div key={index} className="bg-gray-800 bg-opacity-30 rounded-lg p-4">
          <h4 className="font-semibold mb-1 text-gray-100">{tradeoff.title}</h4>
          <p className="text-sm text-gray-400 mb-3">{tradeoff.description}</p>
          
          <div className="space-y-2">
            {tradeoff.comparison.map((item, idx) => {
              const data = STRATEGY_DATA[item.strategy as RosterStrategy];
              return (
                <div key={idx} className="flex items-start gap-3 text-sm">
                  <div className="w-32 flex-shrink-0 font-medium text-gray-300">
                    {data.name}:
                  </div>
                  <div className="text-gray-400">{item.value}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * RecommendationGuide component
 * Provides personalized recommendations based on player preferences.
 */
const RecommendationGuide = () => {
  const recommendations = [
    {
      preference: 'Prefer simplicity and power?',
      strategy: '1_mighty' as RosterStrategy,
      reason: 'Focus all resources on one powerful robot. Easiest to manage.',
    },
    {
      preference: 'Want balance and flexibility?',
      strategy: '2_average' as RosterStrategy,
      reason: 'Best of both worlds. Unlocks Tag Team battles.',
    },
    {
      preference: 'Enjoy complexity and participation?',
      strategy: '3_flimsy' as RosterStrategy,
      reason: 'Maximum battles and strategic depth. Highest income potential.',
    },
  ];

  return (
    <div className="bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4 text-blue-400">Which Strategy is Right for You?</h3>
      
      <div className="space-y-4">
        {recommendations.map((rec, index) => {
          const data = STRATEGY_DATA[rec.strategy];
          return (
            <div key={index} className="flex items-start gap-3">
              <div className="text-blue-400 text-xl">→</div>
              <div>
                <div className="font-semibold mb-1">{rec.preference}</div>
                <div className="text-sm text-gray-300">
                  <span className="text-blue-400 font-medium">{data.name}</span> - {rec.reason}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-blue-800 text-sm text-gray-400">
        <strong>Remember:</strong> You can reset your account later if you want to try a different strategy.
        All strategies are viable - choose what sounds most fun to you!
      </div>
    </div>
  );
};

/**
 * StrategyComparison component
 * Main component that orchestrates the comparison view.
 */
const StrategyComparison = ({ selectedStrategy, onSelectStrategy }: StrategyComparisonProps) => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Compare Roster Strategies</h2>
        <p className="text-gray-400">
          Understand the trade-offs between different approaches to help you make an informed decision.
        </p>
      </div>

      {/* Comparison Table */}
      <div className="bg-surface rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4">Strategy Comparison</h3>
        <ComparisonTable selectedStrategy={selectedStrategy} />
      </div>

      {/* Budget Comparison */}
      <div className="bg-surface rounded-lg border border-gray-700 p-6">
        <BudgetComparisonChart selectedStrategy={selectedStrategy} />
      </div>

      {/* Trade-offs */}
      <div className="bg-surface rounded-lg border border-gray-700 p-6">
        <TradeoffsComparison />
      </div>

      {/* Recommendations */}
      <RecommendationGuide />

      {/* Action buttons (if callback provided) */}
      {onSelectStrategy && (
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {(['1_mighty', '2_average', '3_flimsy'] as RosterStrategy[]).map((strategy) => {
            const data = STRATEGY_DATA[strategy];
            const isSelected = selectedStrategy === strategy;
            
            return (
              <button
                key={strategy}
                onClick={() => onSelectStrategy(strategy)}
                className={`
                  px-6 py-3 rounded-lg font-semibold transition-all
                  ${isSelected
                    ? 'bg-blue-600 hover:bg-blue-500 text-white ring-4 ring-blue-500 ring-opacity-30'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }
                `}
              >
                {isSelected ? '✓ ' : ''}Select {data.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StrategyComparison;
