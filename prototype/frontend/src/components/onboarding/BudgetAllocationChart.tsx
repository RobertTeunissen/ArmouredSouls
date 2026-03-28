/**
 * BudgetAllocationChart Component
 * 
 * Visualizes recommended budget allocation for the player's chosen roster strategy.
 * Shows pie chart with credit distribution across categories and comparison table.
 * 
 * Requirements: 6.5, 19.1-19.9
 */

import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { formatCurrency } from '../../utils/financialApi';

interface BudgetAllocationChartProps {
  strategy: '1_mighty' | '2_average' | '3_flimsy';
  currentSpending?: {
    facilities: number;
    robots: number;
    weapons: number;
    attributes: number;
  };
}

interface BudgetCategory {
  min: number;
  max: number;
  color: string;
  label: string;
}

interface BudgetRecommendations {
  facilities: BudgetCategory;
  robots: BudgetCategory;
  weapons: BudgetCategory;
  attributes: BudgetCategory;
  reserve: BudgetCategory;
}

const STARTING_BUDGET = 3000000;

// Budget recommendations for each strategy
const BUDGET_RECOMMENDATIONS: Record<string, BudgetRecommendations> = {
  '1_mighty': {
    facilities: { min: 350000, max: 350000, color: '#3B82F6', label: 'Facilities' },
    robots: { min: 500000, max: 500000, color: '#10B981', label: 'Robots' },
    weapons: { min: 550000, max: 550000, color: '#EF4444', label: 'Weapons' },
    attributes: { min: 1550000, max: 1550000, color: '#F59E0B', label: 'Attributes' },
    reserve: { min: 50000, max: 50000, color: '#6B7280', label: 'Reserve' }
  },
  '2_average': {
    facilities: { min: 350000, max: 350000, color: '#3B82F6', label: 'Facilities' },
    robots: { min: 1000000, max: 1000000, color: '#10B981', label: 'Robots' },
    weapons: { min: 500000, max: 500000, color: '#EF4444', label: 'Weapons' },
    attributes: { min: 1100000, max: 1100000, color: '#F59E0B', label: 'Attributes' },
    reserve: { min: 50000, max: 50000, color: '#6B7280', label: 'Reserve' }
  },
  '3_flimsy': {
    facilities: { min: 350000, max: 350000, color: '#3B82F6', label: 'Facilities' },
    robots: { min: 1500000, max: 1500000, color: '#10B981', label: 'Robots' },
    weapons: { min: 450000, max: 450000, color: '#EF4444', label: 'Weapons' },
    attributes: { min: 650000, max: 650000, color: '#F59E0B', label: 'Attributes' },
    reserve: { min: 50000, max: 50000, color: '#6B7280', label: 'Reserve' }
  }
};

