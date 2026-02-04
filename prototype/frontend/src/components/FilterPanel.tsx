import React, { useState, useEffect } from 'react';

export interface WeaponFilters {
  loadoutTypes: string[];
  weaponTypes: string[];
  priceRange: { min: number; max: number } | null;
  canAffordOnly: boolean;
}

interface FilterPanelProps {
  filters: WeaponFilters;
  onFiltersChange: (filters: WeaponFilters) => void;
  userCredits: number;
  weaponCount: number;
  filteredCount: number;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFiltersChange,
  userCredits,
  weaponCount,
  filteredCount,
}) => {
  // Collapsible state with localStorage persistence
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('weaponShopFiltersExpanded');
    // Default to expanded on desktop (>768px), collapsed on mobile
    if (saved !== null) {
      return saved === 'true';
    }
    return window.innerWidth >= 768;
  });

  useEffect(() => {
    localStorage.setItem('weaponShopFiltersExpanded', String(isExpanded));
  }, [isExpanded]);
  const handleLoadoutTypeToggle = (type: string) => {
    const newTypes = filters.loadoutTypes.includes(type)
      ? filters.loadoutTypes.filter(t => t !== type)
      : [...filters.loadoutTypes, type];
    onFiltersChange({ ...filters, loadoutTypes: newTypes });
  };

  const handleWeaponTypeToggle = (type: string) => {
    const newTypes = filters.weaponTypes.includes(type)
      ? filters.weaponTypes.filter(t => t !== type)
      : [...filters.weaponTypes, type];
    onFiltersChange({ ...filters, weaponTypes: newTypes });
  };

  const handlePriceRangeChange = (range: { min: number; max: number } | null) => {
    onFiltersChange({ ...filters, priceRange: range });
  };

  const handleCanAffordToggle = () => {
    onFiltersChange({ ...filters, canAffordOnly: !filters.canAffordOnly });
  };

  const handleClearAll = () => {
    onFiltersChange({
      loadoutTypes: [],
      weaponTypes: [],
      priceRange: null,
      canAffordOnly: false,
    });
  };

  const hasActiveFilters = 
    filters.loadoutTypes.length > 0 ||
    filters.weaponTypes.length > 0 ||
    filters.priceRange !== null ||
    filters.canAffordOnly;

  const loadoutTypes = [
    { value: 'single', label: 'Single' },
    { value: 'weapon_shield', label: 'Weapon + Shield' },
    { value: 'two_handed', label: 'Two-Handed' },
    { value: 'dual_wield', label: 'Dual Wield' },
  ];

  const weaponTypes = [
    { value: 'melee', label: 'Melee', color: 'text-red-400' },
    { value: 'ballistic', label: 'Ballistic', color: 'text-orange-400' },
    { value: 'energy', label: 'Energy', color: 'text-blue-400' },
    { value: 'shield', label: 'Shield', color: 'text-cyan-400' },
  ];

  const priceRanges = [
    { label: 'Budget (<₡100K)', min: 0, max: 100000 },
    { label: 'Mid (₡100-300K)', min: 100000, max: 300000 },
    { label: 'Premium (₡300-500K)', min: 300000, max: 500000 },
    { label: 'Luxury (₡500K+)', min: 500000, max: Infinity },
  ];

  return (
    <div className="bg-gray-800 rounded-lg mb-6">
      {/* Header - Always visible */}
      <div className="flex justify-between items-center p-6 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Filters</h2>
          <button
            className="text-gray-400 hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            Showing {filteredCount} of {weaponCount} weapons
          </span>
          {hasActiveFilters && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-gray-700 pt-4">

      {/* Loadout Type Filter */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
          Loadout Type
        </h3>
        <div className="flex flex-wrap gap-2">
          {loadoutTypes.map(type => (
            <button
              key={type.value}
              onClick={() => handleLoadoutTypeToggle(type.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filters.loadoutTypes.includes(type.value)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Weapon Type Filter */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
          Weapon Type
        </h3>
        <div className="flex flex-wrap gap-2">
          {weaponTypes.map(type => (
            <button
              key={type.value}
              onClick={() => handleWeaponTypeToggle(type.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filters.weaponTypes.includes(type.value)
                  ? `bg-blue-600 text-white`
                  : `bg-gray-700 ${type.color} hover:bg-gray-600`
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range Filter */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
          Price Range
        </h3>
        <div className="flex flex-wrap gap-2">
          {priceRanges.map((range, idx) => {
            const isActive = 
              filters.priceRange?.min === range.min && 
              filters.priceRange?.max === range.max;
            return (
              <button
                key={idx}
                onClick={() => 
                  handlePriceRangeChange(isActive ? null : { min: range.min, max: range.max })
                }
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {range.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Filters */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
          Quick Filters
        </h3>
        <button
          onClick={handleCanAffordToggle}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filters.canAffordOnly
              ? 'bg-green-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Can Afford (₡{userCredits.toLocaleString()})
        </button>
      </div>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
