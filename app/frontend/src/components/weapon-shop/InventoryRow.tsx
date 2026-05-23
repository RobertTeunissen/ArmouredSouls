/**
 * InventoryRow — A single weapon-inventory row in the My Inventory tab.
 *
 * Two visual variants:
 *   - 'available': enabled Sell + Refine buttons
 *   - 'equipped': disabled Sell ("Unequip first…"), Refine remains enabled
 *     (refinement is allowed on equipped weapons — Spec #34 design key #4)
 *
 * The row also surfaces:
 *   - Rank prefix derived from filled refinement slots (Refined / Crafted /
 *     Mastercrafted / Legendary).
 *   - Player-set custom name via the inline `CustomNameEditor`.
 *   - Compact `SlotBar` for at-a-glance refinement state.
 *   - "Refine" button next to "Sell". Disabled only when slots are full (5/5).
 *
 * Specs: #33 (resale), #34 (refinement & identity).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { applyResaleRate } from '../../../../shared/utils/discounts';
import { getWeaponImagePath } from '../../utils/weaponImages';
import {
  CustomNameEditor,
  RankPrefix,
  SlotBar,
} from '../weapon-refinement';
import type { WeaponInventoryItem } from './types';

interface InventoryRowProps {
  item: WeaponInventoryItem;
  resaleRate: number;
  workshopLevel: number;
  variant: 'available' | 'equipped';
  onClickSell: () => void;
  onClickRefine: () => void;
  onCustomNameSave: (newName: string | null) => Promise<void>;
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

export function InventoryRow({
  item,
  resaleRate,
  workshopLevel,
  variant,
  onClickSell,
  onClickRefine,
  onCustomNameSave,
}: InventoryRowProps) {
  const salePrice = applyResaleRate(item.pricePaid, resaleRate);
  const equippedInfo = getEquippedInfo(item);
  const isEquipped = variant === 'equipped';
  const refinementCount = item.refinements.length;
  const slotsFull = refinementCount >= 5;
  const [imageError, setImageError] = useState(false);

  // Tooltip listing every robot the player must unequip from
  const sellTooltip = isEquipped && equippedInfo.robots.length > 0
    ? equippedInfo.robots.length === 1
      ? `Unequip from ${equippedInfo.robots[0].name} first to sell`
      : `Unequip from ${equippedInfo.robots.map(r => r.name).join(', ')} first to sell`
    : '';

  const refineTooltip = slotsFull ? 'All 5 refinement slots are filled.' : 'Refine this weapon';

  return (
    <div
      className={
        `bg-surface rounded-lg p-4 flex flex-wrap items-center gap-4 ` +
        (isEquipped ? 'opacity-90 border border-dashed border-secondary/30' : '')
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
          <RankPrefix refinementCount={refinementCount} variant="subtle" />
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

        {/* Custom name editor (Spec #34) */}
        <div className="mt-1">
          <CustomNameEditor inventoryItem={item} onSave={onCustomNameSave} />
        </div>

        {/* Refinement slot bar (Spec #34) */}
        <div className="mt-2">
          <SlotBar refinements={item.refinements} workshopLevel={workshopLevel} compact />
        </div>

        {/* Equipped-on details */}
        {isEquipped && equippedInfo.robots.length > 0 && (
          <div className="text-sm text-secondary mt-2 flex flex-wrap gap-x-2">
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

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onClickRefine}
          disabled={slotsFull}
          title={refineTooltip}
          className={
            slotsFull
              ? 'bg-secondary/20 text-secondary px-4 py-2 rounded cursor-not-allowed'
              : 'bg-cyan-700 hover:bg-cyan-600 text-white px-4 py-2 rounded transition-colors'
          }
          data-testid={`refine-button-${item.id}`}
        >
          Refine
        </button>
        {isEquipped ? (
          <button
            type="button"
            disabled
            title={sellTooltip}
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
