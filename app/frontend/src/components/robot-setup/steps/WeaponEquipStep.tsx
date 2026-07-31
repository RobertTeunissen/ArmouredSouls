/**
 * WeaponEquipStep — Step 2 of the robot setup wizard.
 * Handles three sub-states:
 * (a) Player owns compatible weapons → show equip picker
 * (b) Player has storage + credits → show filtered shop with buy-and-equip
 * (c) Storage full → show upgrade suggestion + link to facilities
 *
 * Requirements: 5.3, 6.1, 6.2, 9.4, 9.5, 10.1, 10.2
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../utils/api';
import { equipMainWeapon, equipOffhandWeapon } from '../../../utils/robotApi';
import type { StepProps } from '../types';

interface WeaponInventoryItem {
  id: number;
  weaponId: number;
  weapon: {
    id: number;
    name: string;
    weaponType: string;
    baseDamage: number;
    cooldown: number;
    cost: number;
    loadoutType: string;
    handsRequired: string;
    rangeBand: string;
  };
  equippedOnRobotMain?: number | null;
  equippedOnRobotOffhand?: number | null;
}

interface StorageStatus {
  currentWeapons: number;
  maxCapacity: number;
  remainingSlots: number;
  isFull: boolean;
}

interface ShopWeapon {
  id: number;
  name: string;
  weaponType: string;
  baseDamage: number;
  cooldown: number;
  cost: number;
  loadoutType: string;
  handsRequired: string;
  rangeBand: string;
}

type SubState = 'loading' | 'has-weapons' | 'buy-and-equip' | 'storage-full' | 'no-credits';

function WeaponEquipStep({ robotId, loadoutType, onComplete, onSkip }: StepProps) {
  const navigate = useNavigate();
  const [subState, setSubState] = useState<SubState>('loading');
  const [inventory, setInventory] = useState<WeaponInventoryItem[]>([]);
  const [shopWeapons, setShopWeapons] = useState<ShopWeapon[]>([]);
  const [credits, setCredits] = useState(0);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [inv, storage, userProfile, weapons] = await Promise.all([
          api.get<WeaponInventoryItem[]>('/api/weapon-inventory'),
          api.get<StorageStatus>('/api/weapon-inventory/storage-status'),
          api.get<{ currency: number }>('/api/user/profile'),
          api.get<ShopWeapon[]>('/api/weapons'),
        ]);

        if (cancelled) return;

        setInventory(inv);
        setStorageStatus(storage);
        setCredits(userProfile.currency);
        setShopWeapons(weapons);

        // Determine sub-state
        // Filter compatible weapons that are not equipped elsewhere
        const compatible = inv.filter((w) => {
          if (w.equippedOnRobotMain || w.equippedOnRobotOffhand) return false;
          return isCompatible(w.weapon, loadoutType);
        });

        if (compatible.length > 0) {
          setSubState('has-weapons');
        } else if (storage.isFull) {
          setSubState('storage-full');
        } else {
          // Check if player can afford any compatible weapon
          const affordableWeapons = weapons.filter(
            (w) => isCompatible(w, loadoutType) && w.cost <= userProfile.currency
          );
          if (affordableWeapons.length > 0) {
            setSubState('buy-and-equip');
          } else {
            setSubState('no-credits');
          }
        }
      } catch {
        if (!cancelled) setError('Failed to load weapon data');
      }
    }

    load();
    return () => { cancelled = true; };
  }, [robotId, loadoutType]);

  const handleEquip = async (inventoryId: number, slot: 'main' | 'offhand'): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      if (slot === 'main') {
        await equipMainWeapon(robotId, inventoryId);
      } else {
        await equipOffhandWeapon(robotId, inventoryId);
      }
      onComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to equip weapon');
    } finally {
      setBusy(false);
    }
  };

  const handleBuyAndEquip = async (weaponId: number): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ weaponInventory: { id: number } }>('/api/weapon-inventory/purchase', { weaponId });
      await equipMainWeapon(robotId, result.weaponInventory.id);
      onComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to purchase weapon');
    } finally {
      setBusy(false);
    }
  };

  if (subState === 'loading') {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Equip a Weapon</h2>
        <div className="text-secondary text-sm animate-pulse">Loading weapons...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-white">Equip a Weapon</h2>
        <p className="text-secondary text-sm mt-1">
          Your robot needs a weapon to be scheduled for battles.
        </p>
      </div>

      {error && (
        <div className="bg-error/10 border border-error rounded-lg p-3 text-error text-sm">
          {error}
        </div>
      )}

      {/* Sub-state A: Player owns compatible weapons */}
      {subState === 'has-weapons' && (
        <div>
          <p className="text-secondary text-sm mb-3">Select a weapon from your inventory:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {inventory
              .filter((w) => !w.equippedOnRobotMain && !w.equippedOnRobotOffhand && isCompatible(w.weapon, loadoutType))
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleEquip(item.id, 'main')}
                  disabled={busy}
                  className="bg-surface border border-gray-700 hover:border-primary rounded-lg p-3 text-left transition-colors min-h-[44px] disabled:opacity-50"
                >
                  <div className="font-semibold text-white text-sm">{item.weapon.name}</div>
                  <div className="text-xs text-secondary mt-1">
                    {item.weapon.weaponType} • {item.weapon.baseDamage} dmg • {item.weapon.rangeBand}
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Sub-state B: Need to buy — show affordable compatible weapons */}
      {subState === 'buy-and-equip' && (
        <div>
          <p className="text-secondary text-sm mb-1">
            No compatible weapons in inventory. Buy one now:
          </p>
          <p className="text-xs text-secondary mb-3">
            Balance: <span className="text-warning font-semibold">₡{credits.toLocaleString()}</span>
            {storageStatus && ` • Storage: ${storageStatus.currentWeapons}/${storageStatus.maxCapacity}`}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {shopWeapons
              .filter((w) => isCompatible(w, loadoutType) && w.cost <= credits)
              .sort((a, b) => a.cost - b.cost)
              .slice(0, 6) // Show first 6 affordable options
              .map((weapon) => (
                <button
                  key={weapon.id}
                  onClick={() => handleBuyAndEquip(weapon.id)}
                  disabled={busy}
                  className="bg-surface border border-gray-700 hover:border-primary rounded-lg p-3 text-left transition-colors min-h-[44px] disabled:opacity-50"
                >
                  <div className="font-semibold text-white text-sm">{weapon.name}</div>
                  <div className="text-xs text-secondary mt-1">
                    {weapon.weaponType} • {weapon.baseDamage} dmg • {weapon.rangeBand}
                  </div>
                  <div className="text-xs text-warning mt-1 font-semibold">
                    ₡{weapon.cost.toLocaleString()}
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Sub-state C: Storage full */}
      {subState === 'storage-full' && (
        <div className="bg-warning/10 border border-warning rounded-lg p-4 text-center">
          <span className="text-3xl block mb-2">📦</span>
          <p className="text-warning font-semibold mb-2">Weapon Storage Full</p>
          <p className="text-secondary text-sm mb-4">
            You have {storageStatus?.currentWeapons}/{storageStatus?.maxCapacity} weapons stored.
            Upgrade your Storage Facility to make room, or sell weapons you no longer need.
          </p>
          <button
            onClick={() => navigate('/facilities')}
            className="bg-warning hover:bg-warning/90 text-gray-900 font-semibold px-4 py-3 rounded-lg min-h-[44px] transition-colors"
          >
            Go to Facilities
          </button>
        </div>
      )}

      {/* Sub-state D: No credits */}
      {subState === 'no-credits' && (
        <div className="bg-warning/10 border border-warning rounded-lg p-4 text-center">
          <span className="text-3xl block mb-2">💰</span>
          <p className="text-warning font-semibold mb-2">Insufficient Credits</p>
          <p className="text-secondary text-sm mb-4">
            Balance: ₡{credits.toLocaleString()}. You need more credits to buy a weapon.
            Invest in income facilities to earn passively.
          </p>
          <button
            onClick={() => navigate('/facilities')}
            className="bg-warning hover:bg-warning/90 text-gray-900 font-semibold px-4 py-3 rounded-lg min-h-[44px] transition-colors"
          >
            Go to Facilities
          </button>
        </div>
      )}

      {/* Skip option */}
      <div className="pt-2">
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-secondary hover:text-white text-sm transition-colors min-h-[44px] px-3 py-2"
          >
            Skip for now — I&apos;ll equip later
          </button>
        )}
      </div>
    </div>
  );
}

/** Check if a weapon is compatible with the robot's loadout type. */
function isCompatible(weapon: { loadoutType: string; handsRequired: string }, loadoutType: string): boolean {
  // Shields are only for weapon_shield loadout
  if (weapon.handsRequired === 'shield') {
    return loadoutType === 'weapon_shield';
  }
  // Two-handed weapons for two_handed loadout
  if (weapon.handsRequired === 'two') {
    return loadoutType === 'two_handed';
  }
  // One-handed weapons for single, dual_wield, or weapon_shield (main hand)
  if (weapon.handsRequired === 'one') {
    return ['single', 'dual_wield', 'weapon_shield'].includes(loadoutType);
  }
  return false;
}

export default WeaponEquipStep;
