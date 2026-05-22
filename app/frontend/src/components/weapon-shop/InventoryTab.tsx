/**
 * InventoryTab — "My Inventory" view of WeaponShopPage.
 *
 * Partitions owned weapons into two sections:
 *   - "Available to Sell" — not equipped on any robot, sortable by sale price
 *   - "Equipped" — equipped on a robot, disabled Sell + robot-name link
 *
 * Includes a summary bar at the top showing total counts and aggregate resale
 * value. Calls onSellComplete after a successful sale so the parent can
 * refresh inventory + currency.
 *
 * Spec #33 R5.2 through R5.8.
 */

import { useMemo, useState } from 'react';
import { applyResaleRate, calculateWeaponResaleRate } from '../../../../shared/utils/discounts';
import { InventoryRow } from './InventoryRow';
import { InventorySummaryBar } from './InventorySummaryBar';
import { ConfirmSaleModal } from './ConfirmSaleModal';
import type { WeaponInventoryItem } from './types';

interface InventoryTabProps {
  inventory: WeaponInventoryItem[];
  workshopLevel: number;
  onSellComplete: (result: { salePrice: number; weaponName: string }) => void;
}

interface PartitionResult {
  available: WeaponInventoryItem[];
  equipped: WeaponInventoryItem[];
}

function partitionInventory(items: WeaponInventoryItem[]): PartitionResult {
  const available: WeaponInventoryItem[] = [];
  const equipped: WeaponInventoryItem[] = [];
  for (const item of items) {
    const isEquipped =
      (item.robotsMain?.length ?? 0) > 0 || (item.robotsOffhand?.length ?? 0) > 0;
    (isEquipped ? equipped : available).push(item);
  }
  return { available, equipped };
}

export function InventoryTab({
  inventory,
  workshopLevel,
  onSellComplete,
}: InventoryTabProps) {
  const [pendingSale, setPendingSale] = useState<WeaponInventoryItem | null>(null);

  const resaleRate = calculateWeaponResaleRate(workshopLevel);

  const { available, equipped } = useMemo(
    () => partitionInventory(inventory),
    [inventory],
  );

  const totalResaleValue = useMemo(
    () => available.reduce((sum, item) => sum + applyResaleRate(item.pricePaid, resaleRate), 0),
    [available, resaleRate],
  );

  return (
    <div data-testid="inventory-tab">
      <InventorySummaryBar
        totalCount={inventory.length}
        availableCount={available.length}
        totalResaleValue={totalResaleValue}
        workshopLevel={workshopLevel}
        resaleRate={resaleRate}
      />

      <section data-testid="inventory-available-section">
        <h3 className="text-xl font-semibold mb-3">
          Available to Sell ({available.length})
        </h3>
        {available.length === 0 ? (
          <div
            className="bg-surface rounded-lg p-6 text-secondary text-center"
            data-testid="inventory-empty-state"
          >
            No unequipped weapons. Visit a robot to unequip a weapon before selling.
          </div>
        ) : (
          <div className="grid gap-3">
            {available.map(item => (
              <InventoryRow
                key={item.id}
                item={item}
                resaleRate={resaleRate}
                variant="available"
                onClickSell={() => setPendingSale(item)}
              />
            ))}
          </div>
        )}
      </section>

      {equipped.length > 0 && (
        <section className="mt-8" data-testid="inventory-equipped-section">
          <h3 className="text-xl font-semibold mb-3">
            Equipped ({equipped.length})
          </h3>
          <div className="grid gap-3">
            {equipped.map(item => (
              <InventoryRow
                key={item.id}
                item={item}
                resaleRate={resaleRate}
                variant="equipped"
                onClickSell={() => { /* disabled */ }}
              />
            ))}
          </div>
        </section>
      )}

      {pendingSale && (
        <ConfirmSaleModal
          item={pendingSale}
          workshopLevel={workshopLevel}
          resaleRate={resaleRate}
          onCancel={() => setPendingSale(null)}
          onConfirmed={(result) => {
            setPendingSale(null);
            onSellComplete(result);
          }}
        />
      )}
    </div>
  );
}
