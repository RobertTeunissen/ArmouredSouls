/**
 * FacilitiesTab — Displays facility categories with collapsible sections and facility cards.
 *
 * Extracted from FacilitiesPage.tsx during component splitting (Spec 18).
 */

import { FacilityCard } from './FacilityCard';
import { FACILITY_CATEGORIES } from './constants';
import type { Facility } from './types';

export interface FacilitiesTabProps {
  facilities: Facility[];
  currency: number;
  userPrestige: number;
  upgrading: string | null;
  collapsedCategories: Set<string>;
  facilityRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  onUpgrade: (facilityType: string) => void;
  onToggleCategory: (categoryId: string) => void;
  getCategoryFacilities: (categoryTypes: string[]) => Facility[];
}

export function FacilitiesTab({
  currency, userPrestige, upgrading, collapsedCategories, facilityRefs,
  onUpgrade, onToggleCategory, getCategoryFacilities,
}: FacilitiesTabProps) {
  return (
    <div className="space-y-8">
      {FACILITY_CATEGORIES.map((category) => {
        const isCollapsed = collapsedCategories.has(category.id);
        const categoryFacilities = getCategoryFacilities(category.facilityTypes);

        return (
          <div key={category.id} className="space-y-4">
            {/* Category Header */}
            <button
              onClick={() => onToggleCategory(category.id)}
              className="w-full bg-surface p-4 rounded-lg border border-white/10 hover:border-gray-600 transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">{category.icon}</span>
                  <div>
                    <h3 className="text-xl font-semibold">{category.name}</h3>
                    <p className="text-sm text-secondary mt-1">{category.description}</p>
                  </div>
                </div>
                <span className="text-2xl text-secondary">
                  {isCollapsed ? '▼' : '▲'}
                </span>
              </div>
            </button>

            {/* Category Facilities */}
            {!isCollapsed && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {categoryFacilities.map((facility) => (
                  <FacilityCard
                    key={facility.type}
                    facility={facility}
                    currency={currency}
                    userPrestige={userPrestige}
                    upgrading={upgrading}
                    onUpgrade={onUpgrade}
                    facilityRef={(el) => { facilityRefs.current[facility.type] = el; }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
