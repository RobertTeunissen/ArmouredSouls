/**
 * RefinementModal — Central interaction surface for Weapon Refinement (Spec #34).
 *
 * Flow:
 *   1. Player clicks "Refine" on an InventoryRow → parent opens this modal.
 *   2. Player picks a tier (Hone / Augment / Sharpen / Forge).
 *   3. For Hone / Augment, player picks a target attribute and magnitude.
 *   4. Modal previews the cost and projected effective stats live.
 *   5. Player confirms → POST /api/weapon-inventory/:id/refine.
 *   6. On success the modal closes and forwards `achievementUnlocks` upward
 *      so the parent can render unlock toasts (matches the resale flow).
 *
 * Validation runs client-side too (via the shared formula module) so the
 * Confirm button only enables when the request would actually succeed —
 * but the server is still authoritative; on 4xx the modal renders the
 * server error and stays open so the player can adjust.
 *
 * Layout (top → bottom):
 *   - Header: weapon display name (with rank prefix), customName, slot bar.
 *   - Tier picker: 2×2 grid of `TierCard`s.
 *   - Configurator: tier-specific (attribute + magnitude for Hone/Augment;
 *     fixed for Sharpen/Forge).
 *   - Stat preview: current → projected effective stats.
 *   - Cost preview + resale-recovery note.
 *   - Confirm bar: Cancel + permanence-warning Confirm button.
 */

import { useCallback, useMemo, useState } from 'react';
import apiClient from '../../utils/apiClient';
import {
  applyRefinementsToWeapon,
  calculateRefinementCost,
  validateAttributeOnWeapon,
  validateAttributeStackCap,
  validateRefinementSlotAvailable,
  validateShieldCompatibility,
  type RefinementRow,
  type RefinementTier,
} from '../../../../shared/utils/weaponRefinement';
import { ROBOT_ATTRIBUTES } from '../../../../shared/utils/robotAttributes';
import { calculateWeaponResaleRate } from '../../../../shared/utils/discounts';
import type { UnlockedAchievement, WeaponInventoryItem } from '../weapon-shop/types';
import { TIER_VISUALS } from './tierVisuals';
import { SlotBar } from './SlotBar';
import { RankPrefix } from './RankPrefix';
import { formatAttributeName } from './attributeFormat';

// ── Constants ────────────────────────────────────────────────────────

/** Workshop level required per tier — mirrors the backend route handler. */
const TIER_WORKSHOP_REQUIREMENT: Record<RefinementTier, number> = {
  hone: 1,
  augment: 3,
  sharpen: 5,
  forge: 8,
};

/** Brief one-line description for each tier, shown on the tier card. */
const TIER_DESCRIPTION: Record<RefinementTier, string> = {
  hone: 'Boost an attribute the weapon already grants (+1 to +5).',
  augment: 'Add a brand-new attribute bonus (+1 to +5).',
  sharpen: 'Reduce base cooldown by 0.25s.',
  forge: 'Increase base damage by 1.0.',
};

const TIER_COLOR_CLASSES: Record<RefinementTier, { bg: string; border: string; text: string; bgHover: string }> = {
  hone:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/40',    text: 'text-cyan-300',    bgHover: 'hover:bg-cyan-500/20' },
  augment: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', text: 'text-emerald-300', bgHover: 'hover:bg-emerald-500/20' },
  sharpen: { bg: 'bg-amber-500/10',   border: 'border-amber-500/40',   text: 'text-amber-300',   bgHover: 'hover:bg-amber-500/20' },
  forge:   { bg: 'bg-red-500/10',     border: 'border-red-500/40',     text: 'text-red-300',     bgHover: 'hover:bg-red-500/20' },
};

// ── Props ────────────────────────────────────────────────────────────

