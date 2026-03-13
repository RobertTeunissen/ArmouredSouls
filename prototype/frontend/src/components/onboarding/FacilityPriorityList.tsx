/**
 * FacilityPriorityList Component
 * 
 * Displays facilities in priority order for the chosen roster strategy.
 * Shows facility icons, costs, benefits, ROI calculations, and highlights
 * mandatory vs optional facilities.
 * 
 * Requirements: 5.1-5.14, 18.1-18.9
 */

import React, { memo } from 'react';
import FacilityIcon from '../FacilityIcon';

export type RosterStrategy = '1_mighty' | '2_average' | '3_flimsy';

export type FacilityPriority = 'mandatory' | 'recommended' | 'optional';

export interface FacilityInfo {
  type: string;
  name: string;
  priority: FacilityPriority;
  cost: number;
  level?: number;
  operatingCost?: number;
  benefit: string;
  savingsExample?: string;
  roiDays?: number;
  reason: string;
}

interface FacilityPriorityListProps {
  strategy: RosterStrategy;
  className?: string;
}

/**
 * Get facility recommendations based on roster strategy
 */
const getFacilityRecommendations = (strategy: RosterStrategy): FacilityInfo[] => {
  const baseRecommendations: FacilityInfo[] = [];

  // Strategy-specific mandatory facilities (Roster Expansion ONLY)
  if (strategy === '2_average') {
    baseRecommendations.push({
      type: 'roster_expansion',
      name: 'Roster Expansion',
      priority: 'mandatory',
      cost: 150000,
      level: 1,
      operatingCost: 0,
      benefit: 'Allows creating 2nd robot',
      reason: 'REQUIRED before creating your 2nd robot. Cannot proceed without this.',
    });
  } else if (strategy === '3_flimsy') {
    baseRecommendations.push({
      type: 'roster_expansion',
      name: 'Roster Expansion',
      priority: 'mandatory',
      cost: 450000,
      level: 2,
      operatingCost: 0,
      benefit: 'Allows creating 2nd and 3rd robots',
      reason: 'REQUIRED before creating your 2nd and 3rd robots. Level 2 needed for 3 robots.',
    });
  }

  // Recommended facilities for all strategies
  baseRecommendations.push(
    {
      type: 'weapons_workshop',
      name: 'Weapons Workshop',
      priority: 'recommended',
      cost: 125000,
      level: 1,
      operatingCost: 1000,
      benefit: '5% discount on weapon purchases (Level 1)',
      savingsExample: 'Save ₡14K on a ₡275K weapon',
      reason: 'Purchase BEFORE buying weapons to maximize savings. Saves 5% per level. Can upgrade to higher levels later.',
    },
    {
      type: 'training_facility',
      name: 'Training Facility',
      priority: 'recommended',
      cost: 150000,
      level: 1,
      operatingCost: 250,
      benefit: '10% discount on attribute upgrades (Level 1)',
      savingsExample: 'Save ₡37K when upgrading all 23 attributes from Level 1→10',
      reason: 'Purchase BEFORE upgrading attributes. Savings compound over time. Saves 10% per level. Can upgrade to higher levels later.',
    },
    {
      type: 'repair_bay',
      name: 'Repair Bay',
      priority: 'recommended',
      cost: 100000,
      level: 1,
      operatingCost: 1000,
      benefit: 'Reduces repair costs based on active robots',
      savingsExample: 'Save ₡5K-₡50K per repair depending on damage',
      reason: 'Reduces ongoing repair costs. More valuable if you lose battles frequently.',
    }
  );

  // Optional facilities for all strategies
  baseRecommendations.push(
    {
      type: 'combat_training_academy',
      name: 'Combat Training Academy',
      priority: 'optional',
      cost: 100000,
      level: 1,
      operatingCost: 0,
      benefit: 'Offensive bonuses for combat attributes',
      reason: 'Good for offensive strategies. Choose based on which attributes you want to focus on.',
    },
    {
      type: 'defense_training_academy',
      name: 'Defense Training Academy',
      priority: 'optional',
      cost: 100000,
      level: 1,
      operatingCost: 0,
      benefit: 'Defensive bonuses for armor and shields',
      reason: 'Good for weapon+shield loadouts and defensive strategies.',
    },
    {
      type: 'mobility_training_academy',
      name: 'Mobility Training Academy',
      priority: 'optional',
      cost: 100000,
      level: 1,
      operatingCost: 0,
      benefit: 'Speed and evasion bonuses',
      reason: 'Good for fast, agile robot builds.',
    },
    {
      type: 'merchandising_hub',
      name: 'Merchandising Hub',
      priority: 'optional',
      cost: 150000,
      level: 1,
      operatingCost: 0,
      benefit: 'Passive income that scales with prestige',
      reason: 'Generates credits over time. Income increases as you gain prestige.',
    },
    {
      type: 'streaming_studio',
      name: 'Streaming Studio',
      priority: 'optional',
      cost: 100000,
      level: 1,
      operatingCost: 100,
      benefit: 'Doubles streaming revenue per battle',
      reason: 'Income scales with battle participation. Better for multi-robot strategies.',
    },
    {
      type: 'storage_facility',
      name: 'Storage Facility',
      priority: 'optional',
      cost: 75000,
      level: 1,
      operatingCost: 0,
      benefit: 'Increases weapon storage capacity (+5 per level)',
      reason: 'Useful if you want to own many weapons. Consider if you plan to experiment with different loadouts.',
    }
  );

  return baseRecommendations;
};

