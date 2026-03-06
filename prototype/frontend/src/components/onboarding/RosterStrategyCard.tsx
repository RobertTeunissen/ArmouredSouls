/**
 * RosterStrategyCard component
 * Displays a roster strategy option with characteristics, advantages, and disadvantages.
 * 
 * Features:
 * - Display strategy name, description, robot count
 * - Show battles per day, power level, complexity
 * - List advantages and disadvantages
 * - Display budget breakdown mini-chart
 * - Handle selection state (selected/unselected)
 * 
 * Requirements: 4.1-4.8, 8.1-8.9
 */

import { formatCurrency } from '../../utils/financialApi';

export type RosterStrategy = '1_mighty' | '2_average' | '3_flimsy';

interface RosterStrategyCardProps {
  strategy: RosterStrategy;
  selected: boolean;
  onSelect: (strategy: RosterStrategy) => void;
}

interface StrategyData {
  name: string;
  description: string;
  robotCount: number;
  battlesPerDay: string;
  powerLevel: string;
  complexity: string;
  facilityInvestment: string;
  riskProfile: string;
  advantages: string[];
  disadvantages: string[];
  budgetBreakdown: {
    facilities: { min: number; max: number };
    robots: { min: number; max: number };
    weapons: { min: number; max: number };
    attributes: { min: number; max: number };
    reserve: { min: number; max: number };
  };
  imagePath: string;
}

const STRATEGY_DATA: Record<RosterStrategy, StrategyData> = {
  '1_mighty': {
    name: '1 Mighty Robot',
    description: 'Maximum power concentration, simplest management',
    robotCount: 1,
    battlesPerDay: '~1.6',
    powerLevel: 'Highest',
    complexity: 'Simplest',
    facilityInvestment: 'Moderate',
    riskProfile: 'High risk if robot damaged',
    advantages: [
      'Maximum power concentration',
      'Simplest management',
      'Higher chance of winning battles',
      'Can reach highest attribute levels fastest',
    ],
    disadvantages: [
      'Single point of failure',
      'Fewer battles per day',
      'Limited strategic flexibility',
      'High repair costs if you LOSE a battle',
    ],
    budgetBreakdown: {
      facilities: { min: 350000, max: 350000 },
      robots: { min: 500000, max: 500000 },
      weapons: { min: 550000, max: 550000 },
      attributes: { min: 1550000, max: 1550000 },
      reserve: { min: 50000, max: 50000 },
    },
    imagePath: '/assets/onboarding/strategies/roster-1-mighty.webp',
  },
  '2_average': {
    name: '2 Average Robots',
    description: 'Balanced power and participation, moderate complexity',
    robotCount: 2,
    battlesPerDay: '~3.2',
    powerLevel: 'Moderate',
    complexity: 'Moderate',
    facilityInvestment: 'Moderate',
    riskProfile: 'Distributed risk',
    advantages: [
      'Balanced power and participation',
      'Risk distribution',
      'Moderate complexity',
      'Flexible strategies',
      'Unlocks Tag Team battles',
    ],
    disadvantages: [
      'Requires Roster Expansion facility',
      'Split attribute upgrade budget',
      'More weapon purchases needed',
      'Moderate facility investment',
      'Could mean MORE total repair costs if you lose more battles',
    ],
    budgetBreakdown: {
      facilities: { min: 350000, max: 350000 },
      robots: { min: 1000000, max: 1000000 },
      weapons: { min: 500000, max: 500000 },
      attributes: { min: 1100000, max: 1100000 },
      reserve: { min: 50000, max: 50000 },
    },
    imagePath: '/assets/onboarding/strategies/roster-2-average.webp',
  },
  '3_flimsy': {
    name: '3 Flimsy Robots',
    description: 'Maximum battle participation, highest complexity',
    robotCount: 3,
    battlesPerDay: '~4.8',
    powerLevel: 'Lowest',
    complexity: 'Most Complex',
    facilityInvestment: 'Highest',
    riskProfile: 'Distributed risk',
    advantages: [
      'Maximum battle participation',
      'Distributed risk',
      'Highest passive income potential',
      'Multiple strategic approaches',
      'Unlocks Tag Team battles',
    ],
    disadvantages: [
      'Highest facility investment (Roster Expansion Level 2)',
      'Lowest power per robot',
      'Most complex management',
      'Requires more weapons',
      'Could mean MORE total repair costs if you lose more battles',
    ],
    budgetBreakdown: {
      facilities: { min: 350000, max: 350000 },
      robots: { min: 1500000, max: 1500000 },
      weapons: { min: 450000, max: 450000 },
      attributes: { min: 650000, max: 650000 },
      reserve: { min: 50000, max: 50000 },
    },
    imagePath: '/assets/onboarding/strategies/roster-3-flimsy.webp',
  },
};

