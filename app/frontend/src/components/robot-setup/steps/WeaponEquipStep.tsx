/**
 * WeaponEquipStep — robot setup wizard step: equip a weapon (a hard gate).
 *
 * One click either equips a spare compatible weapon from the stable's
 * inventory, or buys an affordable one and equips it. When storage is full
 * or no weapon is affordable, it says so and points at the fix.
 *
 * Requirements: 5.3, 6.1, 6.2, 10.1, 10.2
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardNotification from '../../DashboardNotification';
import { api } from '../../../utils/api';
import { equipMainWeapon } from '../../../utils/robotApi';
import { ERROR_NOTICE, PANEL, SECONDARY_BUTTON } from '../styles';
import type { StepProps } from '../types';

interface WeaponSummary {
  id: number;
  name: string;
  weaponType: string;
  baseDamage: number;
  cost: number;
  handsRequired: string;
  rangeBand: string;
}

interface WeaponInventoryItem {
  id: number;
  weapon: WeaponSummary;
  equippedOnRobotMain?: number | null;
  equippedOnRobotOffhand?: number | null;
}

interface StorageStatus {
  currentWeapons: number;
  maxCapacity: number;
  isFull: boolean;
}

type StepState =
  | { kind: 'loading' }
  | { kind: 'load-failed' }
  | { kind: 'owned'; items: WeaponInventoryItem[] }
  | { kind: 'buy'; weapons: WeaponSummary[]; credits: number; storage: StorageStatus }
  | { kind: 'storage-full'; storage: StorageStatus }
  | { kind: 'no-credits'; credits: number };

/** How many of the cheapest affordable weapons to offer. */
const SHOP_CHOICES = 6;

/** Whether a weapon fits the robot's loadout as its main weapon. */
function isCompatible(weapon: { handsRequired: string }, loadoutType: string): boolean {
  if (weapon.handsRequired === 'shield') return false; // a shield is never the main weapon
  if (weapon.handsRequired === 'two') return loadoutType === 'two_handed';
  if (weapon.handsRequired === 'one') return ['single', 'dual_wield', 'weapon_shield'].includes(loadoutType);
  return false;
}

function weaponMeta(weapon: WeaponSummary): string {
  return `${weapon.weaponType} · ${weapon.baseDamage} damage · ${weapon.rangeBand} range`;
}

