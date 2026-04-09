/**
 * StorageCapacityBar — Displays weapon storage capacity with dual-color progress bar.
 *
 * Extracted from WeaponShopPage.tsx during component splitting (Spec 18).
 */

import type { StorageStatus } from './types';

export interface StorageCapacityBarProps {
  storageStatus: StorageStatus;
  equippedWeaponsCount: number;
}

export function StorageCapacityBar({ storageStatus, equippedWeaponsCount }: StorageCapacityBarProps) {
  return (
    <div className="bg-surface p-6 rounded-lg mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xl font-semibold">Storage Capacity</h3>
        <span className="text-lg font-bold">
          {storageStatus.currentWeapons} / {storageStatus.maxCapacity}
        </span>
      </div>

      {/* Dual-color progress bar showing equipped vs available */}
      <div className="w-full bg-surface-elevated rounded-full h-4 mb-2 overflow-hidden flex">
        {/* Equipped weapons segment (blue) */}
        {equippedWeaponsCount > 0 && (
          <div
            className="h-4 bg-primary-dark transition-all"
            style={{ width: `${(equippedWeaponsCount / storageStatus.maxCapacity) * 100}%` }}
            title={`${equippedWeaponsCount} weapon(s) equipped`}
          />
        )}
        {/* Available weapons segment (capacity-based color) */}
        {storageStatus.currentWeapons - equippedWeaponsCount > 0 && (
          <div
            className={`h-4 transition-all ${
              storageStatus.isFull
                ? 'bg-red-500'
                : storageStatus.percentageFull >= 80
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${((storageStatus.currentWeapons - equippedWeaponsCount) / storageStatus.maxCapacity) * 100}%` }}
            title={`${storageStatus.currentWeapons - equippedWeaponsCount} weapon(s) available`}
          />
        )}
      </div>

      {/* Legend and status text */}
      <div className="flex items-center justify-between gap-4 text-sm mb-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-primary-dark rounded"></div>
            <span className="text-secondary">Equipped: {equippedWeaponsCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded ${
              storageStatus.isFull
                ? 'bg-red-500'
                : storageStatus.percentageFull >= 80
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}></div>
            <span className="text-secondary">Available: {storageStatus.currentWeapons - equippedWeaponsCount}</span>
          </div>
        </div>
      </div>

      <div className="text-sm text-secondary">
        {storageStatus.isFull ? (
          <span className="text-error font-semibold">
            ⚠️ Storage full! Upgrade Storage Facility to increase capacity.
          </span>
        ) : storageStatus.percentageFull >= 80 ? (
          <span className="text-warning">
            Running low on storage space. {storageStatus.remainingSlots} slot(s) remaining.
          </span>
        ) : (
          `${storageStatus.remainingSlots} slot(s) available`
        )}
      </div>
    </div>
  );
}
