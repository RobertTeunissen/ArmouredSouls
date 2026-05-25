/**
 * ConfirmSaleModal — Final confirmation before deleting a weapon.
 *
 * Shows weapon name, price paid, computed sale price, Workshop level + rate,
 * and a clear "this cannot be undone" warning. When the resale rate is 0%
 * (Workshop L0), warns the player that selling yields no credits.
 *
 * On confirm, calls DELETE /api/weapon-inventory/:id and forwards
 * `achievementUnlocks` from the response to the parent (the global axios
 * interceptor in useAchievementToasts handles toast display automatically).
 *
 * Spec #33 R5.6, R5.7, R7.11.
 */

import { useState } from 'react';
import { api } from '../../utils/api';
import { ApiError } from '../../utils/ApiError';
import { applyResaleRate } from '../../../../shared/utils/discounts';
import { getWeaponImagePath } from '../../utils/weaponImages';
import type { WeaponInventoryItem } from './types';

interface ConfirmSaleModalProps {
  item: WeaponInventoryItem;
  workshopLevel: number;
  resaleRate: number;
  onCancel: () => void;
  onConfirmed: (result: { salePrice: number; weaponName: string }) => void;
}

export function ConfirmSaleModal({
  item,
  workshopLevel,
  resaleRate,
  onCancel,
  onConfirmed,
}: ConfirmSaleModalProps) {
  const salePrice = applyResaleRate(item.pricePaid, resaleRate);
  const isFreeSell = resaleRate === 0;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await api.delete<{ salePrice: number; weaponName: string }>(
        `/api/weapon-inventory/${item.id}`,
      );
      onConfirmed({
        salePrice: response.salePrice,
        weaponName: response.weaponName,
      });
    } catch (err: unknown) {
      const message = (err instanceof ApiError && err.message) || 'Failed to sell weapon. Please try again.';
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-sale-title"
      data-testid="confirm-sale-modal"
    >
      <div
        className="bg-surface rounded-lg max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-sale-title" className="text-2xl font-bold mb-4">
          Sell {item.weapon.name}?
        </h2>

        {/* Weapon image — gives the player a clear "this is what I'm selling" moment */}
        <div className="flex justify-center mb-4">
          <div className="w-32 h-32 bg-surface-elevated rounded flex items-center justify-center overflow-hidden">
            {!imageError ? (
              <img
                src={getWeaponImagePath(item.weapon.name)}
                alt={item.weapon.name}
                className="w-full h-full object-contain"
                onError={() => setImageError(true)}
              />
            ) : (
              <span className="text-4xl text-secondary" aria-hidden="true">⚙️</span>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-secondary">Original catalog price:</span>
            <span>₡{item.weapon.cost.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-secondary">You paid:</span>
            <span>₡{item.pricePaid.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-secondary">Workshop:</span>
            <span>L{workshopLevel} ({resaleRate}% resale rate)</span>
          </div>

          <hr className="border-secondary/30" />

          <div className="flex justify-between text-lg font-semibold">
            <span>You will receive:</span>
            <span className={isFreeSell ? 'text-amber-400' : 'text-emerald-400'}>
              ₡{salePrice.toLocaleString()}
            </span>
          </div>

          {isFreeSell && (
            <div className="bg-amber-900/30 border border-amber-600/50 text-amber-200 text-sm p-3 rounded">
              <strong>Workshop L0:</strong> Selling at this level yields ₡0.
              Build Workshop Level 1 (₡75K) to enable resale at 10%.
              You can still sell to free up storage.
            </div>
          )}

          <div className="bg-red-900/20 border border-red-600/40 text-red-200 text-sm p-3 rounded">
            ⚠️ This action cannot be undone. Your weapon will be permanently removed from inventory.
          </div>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-600 text-red-200 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="bg-surface-elevated hover:bg-surface-elevated/70 text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
            data-testid="cancel-sale-button"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
            data-testid="confirm-sale-button"
          >
            {submitting ? 'Selling…' : 'Confirm Sale'}
          </button>
        </div>
      </div>
    </div>
  );
}