/**
 * BudgetBreakdownMini component
 * Displays a compact budget breakdown chart for a strategy.
 */
const BudgetBreakdownMini = ({ breakdown }: { breakdown: StrategyData['budgetBreakdown'] }) => {
  const categories = [
    { key: 'facilities', label: 'Facilities', color: 'bg-blue-500' },
    { key: 'robots', label: 'Robots', color: 'bg-green-500' },
    { key: 'weapons', label: 'Weapons', color: 'bg-red-500' },
    { key: 'attributes', label: 'Attributes', color: 'bg-yellow-500' },
    { key: 'reserve', label: 'Reserve', color: 'bg-gray-500' },
  ] as const;

  const total = 3000000;

  return (
    <div className="mt-4 pt-4 border-t border-gray-700">
      <h4 className="text-xs font-medium text-gray-400 mb-2">Budget Breakdown</h4>
      
      {/* Stacked bar chart */}
      <div className="h-6 flex rounded overflow-hidden mb-2">
        {categories.map(({ key, color }) => {
          const avg = (breakdown[key].min + breakdown[key].max) / 2;
          const percentage = (avg / total) * 100;
          
          return (
            <div
              key={key}
              className={`${color} transition-all duration-300`}
              style={{ width: `${percentage}%` }}
              title={`${key}: ${formatCurrency(avg)}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-1 text-xs">
        {categories.map(({ key, label, color }) => {
          const { min, max } = breakdown[key];
          const avg = (min + max) / 2;
          
          return (
            <div key={key} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${color}`} />
              <span className="text-gray-300 truncate">
                {label}: {formatCurrency(avg)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * RosterStrategyCard component
 * Main card component for displaying a roster strategy option.
 */
const RosterStrategyCard = ({ strategy, selected, onSelect }: RosterStrategyCardProps) => {
  const data = STRATEGY_DATA[strategy];

  return (
    <div
      className={`
        relative bg-surface rounded-lg border-2 transition-all duration-300 cursor-pointer
        hover:shadow-lg hover:scale-[1.02]
        ${selected 
          ? 'border-blue-500 ring-4 ring-blue-500 ring-opacity-30 shadow-xl' 
          : 'border-gray-700 hover:border-gray-600'
        }
      `}
      onClick={() => onSelect(strategy)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(strategy);
        }
      }}
      aria-pressed={selected}
      aria-label={`Select ${data.name} strategy`}
    >
      {/* Selected indicator */}
      {selected && (
        <div className="absolute top-3 right-3 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold z-10">
          SELECTED
        </div>
      )}

      <div className="p-6">
        {/* Header with image */}
        <div className="mb-4">
          <div className="aspect-[4/3] bg-gray-800 rounded-lg overflow-hidden mb-3">
            <img
              src={data.imagePath}
              alt={data.name}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                // Fallback if image doesn't exist
                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23374151" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239CA3AF" font-size="20"%3E' + data.robotCount + ' Robot' + (data.robotCount > 1 ? 's' : '') + '%3C/text%3E%3C/svg%3E';
              }}
            />
          </div>
          
          <h3 className="text-xl font-bold text-gray-100 mb-1">{data.name}</h3>
          <p className="text-sm text-gray-300">{data.description}</p>
        </div>

        {/* Key stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gray-800 bg-opacity-50 rounded">
          <div>
            <div className="text-xs text-gray-400">Battles/Day</div>
            <div className="text-sm font-medium text-gray-100">{data.battlesPerDay}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Power Level</div>
            <div className="text-sm font-medium text-gray-100">{data.powerLevel}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Complexity</div>
            <div className="text-sm font-medium text-gray-100">{data.complexity}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Facility Cost</div>
            <div className="text-sm font-medium text-gray-100">{data.facilityInvestment}</div>
          </div>
        </div>

        {/* Advantages */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Advantages
          </h4>
          <ul className="space-y-1">
            {data.advantages.map((advantage, index) => (
              <li key={index} className="text-xs text-gray-200 flex items-start gap-2">
                <span className="text-green-500 mt-0.5">•</span>
                <span>{advantage}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Disadvantages */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Disadvantages
          </h4>
          <ul className="space-y-1">
            {data.disadvantages.map((disadvantage, index) => (
              <li key={index} className="text-xs text-gray-200 flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>{disadvantage}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Budget breakdown */}
        <BudgetBreakdownMini breakdown={data.budgetBreakdown} />
      </div>
    </div>
  );
};

export default RosterStrategyCard;
export { STRATEGY_DATA };
export type { StrategyData };
