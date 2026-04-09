/**
 * WeaponCard — Renders a single weapon card with stats, bonuses, and purchase button.
 *
 * Extracted from WeaponShopPage.tsx during component splitting (Spec 18).
 */

import { calculateWeaponWorkshopDiscount } from '../../../../shared/utils/discounts';
import { getWeaponImagePath } from '../../utils/weaponImages';
import { getWeaponOptimalRange, getRangeBandColor, getRangeBandBgColor, getRangeBandLabel } from '../../utils/weaponRange';
import type { Weapon, StorageStatus } from './types';

export interface WeaponCardProps {
  weapon: Weapon;
  userCurrency: number;
  weaponWorkshopLevel: number;
  storageStatus: StorageStatus | null;
  purchasing: number | null;
  ownedCount: number;
  isSelectedForComparison: boolean;
  comparisonCount: number;
  calculateDiscountedPrice: (basePrice: number) => number;
  getTypeColor: (type: string) => string;
  getAttributeBonuses: (weapon: Weapon) => string[];
  onPurchase: (weaponId: number, basePrice: number) => void;
  onToggleComparison: (weaponId: number) => void;
  onSelectWeapon: (weapon: Weapon) => void;
}

export function WeaponCard({
  weapon, userCurrency, weaponWorkshopLevel, storageStatus, purchasing,
  ownedCount, isSelectedForComparison, comparisonCount,
  calculateDiscountedPrice, getTypeColor, getAttributeBonuses,
  onPurchase, onToggleComparison, onSelectWeapon,
}: WeaponCardProps) {
  const bonuses = getAttributeBonuses(weapon);
  const discountedPrice = calculateDiscountedPrice(weapon.cost);
  const hasDiscount = weaponWorkshopLevel > 0;

  return (
    <div className="bg-surface p-6 rounded-lg relative">
      {/* Owned Indicator */}
      {ownedCount > 0 && (
        <div className="absolute top-4 right-4 z-10 bg-blue-900/50 border border-blue-600 px-2 py-1 rounded text-xs font-semibold text-blue-300">
          Already Own ({ownedCount})
        </div>
      )}

      {/* Comparison Checkbox */}
      <div className="absolute top-4 left-4 z-10">
        <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={isSelectedForComparison}
            onChange={() => onToggleComparison(weapon.id)}
            disabled={!isSelectedForComparison && comparisonCount >= 3}
            className="w-5 h-5 rounded border-white/10 text-primary focus:ring-blue-500 focus:ring-offset-surface"
          />
          <span className="text-sm text-secondary">Compare</span>
        </label>
      </div>

      {/* Weapon Image */}
      <div className="mb-4 flex justify-center cursor-pointer" onClick={() => onSelectWeapon(weapon)}>
        <img
          src={getWeaponImagePath(weapon.name)}
          alt={weapon.name}
          className="w-48 h-48 object-contain hover:scale-105 transition-transform"
          onError={(e) => {
            // Fallback if image doesn't load
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      <div className="flex justify-between items-start mb-4">
        <h3
          className="text-xl font-semibold cursor-pointer hover:text-primary transition-colors"
          onClick={() => onSelectWeapon(weapon)}
        >
          {weapon.name}
        </h3>
        <span className={`text-sm font-semibold uppercase ${getTypeColor(weapon.weaponType)}`}>
          {weapon.weaponType}
        </span>
      </div>

      {/* Optimal Range Badge */}
      {(() => {
        const range = getWeaponOptimalRange(weapon);
        return (
          <div className="mb-3">
            <span className={`text-xs px-2 py-0.5 rounded border ${getRangeBandBgColor(range)} ${getRangeBandColor(range)}`}>
              {getRangeBandLabel(range)} Range
            </span>
          </div>
        );
      })()}

      <p className="text-secondary text-sm mb-4">{weapon.description}</p>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-secondary">Loadout Type:</span>
          <span className="font-semibold capitalize">{weapon.loadoutType.replace('_', ' ')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-secondary">Base Damage:</span>
          <span className="font-semibold">{weapon.baseDamage}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-secondary">Cooldown:</span>
          <span className="font-semibold">{weapon.cooldown}s</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-secondary">Cost:</span>
          <div className="flex flex-col items-end">
            {hasDiscount && (
              <span className="text-xs text-tertiary line-through">₡{weapon.cost.toLocaleString()}</span>
            )}
            <span className="font-semibold text-success">
              ₡{discountedPrice.toLocaleString()}
              {hasDiscount && <span className="text-xs ml-1">({calculateWeaponWorkshopDiscount(weaponWorkshopLevel)}% off)</span>}
            </span>
          </div>
        </div>
      </div>

      {bonuses.length > 0 && (
        <div className="mb-4 p-3 bg-surface-elevated rounded">
          <div className="text-xs text-secondary mb-2">Attribute Bonuses:</div>
          <div className="flex flex-wrap gap-1">
            {bonuses.map((bonus, idx) => (
              <span key={idx} className="text-xs bg-surface-elevated px-2 py-1 rounded">
                {bonus}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => onPurchase(weapon.id, weapon.cost)}
        disabled={
          purchasing === weapon.id ||
          !!(userCurrency < discountedPrice) ||
          !!(storageStatus && storageStatus.isFull)
        }
        className={`w-full py-2 min-h-[44px] rounded transition-colors ${
          storageStatus && storageStatus.isFull
            ? 'bg-red-900 text-red-300 cursor-not-allowed'
            : userCurrency < discountedPrice
            ? 'bg-surface-elevated text-tertiary cursor-not-allowed'
            : purchasing === weapon.id
            ? 'bg-surface-elevated text-secondary'
            : 'bg-primary hover:bg-blue-700'
        }`}
      >
        {storageStatus && storageStatus.isFull
          ? 'Storage Full'
          : purchasing === weapon.id
          ? 'Purchasing...'
          : userCurrency < discountedPrice
          ? 'Insufficient Credits'
          : 'Purchase'}
      </button>
    </div>
  );
}
