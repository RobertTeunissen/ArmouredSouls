/**
 * WeaponRecommendationCard component
 * Displays recommended starter weapons with costs, attribute bonuses,
 * loadout compatibility, and budget-appropriate options.
 * 
 * Features:
 * - Display recommended starter weapons (Laser Rifle, Machine Gun, Combat Knife)
 * - Show weapon costs and attribute bonuses
 * - Explain loadout type compatibility
 * - Highlight budget-appropriate options
 * 
 * Requirements: 10.1-10.14
 */

import { formatCurrency } from '../../utils/financialApi';
import type { LoadoutType } from './LoadoutDiagram';

interface WeaponRecommendation {
  name: string;
  cost: number;
  description: string;
  attributeBonuses: Record<string, number>;
  compatibleLoadouts: LoadoutType[];
  weaponType: 'energy' | 'ballistic' | 'melee' | 'shield';
  isStarter: boolean;
  budgetTier: 'budget' | 'standard' | 'premium';
  pros: string[];
  cons: string[];
}

interface WeaponRecommendationCardProps {
  weapon: WeaponRecommendation;
  recommended?: boolean;
  creditsAvailable?: number;
  selectedLoadout?: LoadoutType;
  onSelect?: (weapon: WeaponRecommendation) => void;
  compact?: boolean;
}

// Starter weapon recommendations
export const STARTER_WEAPONS: WeaponRecommendation[] = [
  {
    name: 'Combat Knife',
    cost: 100000,
    description: 'Budget-friendly melee weapon with high burst damage potential',
    attributeBonuses: {
      power: 5,
      control: 3,
      penetration: 4,
    },
    compatibleLoadouts: ['single', 'dual_wield'],
    weaponType: 'melee',
    isStarter: true,
    budgetTier: 'budget',
    pros: [
      'Most affordable starter weapon',
      'Good for tight budgets',
      'High burst damage',
      'Can be dual-wielded',
    ],
    cons: [
      'Lower overall stats than premium weapons',
      'Melee range limitations',
      'Not compatible with shields',
    ],
  },
  {
    name: 'Machine Gun',
    cost: 150000,
    description: 'Reliable ballistic weapon with consistent damage output',
    attributeBonuses: {
      power: 6,
      control: 5,
      attackSpeed: 4,
      penetration: 5,
    },
    compatibleLoadouts: ['single', 'weapon_shield', 'dual_wield'],
    weaponType: 'ballistic',
    isStarter: true,
    budgetTier: 'standard',
    pros: [
      'Affordable and reliable',
      'Balanced attribute bonuses',
      'Compatible with all loadouts',
      'Good all-around choice',
    ],
    cons: [
      'Not specialized for any particular strategy',
      'Mid-tier damage output',
    ],
  },
  {
    name: 'Laser Rifle',
    cost: 244000,
    description: 'Precise energy weapon with consistent damage and excellent attribute bonuses',
    attributeBonuses: {
      power: 8,
      control: 7,
      gyro: 6,
      penetration: 7,
      criticalHit: 5,
    },
    compatibleLoadouts: ['single', 'weapon_shield', 'two_handed'],
    weaponType: 'energy',
    isStarter: true,
    budgetTier: 'standard',
    pros: [
      'Excellent attribute bonuses',
      'Precise and consistent damage',
      'Good for most strategies',
      'Compatible with shields',
    ],
    cons: [
      'Higher cost than budget options',
      'Cannot be dual-wielded',
    ],
  },
];

// Weapon type icons
const WEAPON_TYPE_ICONS: Record<string, string> = {
  energy: '⚡',
  ballistic: '🔫',
  melee: '⚔️',
  shield: '🛡️',
};

// Loadout compatibility display
const LOADOUT_NAMES: Record<LoadoutType, string> = {
  single: 'Single',
  weapon_shield: 'Weapon+Shield',
  two_handed: 'Two-Handed',
  dual_wield: 'Dual-Wield',
};