const BudgetAllocationChart: React.FC<BudgetAllocationChartProps> = ({
  strategy,
  currentSpending
}) => {
  const recommendations = BUDGET_RECOMMENDATIONS[strategy];

  // Calculate midpoint for pie chart display (memoized)
  const chartData = useMemo(() => Object.entries(recommendations).map(([_key, value]) => ({
    name: value.label,
    value: (value.min + value.max) / 2,
    color: value.color,
    min: value.min,
    max: value.max
  })), [recommendations]);

  // Calculate total current spending
  const totalSpent = useMemo(() => currentSpending
    ? Object.values(currentSpending).reduce((sum, val) => sum + val, 0)
    : 0, [currentSpending]);

  // Get status badge for a category
  const getStatusBadge = (spent: number, category: BudgetCategory): React.JSX.Element => {
    if (spent === 0) {
      return <span className="px-2 py-1 text-xs rounded bg-surface-elevated text-secondary">Not Started</span>;
    }
    
    if (spent < category.min) {
      return <span className="px-2 py-1 text-xs rounded bg-yellow-900 bg-opacity-30 text-warning border border-yellow-700">Under Budget</span>;
    }
    
    if (spent > category.max) {
      return <span className="px-2 py-1 text-xs rounded bg-red-900 bg-opacity-30 text-error border border-red-700">Over Budget</span>;
    }
    
    return <span className="px-2 py-1 text-xs rounded bg-green-900 bg-opacity-30 text-success border border-green-700">On Track</span>;
  };

  // Custom tooltip for pie chart
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; min: number; max: number; value: number } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-white/10 rounded p-3 shadow-lg">
          <p className="font-semibold text-white mb-1">{data.name}</p>
          <p className="text-sm text-secondary">
            Recommended: {formatCurrency(data.min)} - {formatCurrency(data.max)}
          </p>
          <p className="text-sm text-secondary mt-1">
            Average: {formatCurrency(data.value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="budget-allocation-chart space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-white mb-2">
          Recommended Budget Allocation
        </h3>
        <p className="text-sm text-secondary">
          These are guidelines to help you allocate your ₡3,000,000 starting budget. 
          You have flexibility to adjust based on your preferences.
        </p>
      </div>

      {/* Pie Chart */}
      <div className="bg-surface rounded-lg p-6">
        <h4 className="text-lg font-semibold text-white mb-4">Visual Breakdown</h4>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent, x, y }) => (
                <text x={x} y={y} fill="#D1D5DB" textAnchor="middle" dominantBaseline="central" fontSize={12}>
                  {`${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                </text>
              )}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value, _entry: unknown) => (
                <span className="text-secondary">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Budget Comparison Table */}
      {currentSpending && (
        <div className="bg-surface rounded-lg p-6">
          <h4 className="text-lg font-semibold text-white mb-4">Your Progress</h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-secondary">Category</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-secondary">Recommended</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-secondary">Your Spending</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-secondary">Status</th>
                </tr>
              </thead>
              <tbody>
                {(['facilities', 'robots', 'weapons', 'attributes', 'reserve'] as const).map((category, idx, arr) => {
                  const rec = recommendations[category];
                  const spent = category === 'reserve'
                    ? STARTING_BUDGET - totalSpent
                    : currentSpending[category];
                  const isLast = idx === arr.length - 1;
                  return (
                    <tr key={category} className={`${isLast ? '' : 'border-b border-white/10'} hover:bg-gray-750`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: rec.color }} />
                          <span className="text-white">{rec.label}</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 text-secondary">
                        {formatCurrency(rec.min)} - {formatCurrency(rec.max)}
                      </td>
                      <td className="text-right py-3 px-4 text-white font-medium">
                        {formatCurrency(spent)}
                      </td>
                      <td className="text-center py-3 px-4">
                        {getStatusBadge(spent, rec)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Budget Summary */}
      <div className="bg-surface rounded-lg p-6">
        <h4 className="text-lg font-semibold text-white mb-4">Budget Summary</h4>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-secondary">Starting Budget:</span>
            <span className="text-white font-semibold text-lg">{formatCurrency(STARTING_BUDGET)}</span>
          </div>
          
          {currentSpending && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-secondary">Total Spent:</span>
                <span className="text-orange-400 font-semibold text-lg">{formatCurrency(totalSpent)}</span>
              </div>
              
              <div className="flex justify-between items-center pt-3 border-t border-white/10">
                <span className="text-secondary font-medium">Remaining:</span>
                <span className={`font-bold text-xl ${
                  STARTING_BUDGET - totalSpent >= recommendations.reserve.min 
                    ? 'text-success' 
                    : STARTING_BUDGET - totalSpent >= 200000
                    ? 'text-warning'
                    : 'text-error'
                }`}>
                  {formatCurrency(STARTING_BUDGET - totalSpent)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Important Notes */}
      <div className="bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
        <h5 className="text-sm font-semibold text-primary mb-2">💡 Important Notes</h5>
        <ul className="text-sm text-blue-300 space-y-1 list-disc list-inside">
          <li>These are guidelines, not strict requirements</li>
          <li>Facility discounts compound over time - buy them early!</li>
          <li>Keep at least ₡50,000 reserve for repairs and operations</li>
          <li>Adjust based on your playstyle and preferences</li>
        </ul>
      </div>
    </div>
  );
};

export default BudgetAllocationChart;
