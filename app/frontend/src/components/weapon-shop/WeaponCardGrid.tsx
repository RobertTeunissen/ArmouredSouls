/**
 * WeaponCardGrid — Displays weapons grouped by loadout type in card view.
 *
 * Extracted from WeaponShopPage.tsx during component splitting (Spec 18).
 *
 * Spec #34: threads `ownedRankBreakdown` through to each WeaponCard so the
 * "Already Own" indicator can show a per-rank summary when refined copies
 * exist.
 */

import { WeaponCard, type OwnedRankBreakdown } from './WeaponCard';
import type { Weapon, StorageStatus } from './types';

export interface WeaponCardGridProps {
  processedWeapons: Weapon[];
  groupedWeapons: Record<string, Weapon[]>;
  userCurrency: number;
  weaponWorkshopLevel: number;
  storageStatus: StorageStatus | null;
  purchasing: number | null;
  ownedWeapons: Map<number, number>;
  /**
   * Optional per-weapon-id rank breakdown of owned copies (Spec #34).
   * When omitted, WeaponCard falls back to the simple `Already Own (n)` indicator.
   */
  ownedBreakdownByWeaponId?: Map<number, OwnedRankBreakdown>;
  selectedForComparison: number[];
  calculateDiscountedPrice: (basePrice: number) => number;
  getTypeColor: (type: string) => string;
  getAttributeBonuses: (weapon: Weapon) => string[];
  getLoadoutTypeLabel: (loadoutType: string) => string;
  getLoadoutTypeColor: (loadoutType: string) => string;
  onPurchase: (weaponId: number, basePrice: number) => void;
  onToggleComparison: (weaponId: number) => void;
  onSelectWeapon: (weapon: Weapon) => void;
}

export function WeaponCardGrid({
  processedWeapons, groupedWeapons,
  userCurrency, weaponWorkshopLevel, storageStatus, purchasing,
  ownedWeapons, ownedBreakdownByWeaponId, selectedForComparison,
  calculateDiscountedPrice, getTypeColor, getAttributeBonuses,
  getLoadoutTypeLabel, getLoadoutTypeColor,
  onPurchase, onToggleComparison, onSelectWeapon,
}: WeaponCardGridProps) {
  if (processedWeapons.length === 0) {
    return (
      <div className="bg-surface rounded-lg p-12 text-center">
        <p className="text-secondary text-lg mb-2">No weapons match your filters</p>
        <p className="text-tertiary text-sm">Try adjusting your filters to see more weapons</p>
      </div>
    );
  }

  return (
    <>
      {Object.entries(groupedWeapons).map(([loadoutType, weaponList]) => (
        weaponList.length > 0 && (
          <div key={loadoutType} className="mb-8">
            <h2 className={`text-2xl font-bold mb-4 ${getLoadoutTypeColor(loadoutType)}`}>
              {getLoadoutTypeLabel(loadoutType)}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {weaponList.map((weapon) => (
                <WeaponCard
                  key={weapon.id}
                  weapon={weapon}
                  userCurrency={userCurrency}
                  weaponWorkshopLevel={weaponWorkshopLevel}
                  storageStatus={storageStatus}
                  purchasing={purchasing}
                  ownedCount={ownedWeapons.get(weapon.id) || 0}
                  ownedRankBreakdown={ownedBreakdownByWeaponId?.get(weapon.id)}
                  isSelectedForComparison={selectedForComparison.includes(weapon.id)}
                  comparisonCount={selectedForComparison.length}
                  calculateDiscountedPrice={calculateDiscountedPrice}
                  getTypeColor={getTypeColor}
                  getAttributeBonuses={getAttributeBonuses}
                  onPurchase={onPurchase}
                  onToggleComparison={onToggleComparison}
                  onSelectWeapon={onSelectWeapon}
                />
              ))}
            </div>
          </div>
        )
      ))}
    </>
  );
}