/**
 * AttributeBonusDisplay component
 * Shows weapon attribute bonuses in a compact format.
 */
const AttributeBonusDisplay = ({ bonuses }: { bonuses: Record<string, number> }) => {
  return (
    <div className="space-y-1">
      {Object.entries(bonuses).map(([attr, value]) => (
        <div key={attr} className="flex justify-between text-xs">
          <span className="text-gray-400 capitalize">
            {attr.replace(/([A-Z])/g, ' $1').trim()}:
          </span>
          <span className="text-green-400 font-medium">+{value}</span>
        </div>
      ))}
    </div>
  );
};

/**
 * LoadoutCompatibilityBadge component
 * Shows which loadout types are compatible with this weapon.
 */
const LoadoutCompatibilityBadge = ({ 
  compatibleLoadouts, 
  selectedLoadout 
}: { 
  compatibleLoadouts: LoadoutType[]; 
  selectedLoadout?: LoadoutType;
}) => {
  const isCompatible = selectedLoadout ? compatibleLoadouts.includes(selectedLoadout) : true;
  
  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-400">Compatible Loadouts:</div>
      <div className="flex flex-wrap gap-1">
        {compatibleLoadouts.map((loadout) => {
          const isSelected = loadout === selectedLoadout;
          return (
            <span
              key={loadout}
              className={`
                text-xs px-2 py-0.5 rounded-full
                ${isSelected 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-700 text-gray-300'
                }
              `}
            >
              {LOADOUT_NAMES[loadout]}
            </span>
          );
        })}
      </div>
      {selectedLoadout && !isCompatible && (
        <div className="text-xs text-red-400 mt-1">
          ⚠️ Not compatible with your selected loadout
        </div>
      )}
    </div>
  );
};

/**
 * BudgetIndicator component
 * Shows if weapon is within budget.
 */
