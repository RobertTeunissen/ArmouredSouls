/**
 * InventoryTab — "My Inventory" view of WeaponShopPage.
 *
 * Partitions owned weapons into two sections:
 *   - "Available to Sell" — not equipped on any robot
 *   - "Equipped" — equipped on a robot (Sell disabled, Refine still allowed)
 *
 * Hosts both the resale flow (Spec #33 ConfirmSaleModal) and the refinement
 * flow (Spec #34 RefinementModal). The custom-name editor is wired
 * per-row through `handleCustomNameSave`.
 *
 * Specs: #33 R5.2 through R5.8 (resale) + #34 R7.1 (refinement integration).
 */

import { useMemo, useState } from 'react';
import { applyResaleRate, calculateWeaponResaleRate } from '../../../../shared/utils/discounts';
import { api } from '../../utils/api';
import { InventoryRow } from './InventoryRow';
import { InventorySummaryBar } from './InventorySummaryBar';
import { ConfirmSaleModal } from './ConfirmSaleModal';
import { RefinementModal } from '../weapon-refinement';
import type { UnlockedAchievement, WeaponInventoryItem } from './types';

interface InventoryTabProps {
  inventory: WeaponInventoryItem[];
  workshopLevel: number;
  userCurrency: number;
  onSellComplete: (result: { salePrice: number; weaponName: string }) => void;
  onRefineComplete: (result: {
    weaponInventory: WeaponInventoryItem;
    newCurrency: number;
    achievementUnlocks: UnlockedAchievement[];
  }) => void;
  onCustomNameUpdated: (updatedInventory: WeaponInventoryItem) => void;
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
  userCurrency,
  onSellComplete,
  onRefineComplete,
  onCustomNameUpdated,
}: InventoryTabProps) {
  const [pendingSale, setPendingSale] = useState<WeaponInventoryItem | null>(null);
  const [pendingRefine, setPendingRefine] = useState<WeaponInventoryItem | null>(null);

  const resaleRate = calculateWeaponResaleRate(workshopLevel);

  const { available, equipped } = useMemo(
    () => partitionInventory(inventory),
    [inventory],
  );

  const totalResaleValue = useMemo(
    () => available.reduce((sum, item) => sum + applyResaleRate(item.pricePaid, resaleRate), 0),
    [available, resaleRate],
  );

  // Custom name save helper — called by the inline CustomNameEditor in each row.
  // Throws on API error so the editor can render the message.
  async function handleCustomNameSave(
    inventoryId: number,
    newName: string | null,
  ): Promise<void> {
    const response = await api.patch<{ weaponInventory: WeaponInventoryItem }>(
      `/api/weapon-inventory/${inventoryId}/custom-name`,
      { customName: newName },
    );
    onCustomNameUpdated(response.weaponInventory);
  }

  function renderRow(item: WeaponInventoryItem, variant: 'available' | 'equipped') {
    return (
      <InventoryRow
        key={item.id}
        item={item}
        resaleRate={resaleRate}
        workshopLevel={workshopLevel}
        variant={variant}
        onClickSell={variant === 'available' ? () => setPendingSale(item) : () => { /* disabled */ }}
        onClickRefine={() => setPendingRefine(item)}
        onCustomNameSave={(newName) => handleCustomNameSave(item.id, newName)}
      />
    );
  }

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
            {available.map(item => renderRow(item, 'available'))}
          </div>
        )}
      </section>

      {equipped.length > 0 && (
        <section className="mt-8" data-testid="inventory-equipped-section">
          <h3 className="text-xl font-semibold mb-3">
            Equipped ({equipped.length})
          </h3>
          <div className="grid gap-3">
            {equipped.map(item => renderRow(item, 'equipped'))}
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

      {pendingRefine && (
        <RefinementModal
          inventoryItem={pendingRefine}
          workshopLevel={workshopLevel}
          userCurrency={userCurrency}
          onCancel={() => setPendingRefine(null)}
          onConfirmed={(updatedInventoryItem, newCurrency, achievementUnlocks) => {
            setPendingRefine(null);
            onRefineComplete({
              weaponInventory: updatedInventoryItem,
              newCurrency,
              achievementUnlocks,
            });
          }}
        />
      )}
    </div>
  );
}