function WeaponEquipStep({ robotId, loadoutType, onComplete, onSkip }: StepProps) {
  const navigate = useNavigate();
  const [state, setState] = useState<StepState>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const [inventory, storage, profile, shop] = await Promise.all([
          api.get<WeaponInventoryItem[]>('/api/weapon-inventory'),
          api.get<StorageStatus>('/api/weapon-inventory/storage-status'),
          api.get<{ currency: number }>('/api/user/profile'),
          api.get<WeaponSummary[]>('/api/weapons'),
        ]);
        if (cancelled) return;
        const spare = inventory.filter((w) => !w.equippedOnRobotMain && !w.equippedOnRobotOffhand && isCompatible(w.weapon, loadoutType));
        const affordable = shop
          .filter((w) => isCompatible(w, loadoutType) && w.cost <= profile.currency)
          .sort((a, b) => a.cost - b.cost)
          .slice(0, SHOP_CHOICES);
        if (spare.length > 0) setState({ kind: 'owned', items: spare });
        else if (storage.isFull) setState({ kind: 'storage-full', storage });
        else if (affordable.length > 0) setState({ kind: 'buy', weapons: affordable, credits: profile.currency, storage });
        else setState({ kind: 'no-credits', credits: profile.currency });
      } catch {
        if (!cancelled) setState({ kind: 'load-failed' });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [loadoutType]);

  const run = async (action: () => Promise<void>, failure: string): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onComplete();
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : failure);
    } finally {
      setBusy(false);
    }
  };

  const equip = (inventoryId: number): Promise<void> =>
    run(async () => { await equipMainWeapon(robotId, inventoryId); }, 'Failed to equip the weapon.');

  const buyAndEquip = (weaponId: number): Promise<void> =>
    run(async () => {
      const result = await api.post<{ weaponInventory: { id: number } }>('/api/weapon-inventory/purchase', { weaponId });
      await equipMainWeapon(robotId, result.weaponInventory.id);
    }, 'Failed to buy the weapon.');

  return (
    <section className={PANEL} aria-labelledby="weapon-step-heading" aria-busy={state.kind === 'loading' || busy}>
      <h2 id="weapon-step-heading" className="text-lg font-semibold">Equip a weapon</h2>
      <p className="mt-1 text-sm text-secondary">A robot without a weapon is never scheduled for battles.</p>

      <div className="mt-4 space-y-3">
        {error && <p className={ERROR_NOTICE} role="alert">{error}</p>}

        {state.kind === 'loading' && <p className="text-sm text-secondary">Loading weapons…</p>}
        {state.kind === 'load-failed' && <p className={ERROR_NOTICE} role="alert">Could not load your weapons. Skip this step and equip one in the Workshop.</p>}

        {state.kind === 'owned' && (
          <>
            <p className="text-sm text-secondary">Spare weapons in your storage:</p>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {state.items.map((item) => (
                <li key={item.id} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-surface-elevated p-3">
                  <div>
                    <p className="text-sm font-semibold">{item.weapon.name}</p>
                    <p className="text-xs text-secondary">{weaponMeta(item.weapon)}</p>
                  </div>
                  <button type="button" onClick={() => void equip(item.id)} disabled={busy} className={`${SECONDARY_BUTTON} w-full text-white`} aria-label={`Equip ${item.weapon.name}`}>
                    Equip
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {state.kind === 'buy' && (
          <>
            <p className="text-sm text-secondary">
              No spare weapon fits this robot. Buy one now (balance{' '}
              <span className="font-semibold tabular-nums text-white">₡{state.credits.toLocaleString()}</span>
              {' '}· storage {state.storage.currentWeapons}/{state.storage.maxCapacity}):
            </p>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {state.weapons.map((weapon) => (
                <li key={weapon.id} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-surface-elevated p-3">
                  <div>
                    <p className="text-sm font-semibold">{weapon.name}</p>
                    <p className="text-xs text-secondary">{weaponMeta(weapon)}</p>
                  </div>
                  <button type="button" onClick={() => void buyAndEquip(weapon.id)} disabled={busy} className={`${SECONDARY_BUTTON} w-full text-white`} aria-label={`Buy and equip ${weapon.name} for ₡${weapon.cost.toLocaleString()}`}>
                    Buy &amp; equip · ₡{weapon.cost.toLocaleString()}
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-xs text-secondary">The cheapest weapons that fit. The Weapon Shop has the full range.</p>
          </>
        )}

        {state.kind === 'storage-full' && (
          <DashboardNotification
            variant="warning"
            icon="📦"
            message="Weapon storage is full"
            detail={`${state.storage.currentWeapons}/${state.storage.maxCapacity} weapons stored. Upgrade the Storage Facility or sell a weapon to make room.`}
            actionLabel="Go to Facilities"
            onAction={() => navigate('/facilities')}
          />
        )}

        {state.kind === 'no-credits' && (
          <DashboardNotification
            variant="warning"
            icon="💰"
            message="Not enough credits for a weapon"
            detail={`Balance ₡${state.credits.toLocaleString()}. Income facilities earn credits every cycle.`}
            actionLabel="Go to Facilities"
            onAction={() => navigate('/facilities')}
          />
        )}
      </div>

      {onSkip && (
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onSkip} disabled={busy} className={SECONDARY_BUTTON}>
            Skip for now
          </button>
        </div>
      )}
    </section>
  );
}

export default WeaponEquipStep;