const BudgetIndicator = ({ 
  cost, 
  creditsAvailable 
}: { 
  cost: number; 
  creditsAvailable?: number;
}) => {
  if (!creditsAvailable) return null;
  
  const canAfford = creditsAvailable >= cost;
  const percentOfBudget = (cost / creditsAvailable) * 100;
  
  return (
    <div className={`text-xs ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
      {canAfford ? (
        <>
          ✓ Within budget ({percentOfBudget.toFixed(0)}% of available credits)
        </>
      ) : (
        <>
          ✗ Insufficient credits (need {formatCurrency(cost - creditsAvailable)} more)
        </>
      )}
    </div>
  );
};

/**
 * WeaponRecommendationCard component
 * Main card component for displaying weapon recommendations.
 */
const WeaponRecommendationCard = ({
  weapon,
  recommended = false,
  creditsAvailable,
  selectedLoadout,
  onSelect,
  compact = false,
}: WeaponRecommendationCardProps) => {
  const icon = WEAPON_TYPE_ICONS[weapon.weaponType] || '⚔️';
  const canAfford = !creditsAvailable || creditsAvailable >= weapon.cost;
  const isCompatible = !selectedLoadout || weapon.compatibleLoadouts.includes(selectedLoadout);
  
  // Budget tier colors
  const tierColors = {
    budget: 'border-green-600 bg-green-900 bg-opacity-20',
    standard: 'border-blue-600 bg-blue-900 bg-opacity-20',
    premium: 'border-purple-600 bg-purple-900 bg-opacity-20',
  };

  const tierLabels = {
    budget: 'Budget Option',
    standard: 'Standard',
    premium: 'Premium',
  };

  if (compact) {
    return (
      <div
        className={`
          relative bg-surface rounded-lg border-2 p-4 transition-all duration-200
          ${recommended ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-30' : 'border-gray-700'}
          ${!canAfford ? 'opacity-60' : ''}
          ${!isCompatible ? 'opacity-50' : ''}
          ${onSelect ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]' : ''}
        `}
        onClick={() => onSelect?.(weapon)}
      >
        {recommended && (
          <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">
            RECOMMENDED
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="text-3xl">{icon}</div>
          <div className="flex-1">
            <h4 className="font-bold text-base mb-1">{weapon.name}</h4>
            <div className="text-sm font-semibold text-blue-400 mb-2">
              {formatCurrency(weapon.cost)}
            </div>
            <p className="text-xs text-gray-400 mb-2">{weapon.description}</p>
            
            <BudgetIndicator cost={weapon.cost} creditsAvailable={creditsAvailable} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        relative bg-surface rounded-lg border-2 p-6 transition-all duration-200
        ${recommended ? 'border-blue-500 ring-4 ring-blue-500 ring-opacity-30 shadow-xl' : 'border-gray-700'}
        ${!canAfford ? 'opacity-70' : ''}
        ${!isCompatible ? 'opacity-60' : ''}
        ${onSelect ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]' : ''}
      `}
      onClick={() => canAfford && isCompatible && onSelect?.(weapon)}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={`${weapon.name} - ${formatCurrency(weapon.cost)}`}
    >
      {/* Recommended badge */}
      {recommended && (
        <div className="absolute top-3 right-3 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold z-10">
          RECOMMENDED
        </div>
      )}

      {/* Budget tier badge */}
      <div className={`absolute top-3 left-3 px-2 py-1 rounded text-xs font-semibold ${tierColors[weapon.budgetTier]}`}>
        {tierLabels[weapon.budgetTier]}
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-4 mt-6">
        <div className="text-5xl">{icon}</div>
        <div className="flex-1">
          <h3 className="text-xl font-bold mb-1">{weapon.name}</h3>
          <div className="text-lg font-semibold text-blue-400">
            {formatCurrency(weapon.cost)}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-300 mb-4">{weapon.description}</p>

      {/* Budget indicator */}
      <div className="mb-4">
        <BudgetIndicator cost={weapon.cost} creditsAvailable={creditsAvailable} />
      </div>

      {/* Attribute bonuses */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          Attribute Bonuses
        </h4>
        <div className="p-3 bg-gray-800 bg-opacity-50 rounded-lg">
          <AttributeBonusDisplay bonuses={weapon.attributeBonuses} />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          These bonuses stack with your robot's base attributes.
        </p>
      </div>

      {/* Loadout compatibility */}
      <div className="mb-4">
        <LoadoutCompatibilityBadge 
          compatibleLoadouts={weapon.compatibleLoadouts}
          selectedLoadout={selectedLoadout}
        />
      </div>

      {/* Pros and cons */}
      <div className="grid grid-cols-2 gap-4">
        {/* Pros */}
        <div>
          <h4 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Pros
          </h4>
          <ul className="space-y-1">
            {weapon.pros.map((pro, index) => (
              <li key={index} className="text-xs text-gray-300 flex items-start gap-2">
                <span className="text-green-500 mt-0.5">•</span>
                <span>{pro}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Cons */}
        <div>
          <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Cons
          </h4>
          <ul className="space-y-1">
            {weapon.cons.map((con, index) => (
              <li key={index} className="text-xs text-gray-300 flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>{con}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action hint */}
      {onSelect && canAfford && isCompatible && (
        <div className="mt-4 pt-4 border-t border-gray-700 text-center">
          <p className="text-xs text-gray-400">Click to select this weapon</p>
        </div>
      )}

      {/* Incompatibility warning */}
      {!isCompatible && (
        <div className="mt-4 p-3 bg-red-900 bg-opacity-20 border border-red-700 rounded-lg">
          <p className="text-xs text-red-400">
            ⚠️ This weapon is not compatible with your selected {LOADOUT_NAMES[selectedLoadout!]} loadout.
          </p>
        </div>
      )}
    </div>
  );
};

export default WeaponRecommendationCard;
export type { WeaponRecommendation };
