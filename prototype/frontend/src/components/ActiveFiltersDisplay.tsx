import React from 'react';
import { WeaponFilters } from './FilterPanel';

interface ActiveFiltersDisplayProps {
  filters: WeaponFilters;
  onRemoveFilter: (filterType: string, value?: string) => void;
}

const ActiveFiltersDisplay: React.FC<ActiveFiltersDisplayProps> = ({
  filters,
  onRemoveFilter,
}) => {
  const hasActiveFilters = 
    filters.loadoutTypes.length > 0 ||
    filters.weaponTypes.length > 0 ||
    filters.priceRange !== null ||
    filters.canAffordOnly;

  if (!hasActiveFilters) {
    return null;
  }

  const formatLoadoutType = (type: string): string => {
    const labels: { [key: string]: string } = {
      'single': 'Single',
      'weapon_shield': 'Weapon + Shield',
      'two_handed': 'Two-Handed',
      'dual_wield': 'Dual Wield',
    };
    return labels[type] || type;
  };

  const formatWeaponType = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const formatPriceRange = (range: { min: number; max: number }): string => {
    if (range.max === Infinity) {
      return `₡${(range.min / 1000).toFixed(0)}K+`;
    }
    return `₡${(range.min / 1000).toFixed(0)}K-₡${(range.max / 1000).toFixed(0)}K`;
  };

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {/* Loadout Type Chips */}
      {filters.loadoutTypes.map(type => (
        <div
          key={`loadout-${type}`}
          className="flex items-center gap-1.5 bg-blue-900 text-blue-200 px-3 py-1.5 rounded-full text-sm"
        >
          <span>{formatLoadoutType(type)}</span>
          <button
            onClick={() => onRemoveFilter('loadoutType', type)}
            className="hover:text-white transition-colors"
            aria-label={`Remove ${formatLoadoutType(type)} filter`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {/* Weapon Type Chips */}
      {filters.weaponTypes.map(type => (
        <div
          key={`weapon-${type}`}
          className="flex items-center gap-1.5 bg-purple-900 text-purple-200 px-3 py-1.5 rounded-full text-sm"
        >
          <span>{formatWeaponType(type)}</span>
          <button
            onClick={() => onRemoveFilter('weaponType', type)}
            className="hover:text-white transition-colors"
            aria-label={`Remove ${formatWeaponType(type)} filter`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {/* Price Range Chip */}
      {filters.priceRange && (
        <div className="flex items-center gap-1.5 bg-yellow-900 text-yellow-200 px-3 py-1.5 rounded-full text-sm">
          <span>{formatPriceRange(filters.priceRange)}</span>
          <button
            onClick={() => onRemoveFilter('priceRange')}
            className="hover:text-white transition-colors"
            aria-label="Remove price range filter"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Can Afford Chip */}
      {filters.canAffordOnly && (
        <div className="flex items-center gap-1.5 bg-green-900 text-green-200 px-3 py-1.5 rounded-full text-sm">
          <span>Can Afford</span>
          <button
            onClick={() => onRemoveFilter('canAfford')}
            className="hover:text-white transition-colors"
            aria-label="Remove can afford filter"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default ActiveFiltersDisplay;
