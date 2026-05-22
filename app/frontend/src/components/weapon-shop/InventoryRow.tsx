/**
 * InventoryRow — A single weapon-inventory row in the My Inventory tab.
 *
 * Two visual variants:
 *   - 'available': enabled Sell button + computed sale price
 *   - 'equipped': disabled Sell button + "Equipped on: {robotName}" link, dimmed
 *
 * Spec #33 R5.3, R5.4.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { applyResaleRate } from '../../../../shared/utils/discounts';
import { getWeaponImagePath } from '../../utils/weaponImages';
import type { WeaponInventoryItem } from './types';

interface InventoryRowProps {
  item: WeaponInventoryItem;
  resaleRate: number;
  variant: 'available' | 'equipped';
  onClickSell: () => void;
}

interface EquippedInfo {
  robots: Array<{ id: number; name: string; slot: 'Main' | 'Offhand' }>;
}

function getEquippedInfo(item: WeaponInventoryItem): EquippedInfo {
  const robots: EquippedInfo['robots'] = [];
  for (const r of item.robotsMain ?? []) {
    robots.push({ id: r.id, name: r.name, slot: 'Main' });
  }
  for (const r of item.robotsOffhand ?? []) {
    robots.push({ id: r.id, name: r.name, slot: 'Offhand' });
  }
  return { robots };
}

export function InventoryRow({ item, resaleRate, variant, onClickSell }: InventoryRowProps) {
  const salePrice = applyResaleRate(item.pricePaid, resaleRate);
  const equippedInfo = getEquippedInfo(item);
  const isEquipped = variant === 'equipped';
  const [imageError, setImageError] = useState(false);

  // Tooltip listing every robot the player must unequip from
  const tooltipMessage = isEquipped && equippedInfo.robots.length > 0
    ? equippedInfo.robots.length === 1
      ? `Unequip from ${equippedInfo.robots[0].name} first to sell`
      : `Unequip from ${equippedInfo.robots.map(r => r.name).join(', ')} first to sell`
    : '';

  return (
    <div
      className={
        `bg-surface rounded-lg p-4 flex flex-wrap items-center gap-4 ` +
        (isEquipped ? 'opacity-70 border border-dashed border-secondary/30' : '')
      }
      data-testid={`inventory-row-${item.id}`}
    >
      {/* Weapon image */}
      <div className="flex-shrink-0 w-20 h-20 bg-surface-elevated rounded flex items-center justify-center overflow-hidden">
        {!imageError ? (
          <img
            src={getWeaponImagePath(item.weapon.name)}
            alt={item.weapon.name}
            className="w-full h-full object-contain"
            onError={() => setImageError(true)}
          />
        ) : (
          <span className="text-2xl text-secondary" aria-hidden="true">⚙️</span>
        )}
      </div>

      <div className="flex-1 min-w-[200px]">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold">{item.weapon.name}</h3>
          <span className="text-xs uppercase tracking-wide bg-blue-900/30 border border-blue-600/40 px-2 py-0.5 rounded">
            {item.weapon.weaponType}
          </span>
          {isEquipped && (
            <span className="text-xs uppercase tracking-wide bg-amber-900/40 border border-amber-600/50 text-amber-300 px-2 py-0.5 rounded">
              🔒 Equipped
            </span>
          )}
        </div>

        {/* Equipped-on details */}
        {isEquipped && equippedInfo.robots.length > 0 && (
          <div className="text-sm text-secondary mt-1 flex flex-wrap gap-x-2">
            <span>Equipped on:</span>
            {equippedInfo.robots.map((r, idx) => (
              <span key={`${r.id}-${r.slot}`}>
                <Link
                  to={`/robots/${r.id}`}
                  className="text-amber-300 hover:underline"
                >
                  {r.name}
                </Link>
                <span className="text-secondary"> ({r.slot})</span>
                {idx < equippedInfo.robots.length - 1 && ', '}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Price details */}
      <div className="flex flex-col items-end text-sm min-w-[140px]">
        <span className="text-secondary">
          Catalog: ₡{item.weapon.cost.toLocaleString()}
        </span>
        <span className="text-secondary">
          Paid: ₡{item.pricePaid.toLocaleString()}
        </span>
        <span className={isEquipped ? 'text-secondary' : 'text-emerald-400 font-semibold'}>
          Sell for: ₡{salePrice.toLocaleString()}
        </span>
      </div>

      {/* Sell button */}
      <div className="flex flex-col">
        {isEquipped ? (
          <button
            type="button"
            disabled
            title={tooltipMessage}
            className="bg-secondary/20 text-secondary px-4 py-2 rounded cursor-not-allowed"
            data-testid={`sell-button-${item.id}`}
          >
            Sell
          </button>
        ) : (
          <button
            type="button"
            onClick={onClickSell}
            className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded transition-colors"
            data-testid={`sell-button-${item.id}`}
          >
            Sell
          </button>
        )}
      </div>
    </div>
  );
}
