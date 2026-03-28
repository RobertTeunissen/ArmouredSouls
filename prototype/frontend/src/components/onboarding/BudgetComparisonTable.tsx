/**
 * BudgetComparisonTable Component
 * 
 * Displays a detailed comparison table showing recommended budget ranges
 * versus player's actual spending with status indicators.
 * 
 * Requirements: 6.5, 19.1-19.9
 */

import { formatCurrency } from '../../utils/financialApi';

interface BudgetCategory {
  min: number;
  max: number;
  color: string;
  label: string;
  description?: string;
}

interface BudgetComparisonTableProps {
  recommendations: {
    facilities: BudgetCategory;
    robots: BudgetCategory;
    weapons: BudgetCategory;
    attributes: BudgetCategory;
    reserve: BudgetCategory;
  };
  currentSpending?: {
    facilities: number;
    robots: number;
    weapons: number;
    attributes: number;
  };
  startingBudget?: number;
  /** When true, shows only recommendations without spending/status columns */
  referenceOnly?: boolean;
}

type StatusType = 'not_started' | 'under' | 'on_track' | 'over';

interface StatusConfig {
  label: string;
  className: string;
  icon: string;
}

const STATUS_CONFIGS: Record<StatusType, StatusConfig> = {
  not_started: {
    label: 'Not Started',
    className: 'bg-surface-elevated text-secondary',
    icon: '⏸️'
  },
  under: {
    label: 'Under Budget',
    className: 'bg-yellow-900 bg-opacity-30 text-warning border border-yellow-700',
    icon: '⚠️'
  },
  on_track: {
    label: 'On Track',
    className: 'bg-green-900 bg-opacity-30 text-success border border-green-700',
    icon: '✅'
  },
  over: {
    label: 'Over Budget',
    className: 'bg-red-900 bg-opacity-30 text-error border border-red-700',
    icon: '❌'
  }
};