/**
 * Get priority badge styling
 */
const getPriorityBadge = (priority: FacilityPriority): { label: string; className: string } => {
  switch (priority) {
    case 'mandatory':
      return {
        label: 'MANDATORY',
        className: 'bg-red-900/30 text-red-400 border-red-700',
      };
    case 'recommended':
      return {
        label: 'RECOMMENDED',
        className: 'bg-blue-900/30 text-blue-400 border-blue-700',
      };
    case 'optional':
      return {
        label: 'OPTIONAL',
        className: 'bg-gray-700/30 text-gray-400 border-gray-600',
      };
  }
};

/**
 * Format currency
 */
const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `₡${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `₡${(amount / 1000).toFixed(0)}K`;
  }
  return `₡${amount}`;
};

const FacilityPriorityList: React.FC<FacilityPriorityListProps> = memo(({ strategy, className = '' }) => {
  const facilities = getFacilityRecommendations(strategy);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="text-yellow-400 font-semibold mb-1">
              You Can Spend Your Money Only Once
            </h3>
            <p className="text-yellow-200 text-sm">
              Facility order matters! Purchase discount facilities (Weapons Workshop, Training Facility) 
              BEFORE buying weapons or upgrading attributes to maximize your savings.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {facilities.map((facility, index) => {
          const priorityBadge = getPriorityBadge(facility.priority);

          return (
            <div
              key={facility.type}
              className={`bg-gray-800 border rounded-lg p-4 transition-all hover:border-gray-600 ${
                facility.priority === 'mandatory'
                  ? 'border-red-700/50'
                  : facility.priority === 'recommended'
                  ? 'border-blue-700/50'
                  : 'border-gray-700'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Priority Number */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center font-bold text-gray-300">
                  {index + 1}
                </div>

                {/* Facility Icon */}
                <div className="flex-shrink-0">
                  <FacilityIcon facilityType={facility.type} facilityName={facility.name} size="medium" />
                </div>

                {/* Facility Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-100">{facility.name}</h3>
                      {facility.level && (
                        <p className="text-sm text-gray-400">Recommended Level: {facility.level}</p>
                      )}
                      {facility.operatingCost !== undefined && facility.operatingCost > 0 && (
                        <p className="text-xs text-orange-400">Operating Cost: {formatCurrency(facility.operatingCost)}/day</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${priorityBadge.className}`}
                      >
                        {priorityBadge.label}
                      </span>
                      <span className="text-lg font-bold text-yellow-400">{formatCurrency(facility.cost)}</span>
                    </div>
                  </div>

                  {/* Benefit */}
                  <div className="mb-2">
                    <p className="text-sm text-green-400 font-medium">✓ {facility.benefit}</p>
                  </div>

                  {/* Savings Example */}
                  {facility.savingsExample && (
                    <div className="mb-2 bg-green-900/20 border border-green-700/50 rounded px-3 py-2">
                      <p className="text-sm text-green-300">
                        <span className="font-semibold">Example:</span> {facility.savingsExample}
                      </p>
                    </div>
                  )}

                  {/* ROI */}
                  {facility.roiDays && (
                    <div className="mb-2">
                      <p className="text-xs text-blue-400">
                        ⏱️ Break-even: ~{facility.roiDays} days
                      </p>
                    </div>
                  )}

                  {/* Reason */}
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <p className="text-sm text-gray-300">{facility.reason}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="bg-gray-750 border border-gray-700 rounded-lg p-4 mt-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-3">Priority Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-red-400 font-semibold">MANDATORY:</span>
            <span className="text-gray-300">
              Must purchase before proceeding. Required for your strategy.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-400 font-semibold">RECOMMENDED:</span>
            <span className="text-gray-300">
              Strongly advised for your strategy. High value for investment.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-gray-400 font-semibold">OPTIONAL:</span>
            <span className="text-gray-300">
              Consider based on playstyle and remaining budget.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

FacilityPriorityList.displayName = 'FacilityPriorityList';

export default FacilityPriorityList;