interface RefinementModalProps {
  inventoryItem: WeaponInventoryItem;
  workshopLevel: number;
  userCurrency: number;
  onCancel: () => void;
  onConfirmed: (
    updatedInventoryItem: WeaponInventoryItem,
    newCurrency: number,
    achievementUnlocks: UnlockedAchievement[],
  ) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────

interface WeaponLikeForFold {
  baseDamage: number;
  cooldown: number;
  [key: string]: unknown;
}

/** Read `weapon[<attr>Bonus]` defensively. Mirrors the backend's `getCatalogBonus`. */
function getCatalogBonus(weapon: WeaponInventoryItem['weapon'], attribute: string): number {
  const v = (weapon as unknown as Record<string, unknown>)[`${attribute}Bonus`];
  return typeof v === 'number' ? v : 0;
}

/** Build a `RefinementRow[]` from the inventory item's stored refinements. */
function toRefinementRows(item: WeaponInventoryItem): RefinementRow[] {
  return item.refinements.map((r) => ({
    tier: r.tier,
    magnitude: r.magnitude,
    targetAttribute: r.targetAttribute,
  }));
}

// ── Sub-components ──────────────────────────────────────────────────

interface TierCardProps {
  tier: RefinementTier;
  selected: boolean;
  disabled: boolean;
  disabledReason?: string;
  onSelect: () => void;
}

function TierCard({ tier, selected, disabled, disabledReason, onSelect }: TierCardProps) {
  const visual = TIER_VISUALS[tier];
  const colors = TIER_COLOR_CLASSES[tier];
  const required = TIER_WORKSHOP_REQUIREMENT[tier];

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      aria-label={`${visual.label} tier${disabled ? ` (locked: ${disabledReason})` : ''}`}
      aria-pressed={selected}
      data-testid={`tier-card-${tier}`}
      className={[
        'flex flex-col gap-1 rounded-md border-2 p-3 text-left transition-all',
        selected
          ? `${colors.bg} ${colors.border} ring-2 ring-primary`
          : `${colors.bg} ${colors.border} ${disabled ? 'opacity-40' : colors.bgHover + ' cursor-pointer'}`,
        disabled ? 'cursor-not-allowed' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <span className={`font-semibold ${colors.text}`}>{visual.label}</span>
        <span className="text-xs text-secondary">L{required}+</span>
      </div>
      <span className="text-xs text-secondary leading-snug">{TIER_DESCRIPTION[tier]}</span>
      {disabled && (
        <span className="text-xs text-amber-300/80 mt-1">{disabledReason}</span>
      )}
    </button>
  );
}

// ── Component ────────────────────────────────────────────────────────

export function RefinementModal({
  inventoryItem,
  workshopLevel,
  userCurrency,
  onCancel,
  onConfirmed,
}: RefinementModalProps) {
  const refinementRows = useMemo(() => toRefinementRows(inventoryItem), [inventoryItem]);
  const refinementCount = refinementRows.length;
  const slotsFull = refinementCount >= 5;

  // ── Tier availability ──────────────────────────────────────────────

  const sharpenCount = refinementRows.filter((r) => r.tier === 'sharpen').length;
  const forgeCount = refinementRows.filter((r) => r.tier === 'forge').length;
  const isShield = inventoryItem.weapon.weaponType === 'shield';

  const tierLockReason = useCallback((tier: RefinementTier): string | null => {
    if (slotsFull) return '5 / 5 slots filled.';
    if (workshopLevel < TIER_WORKSHOP_REQUIREMENT[tier]) {
      return `Requires Weapons Workshop L${TIER_WORKSHOP_REQUIREMENT[tier]} (you are L${workshopLevel}).`;
    }
    if (tier === 'sharpen' && sharpenCount >= 2) return 'Sharpen already at the per-weapon cap of 2.';
    if (tier === 'forge' && forgeCount >= 2) return 'Forge already at the per-weapon cap of 2.';
    if (isShield && (tier === 'sharpen' || tier === 'forge')) return 'Shields cannot be Sharpened or Forged.';
    return null;
  }, [slotsFull, workshopLevel, sharpenCount, forgeCount, isShield]);

  // ── Selection state ────────────────────────────────────────────────

  const [tier, setTier] = useState<RefinementTier | null>(null);
  const [magnitude, setMagnitude] = useState<number>(1);
  const [targetAttribute, setTargetAttribute] = useState<string>('');

  // Reset attribute when the tier changes so a stale value doesn't leak
  // (e.g. picking Hone with combatPower, switching to Augment — the old
  // attribute would still be selected but it's now invalid).
  function selectTier(next: RefinementTier) {
    setTier(next);
    setTargetAttribute('');
    setMagnitude(1);
    setError(null);
  }

  // ── Configurator helpers ───────────────────────────────────────────

  /** Attributes the weapon currently grants (catalog > 0 OR via prior Augment). */
  const honableAttributes = useMemo(() => {
    return ROBOT_ATTRIBUTES.filter((attr) => {
      const catalogBonus = getCatalogBonus(inventoryItem.weapon, attr);
      const augmented = refinementRows.some(
        (r) => r.tier === 'augment' && r.targetAttribute === attr,
      );
      return catalogBonus > 0 || augmented;
    });
  }, [inventoryItem, refinementRows]);

  /** Attributes the weapon does NOT yet grant — eligible for Augment. */
  const augmentableAttributes = useMemo(() => {
    return ROBOT_ATTRIBUTES.filter((attr) => {
      const catalogBonus = getCatalogBonus(inventoryItem.weapon, attr);
      const augmented = refinementRows.some(
        (r) => r.tier === 'augment' && r.targetAttribute === attr,
      );
      return catalogBonus === 0 && !augmented;
    });
  }, [inventoryItem, refinementRows]);

  // ── Live validation ────────────────────────────────────────────────

  const validation = useMemo(() => {
    if (!tier) return { ok: false, message: 'Select a tier to begin.' };

    const slotCheck = validateRefinementSlotAvailable(refinementRows, tier);
    if (!slotCheck.ok) return { ok: false, message: tierLockReason(tier) ?? 'Tier unavailable.' };

    const shieldCheck = validateShieldCompatibility(inventoryItem.weapon.weaponType, tier);
    if (!shieldCheck.ok) return { ok: false, message: 'Shields cannot be Sharpened or Forged.' };

    if (tier === 'hone' || tier === 'augment') {
      if (!targetAttribute) return { ok: false, message: 'Pick an attribute to target.' };

      const catalogBonus = getCatalogBonus(inventoryItem.weapon, targetAttribute);
      const attrCheck = validateAttributeOnWeapon(catalogBonus, refinementRows, targetAttribute, tier);
      if (!attrCheck.ok) {
        return {
          ok: false,
          message:
            attrCheck.code === 'ATTRIBUTE_NOT_ON_WEAPON'
              ? `${formatAttributeName(targetAttribute)} is not on this weapon. Use Augment to add it.`
              : `${formatAttributeName(targetAttribute)} is already on this weapon. Use Hone to deepen it.`,
        };
      }

      const stackCheck = validateAttributeStackCap(catalogBonus, refinementRows, targetAttribute, magnitude);
      if (!stackCheck.ok) {
        return {
          ok: false,
          message: `${formatAttributeName(targetAttribute)} is already at +${stackCheck.currentTotal}. +${magnitude} would push past the +10 cap.`,
        };
      }
    }

    return { ok: true as const, message: null };
  }, [tier, magnitude, targetAttribute, refinementRows, inventoryItem.weapon, tierLockReason]);

  const cost = useMemo(() => {
    if (!tier) return 0;
    const existingInstancesOfTier = refinementRows.filter((r) => r.tier === tier).length;
    const m = (tier === 'sharpen' || tier === 'forge') ? 1 : magnitude;
    return calculateRefinementCost(tier, m, existingInstancesOfTier);
  }, [tier, magnitude, refinementRows]);

  const affordable = userCurrency >= cost;
  const canConfirm = validation.ok && affordable;

  // ── Stat preview ───────────────────────────────────────────────────

  const currentEffective = useMemo(() => {
    return applyRefinementsToWeapon(inventoryItem.weapon as unknown as WeaponLikeForFold, refinementRows);
  }, [inventoryItem.weapon, refinementRows]);

  const projectedEffective = useMemo(() => {
    if (!tier) return null;
    const candidate: RefinementRow = {
      tier,
      magnitude: (tier === 'sharpen' || tier === 'forge') ? 1 : magnitude,
      targetAttribute: (tier === 'hone' || tier === 'augment') ? (targetAttribute || null) : null,
    };
    return applyRefinementsToWeapon(
      inventoryItem.weapon as unknown as WeaponLikeForFold,
      [...refinementRows, candidate],
    );
  }, [tier, magnitude, targetAttribute, refinementRows, inventoryItem.weapon]);

  // ── Resale-recovery note ───────────────────────────────────────────

  const resaleRate = calculateWeaponResaleRate(workshopLevel);

  // ── Submission ─────────────────────────────────────────────────────

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!canConfirm || submitting || !tier) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: { tier: RefinementTier; magnitude: number; targetAttribute?: string } = { tier, magnitude: 1 };
      if (tier === 'hone' || tier === 'augment') {
        body.magnitude = magnitude;
        body.targetAttribute = targetAttribute;
      }
      const response = await apiClient.post(`/api/weapon-inventory/${inventoryItem.id}/refine`, body);
      onConfirmed(
        response.data.weaponInventory as WeaponInventoryItem,
        response.data.currency as number,
        (response.data.achievementUnlocks ?? []) as UnlockedAchievement[],
      );
    } catch (err: unknown) {
      const errorObj = err as {
        response?: {
          data?: {
            error?: string;
            code?: string;
            details?: { attribute?: string; currentTotal?: number; requestedAddition?: number; requiredWorkshopLevel?: number; currentWorkshopLevel?: number };
          };
        };
      };
      const data = errorObj.response?.data;
      // Render a richer message when the server provides structured details.
      let message = data?.error ?? 'Refinement failed. Please try again.';
      if (data?.code === 'WEAPON_REFINEMENT_ATTRIBUTE_STACK_CAP_EXCEEDED' && data.details?.attribute) {
        const attr = formatAttributeName(data.details.attribute);
        message = `${attr} is already at +${data.details.currentTotal ?? '?'}. +${data.details.requestedAddition ?? '?'} would push past the +10 cap.`;
      } else if (data?.code === 'WEAPON_REFINEMENT_TIER_LOCKED' && data.details?.requiredWorkshopLevel !== undefined) {
        message = `Requires Weapons Workshop L${data.details.requiredWorkshopLevel} (you are L${data.details.currentWorkshopLevel ?? '?'}).`;
      }
      setError(message);
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────

  const headerName = inventoryItem.weapon.name;
  const customName = inventoryItem.customName;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="refinement-modal-title"
      data-testid="refinement-modal"
    >
      <div
        className="bg-surface rounded-lg max-w-2xl w-full p-6 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="border-b border-secondary/30 pb-4 mb-4">
          <h2 id="refinement-modal-title" className="text-2xl font-bold flex items-center gap-2">
            <RankPrefix refinementCount={refinementCount} />
            <span>{headerName}</span>
          </h2>
          {customName && (
            <p className="italic text-secondary mt-1" data-testid="header-custom-name">
              &ldquo;{customName}&rdquo;
            </p>
          )}
          <div className="mt-3">
            <SlotBar refinements={inventoryItem.refinements} workshopLevel={workshopLevel} />
          </div>
        </div>

        {/* ── Tier picker ───────────────────────────────────────────── */}
        <section className="mb-4" data-testid="tier-picker">
          <h3 className="font-semibold mb-2 text-secondary uppercase text-xs tracking-wide">Pick a tier</h3>
          <div className="grid grid-cols-2 gap-3">
            {(['hone', 'augment', 'sharpen', 'forge'] as const).map((t) => {
              const lockReason = tierLockReason(t);
              return (
                <TierCard
                  key={t}
                  tier={t}
                  selected={tier === t}
                  disabled={lockReason !== null}
                  disabledReason={lockReason ?? undefined}
                  onSelect={() => selectTier(t)}
                />
              );
            })}
          </div>
        </section>

        {/* ── Configurator ──────────────────────────────────────────── */}
        {tier && (
          <section className="mb-4" data-testid="configurator">
            <h3 className="font-semibold mb-2 text-secondary uppercase text-xs tracking-wide">Configure</h3>
            <div className="bg-surface-elevated/40 border border-secondary/20 rounded p-3 space-y-3">
              {(tier === 'hone' || tier === 'augment') && (
                <>
                  <div>
                    <label className="block text-xs text-secondary mb-1" htmlFor="refine-attribute">
                      Target attribute
                    </label>
                    <select
                      id="refine-attribute"
                      value={targetAttribute}
                      onChange={(e) => { setTargetAttribute(e.target.value); setError(null); }}
                      disabled={submitting}
                      data-testid="refine-attribute-select"
                      className="w-full bg-surface border border-secondary/40 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">— pick one —</option>
                      {(tier === 'hone' ? honableAttributes : augmentableAttributes).map((attr) => (
                        <option key={attr} value={attr}>{formatAttributeName(attr)}</option>
                      ))}
                    </select>
                    {tier === 'hone' && honableAttributes.length === 0 && (
                      <p className="text-xs text-amber-300/80 mt-1">
                        This weapon has no Hone-able attributes yet. Augment one first.
                      </p>
                    )}
                    {tier === 'augment' && augmentableAttributes.length === 0 && (
                      <p className="text-xs text-amber-300/80 mt-1">
                        Every attribute is already on this weapon.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-secondary mb-1" htmlFor="refine-magnitude">
                      Magnitude
                    </label>
                    <div className="flex gap-2" role="group" aria-label="Magnitude">
                      {[1, 2, 3, 4, 5].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => { setMagnitude(m); setError(null); }}
                          disabled={submitting}
                          aria-pressed={magnitude === m}
                          data-testid={`magnitude-${m}`}
                          className={[
                            'w-10 h-10 rounded font-semibold transition-colors',
                            magnitude === m
                              ? 'bg-primary text-white'
                              : 'bg-surface border border-secondary/40 text-secondary hover:bg-surface-elevated/60',
                          ].join(' ')}
                        >
                          +{m}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {tier === 'sharpen' && (
                <p className="text-sm">
                  <span className="text-amber-300 font-semibold">Sharpen</span> reduces base cooldown by{' '}
                  <span className="text-amber-300">0.25s</span>. Magnitude is fixed.
                </p>
              )}

              {tier === 'forge' && (
                <p className="text-sm">
                  <span className="text-red-300 font-semibold">Forge</span> increases base damage by{' '}
                  <span className="text-red-300">1.0</span>. Magnitude is fixed.
                </p>
              )}
            </div>
          </section>
        )}

        {/* ── Stat preview ──────────────────────────────────────────── */}
        {tier && projectedEffective && (
          <section className="mb-4" data-testid="stat-preview">
            <h3 className="font-semibold mb-2 text-secondary uppercase text-xs tracking-wide">Projected stats</h3>
            <div className="bg-surface-elevated/40 border border-secondary/20 rounded p-3 text-sm space-y-1">
              <PreviewRow
                label="Base damage"
                current={currentEffective.effectiveBaseDamage}
                projected={projectedEffective.effectiveBaseDamage}
                format={(v) => v.toFixed(1)}
              />
              <PreviewRow
                label="Base cooldown"
                current={currentEffective.effectiveCooldown}
                projected={projectedEffective.effectiveCooldown}
                format={(v) => `${v.toFixed(2)}s`}
                lowerIsBetter
              />
              {(tier === 'hone' || tier === 'augment') && targetAttribute && (
                <PreviewRow
                  label={`${formatAttributeName(targetAttribute)} bonus`}
                  current={currentEffective.effectiveAttributeBonuses[`${targetAttribute}Bonus`] ?? 0}
                  projected={projectedEffective.effectiveAttributeBonuses[`${targetAttribute}Bonus`] ?? 0}
                  format={(v) => (v > 0 ? `+${v}` : `${v}`)}
                />
              )}
            </div>
          </section>
        )}

        {/* ── Cost preview ──────────────────────────────────────────── */}
        {tier && (
          <section className="mb-4" data-testid="cost-preview">
            <div className="bg-surface-elevated/40 border border-secondary/20 rounded p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-secondary">Cost</span>
                <span className="font-semibold">₡{cost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-secondary">Current balance</span>
                <span>₡{userCurrency.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-secondary">After refinement</span>
                <span className={userCurrency - cost < 0 ? 'text-red-300' : ''}>
                  ₡{(userCurrency - cost).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-secondary border-t border-secondary/20 pt-2 mt-1">
                Refinement spend folds into resale value at your Workshop level (currently {resaleRate}%).
              </p>
            </div>
          </section>
        )}

        {/* ── Validation / server error banner ──────────────────────── */}
        {tier && !validation.ok && validation.message && (
          <div className="bg-amber-900/30 border border-amber-600/50 text-amber-200 text-sm p-3 rounded mb-4" data-testid="validation-banner">
            {validation.message}
          </div>
        )}
        {error && (
          <div className="bg-red-900/40 border border-red-600 text-red-200 p-3 rounded mb-4 text-sm" data-testid="error-banner">
            {error}
          </div>
        )}

        {/* ── Confirm bar ───────────────────────────────────────────── */}
        <div className="border-t border-secondary/30 pt-4 mt-2">
          <p className="text-xs text-amber-200 mb-3">
            ⚠️ Refinement is permanent. Confirm to spend ₡{cost.toLocaleString()}.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              data-testid="cancel-refinement-button"
              className="bg-surface-elevated hover:bg-surface-elevated/70 text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm || submitting}
              data-testid="confirm-refinement-button"
              className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-surface-elevated disabled:hover:bg-surface-elevated text-white px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Refining…' : 'Confirm Refinement'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PreviewRow ────────────────────────────────────────────────────────

interface PreviewRowProps {
  label: string;
  current: number;
  projected: number;
  format: (v: number) => string;
  lowerIsBetter?: boolean;
}

function PreviewRow({ label, current, projected, format, lowerIsBetter = false }: PreviewRowProps) {
  const delta = projected - current;
  const noChange = Math.abs(delta) < 1e-9;
  const better = lowerIsBetter ? delta < 0 : delta > 0;
  const deltaClass = noChange
    ? 'text-secondary'
    : better
      ? 'text-emerald-300'
      : 'text-red-300';
  const deltaPrefix = noChange ? '' : delta > 0 ? '+' : '';

  return (
    <div className="flex justify-between" data-testid={`preview-row-${label.replace(/\s+/g, '-').toLowerCase()}`}>
      <span className="text-secondary">{label}</span>
      <span>
        {format(current)}
        <span className="mx-1 text-secondary">→</span>
        <span className={deltaClass}>
          {format(projected)}
          {!noChange && (
            <span className="ml-1 text-xs">
              ({deltaPrefix}{format(delta).replace(/^[+-]/, '')})
            </span>
          )}
        </span>
      </span>
    </div>
  );
}