const BudgetComparisonTable: React.FC<BudgetComparisonTableProps> = ({
  recommendations,
  currentSpending = { facilities: 0, robots: 0, weapons: 0, attributes: 0 },
  startingBudget = 3000000,
  referenceOnly = false
}) => {
  // Calculate total spent
  const totalSpent = Object.values(currentSpending).reduce((sum, val) => sum + val, 0);
  const remaining = startingBudget - totalSpent;

  // Check if we have any actual spending data
  const hasSpendingData = !referenceOnly && totalSpent > 0;

  // Determine status for a category
  const getStatus = (spent: number, category: BudgetCategory): StatusType => {
    if (spent === 0) return 'not_started';
    if (spent < category.min) return 'under';
    if (spent > category.max) return 'over';
    return 'on_track';
  };

  // Get status badge component
  const StatusBadge: React.FC<{ status: StatusType }> = ({ status }) => {
    const config = STATUS_CONFIGS[status];
    return (
      <span className={`px-2 py-1 text-xs rounded inline-flex items-center gap-1 ${config.className}`}>
        <span>{config.icon}</span>
        <span>{config.label}</span>
      </span>
    );
  };

  // Calculate percentage of recommended range
  const getPercentageOfRange = (spent: number, category: BudgetCategory): number => {
    if (spent === 0) return 0;
    const midpoint = (category.min + category.max) / 2;
    return (spent / midpoint) * 100;
  };

  return (
    <div className="budget-comparison-table">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-white/10">
              <th className="text-left py-3 px-4 text-sm font-semibold text-secondary">
                Category
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-secondary">
                Recommended Budget
              </th>
              {hasSpendingData && (
                <>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-secondary">
                    Your Spending
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-secondary">
                    % of Target
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-secondary">
                    Status
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {/* Facilities Row */}
            <tr className="border-b border-white/10 hover:bg-gray-750 transition-colors">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: recommendations.facilities.color }}
                  />
                  <div>
                    <div className="text-white font-medium">Facilities</div>
                    {recommendations.facilities.description && (
                      <div className="text-xs text-secondary">{recommendations.facilities.description}</div>
                    )}
                  </div>
                </div>
              </td>
              <td className="text-right py-3 px-4 text-white font-medium">
                {formatCurrency(recommendations.facilities.min)}
              </td>
              {hasSpendingData && (
                <>
                  <td className="text-right py-3 px-4 text-white font-medium">
                    {formatCurrency(currentSpending.facilities)}
                  </td>
                  <td className="text-right py-3 px-4 text-secondary text-sm">
                    {getPercentageOfRange(currentSpending.facilities, recommendations.facilities).toFixed(0)}%
                  </td>
                  <td className="text-center py-3 px-4">
                    <StatusBadge status={getStatus(currentSpending.facilities, recommendations.facilities)} />
                  </td>
                </>
              )}
            </tr>

            {/* Robots Row */}
            <tr className="border-b border-white/10 hover:bg-gray-750 transition-colors">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: recommendations.robots.color }}
                  />
                  <div>
                    <div className="text-white font-medium">Robots</div>
                    {recommendations.robots.description && (
                      <div className="text-xs text-secondary">{recommendations.robots.description}</div>
                    )}
                  </div>
                </div>
              </td>
              <td className="text-right py-3 px-4 text-white font-medium">
                {formatCurrency(recommendations.robots.min)}
              </td>
              {hasSpendingData && (
                <>
                  <td className="text-right py-3 px-4 text-white font-medium">
                    {formatCurrency(currentSpending.robots)}
                  </td>
                  <td className="text-right py-3 px-4 text-secondary text-sm">
                    {getPercentageOfRange(currentSpending.robots, recommendations.robots).toFixed(0)}%
                  </td>
                  <td className="text-center py-3 px-4">
                    <StatusBadge status={getStatus(currentSpending.robots, recommendations.robots)} />
                  </td>
                </>
              )}
            </tr>

            {/* Weapons Row */}
            <tr className="border-b border-white/10 hover:bg-gray-750 transition-colors">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: recommendations.weapons.color }}
                  />
                  <div>
                    <div className="text-white font-medium">Weapons</div>
                    {recommendations.weapons.description && (
                      <div className="text-xs text-secondary">{recommendations.weapons.description}</div>
                    )}
                  </div>
                </div>
              </td>
              <td className="text-right py-3 px-4 text-white font-medium">
                {formatCurrency(recommendations.weapons.min)}
              </td>
              {hasSpendingData && (
                <>
                  <td className="text-right py-3 px-4 text-white font-medium">
                    {formatCurrency(currentSpending.weapons)}
                  </td>
                  <td className="text-right py-3 px-4 text-secondary text-sm">
                    {getPercentageOfRange(currentSpending.weapons, recommendations.weapons).toFixed(0)}%
                  </td>
                  <td className="text-center py-3 px-4">
                    <StatusBadge status={getStatus(currentSpending.weapons, recommendations.weapons)} />
                  </td>
                </>
              )}
            </tr>

            {/* Attributes Row */}
            <tr className="border-b border-white/10 hover:bg-gray-750 transition-colors">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: recommendations.attributes.color }}
                  />
                  <div>
                    <div className="text-white font-medium">Attributes</div>
                    {recommendations.attributes.description && (
                      <div className="text-xs text-secondary">{recommendations.attributes.description}</div>
                    )}
                  </div>
                </div>
              </td>
              <td className="text-right py-3 px-4 text-white font-medium">
                {formatCurrency(recommendations.attributes.min)}
              </td>
              {hasSpendingData && (
                <>
                  <td className="text-right py-3 px-4 text-white font-medium">
                    {formatCurrency(currentSpending.attributes)}
                  </td>
                  <td className="text-right py-3 px-4 text-secondary text-sm">
                    {getPercentageOfRange(currentSpending.attributes, recommendations.attributes).toFixed(0)}%
                  </td>
                  <td className="text-center py-3 px-4">
                    <StatusBadge status={getStatus(currentSpending.attributes, recommendations.attributes)} />
                  </td>
                </>
              )}
            </tr>

            {/* Reserve Row */}
            <tr className="hover:bg-gray-750 transition-colors">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: recommendations.reserve.color }}
                  />
                  <div>
                    <div className="text-white font-medium">Reserve</div>
                    {recommendations.reserve.description && (
                      <div className="text-xs text-secondary">{recommendations.reserve.description}</div>
                    )}
                  </div>
                </div>
              </td>
              <td className="text-right py-3 px-4 text-white font-medium">
                {formatCurrency(recommendations.reserve.min)}
              </td>
              {hasSpendingData && (
                <>
                  <td className="text-right py-3 px-4 text-white font-medium">
                    {formatCurrency(remaining)}
                  </td>
                  <td className="text-right py-3 px-4 text-secondary text-sm">
                    {getPercentageOfRange(remaining, recommendations.reserve).toFixed(0)}%
                  </td>
                  <td className="text-center py-3 px-4">
                    <StatusBadge status={getStatus(remaining, recommendations.reserve)} />
                  </td>
                </>
              )}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend - only show when we have spending data */}
      {hasSpendingData && (
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-secondary">
          <div className="flex items-center gap-2">
            <span className="text-success">✅</span>
            <span>On Track: Within recommended range</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-warning">⚠️</span>
            <span>Under Budget: Below minimum recommendation</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-error">❌</span>
            <span>Over Budget: Exceeds maximum recommendation</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetComparisonTable;
