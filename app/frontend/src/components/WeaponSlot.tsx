/**
 * WeaponSlot — Display + control for an equipped weapon on the robot detail page.
 *
 * Spec #34 additions:
 *   - Rank prefix on the weapon name (Refined / Crafted / Mastercrafted / Legendary)
 *     when refinement count > 0.
 *   - Player-set custom name in italic below the name when present.
 *   - Compact `SlotBar` inline for at-a-glance refinement state.
 *   - Hover on slot bar → `RefinementHistoryPopover` available via the SlotBar
 *     component's own onSlotClick affordance (see SlotBar implementation).
 *   - No Refine button on this surface — refinement happens in the Weapon Shop's
 *     My Inventory tab. This page is for combat configuration, not progression.
 */

import { useState } from 'react';
import { getWeaponImagePath } from '../utils/weaponImages';
import {
  RankPrefix,
  SlotBar,
} from './weapon-refinement';

/**
 * Local subset of WeaponInventory needed for display. The robot detail page
 * fetches the full inventory row including refinements + customName via
 * Spec #34 R1.4 (the shared `WEAPON_INCLUDE` constant in robotQueryService now
 * carries refinements through), so the wider shape exists at runtime — we
 * only consume the bits we need here.
 */
interface WeaponInventory {
  id: number;
  customName?: string | null;
  refinements?: Array<{
    id: number;
    tier: 'hone' | 'augment' | 'sharpen' | 'forge';
    magnitude: number;
    targetAttribute: string | null;
    costPaid: number;
    slotIndex: number;
    createdAt: string;
  }>;
  weapon: {
    id: number;
    name: string;
    weaponType: string;
    description: string | null;
    baseDamage: number;
  };
}

interface WeaponSlotProps {
  label: string;
  weapon: WeaponInventory | null;
  onEquip: () => void;
  onUnequip: () => void;
  disabled?: boolean;
  /**
   * Optional: the player's current Weapons Workshop level. Threaded through to
   * the SlotBar so locked-tier tooltips render correctly. Defaults to 0 (every
   * empty slot rendered as "available unless used") when not provided.
   */
  workshopLevel?: number;
}

function WeaponSlot({ label, weapon, onEquip, onUnequip, disabled, workshopLevel = 0 }: WeaponSlotProps) {
  const [imageError, setImageError] = useState(false);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'energy':
        return 'text-primary';
      case 'ballistic':
        return 'text-orange-400';
      case 'melee':
        return 'text-error';
      case 'explosive':
        return 'text-warning';
      default:
        return 'text-secondary';
    }
  };

  const getWeaponIcon = (type: string): string => {
    switch (type) {
      case 'energy':
        return '⚡';
      case 'ballistic':
        return '🔫';
      case 'melee':
        return '⚔️';
      case 'explosive':
        return '💣';
      default:
        return '⚙️';
    }
  };

  const refinements = weapon?.refinements ?? [];
  const refinementCount = refinements.length;

  return (
    <div className="bg-gradient-to-br from-gray-700 to-gray-750 p-4 rounded-lg border border-gray-600 hover:border-gray-500 transition-all duration-150">
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-semibold text-secondary uppercase tracking-wide text-sm">{label}</h4>
        {weapon ? (
          <button
            onClick={onUnequip}
            disabled={disabled}
            className="text-sm text-error hover:text-red-300 disabled:text-tertiary disabled:cursor-not-allowed transition-colors"
          >
            Unequip
          </button>
        ) : (
          <button
            onClick={onEquip}
            disabled={disabled}
            className="text-sm text-primary hover:text-blue-300 disabled:text-tertiary disabled:cursor-not-allowed transition-colors"
          >
            Equip Weapon
          </button>
        )}
      </div>

      {weapon ? (
        <div>
          {/* Weapon Thumbnail (128×128px equivalent) */}
          <div className="flex items-center gap-4 mb-3">
            <div className="w-24 h-24 bg-surface rounded-lg border-2 border-gray-600 flex items-center justify-center overflow-hidden">
              {!imageError ? (
                <img
                  src={getWeaponImagePath(weapon.weapon.name)}
                  alt={weapon.weapon.name}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <span className="text-5xl">{getWeaponIcon(weapon.weapon.weaponType)}</span>
              )}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <RankPrefix refinementCount={refinementCount} variant="subtle" />
                <span className="font-semibold text-white text-lg">{weapon.weapon.name}</span>
              </div>
              {weapon.customName && (
                <div className="italic text-sm text-secondary mb-1">
                  &ldquo;{weapon.customName}&rdquo;
                </div>
              )}
              <span className={`text-xs uppercase font-semibold px-2 py-1 rounded ${getTypeColor(weapon.weapon.weaponType)} bg-surface`}>
                {weapon.weapon.weaponType}
              </span>
            </div>
          </div>

          {/* Refinement slot bar (Spec #34) — only render when we have any refinement data on the row */}
          {weapon.refinements && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-secondary uppercase tracking-wide">Refinements:</span>
              <SlotBar refinements={refinements} workshopLevel={workshopLevel} compact />
            </div>
          )}

          {weapon.weapon.description && (
            <p className="text-sm text-secondary mb-2">{weapon.weapon.description}</p>
          )}
          <div className="text-sm text-secondary bg-surface p-2 rounded">
            Base Damage: <span className="text-white font-semibold">{weapon.weapon.baseDamage}</span>
          </div>
        </div>
      ) : (
        <div className="text-tertiary text-sm italic text-center py-8">
          <div className="text-4xl mb-2">⚙️</div>
          No weapon equipped
        </div>
      )}
    </div>
  );
}

export default WeaponSlot;
