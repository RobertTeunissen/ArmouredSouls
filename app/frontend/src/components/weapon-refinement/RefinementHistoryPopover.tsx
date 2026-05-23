/**
 * RefinementHistoryPopover — Lists the refinement history for a single
 * weapon. Each filled slot renders as a row showing tier, magnitude,
 * target attribute (when relevant), credits paid, and creation date.
 * The popover concludes with a summary line: total spend and slot usage.
 *
 * Anchored to the slot bar (or the Refine button) by the parent component
 * — this file renders only the panel itself; positioning + open/close
 * state belong to the consumer (typically a tooltip wrapper or the
 * RefinementModal header).
 *
 * Spec: 34-weapon-refinement (design.md → Components and Interfaces → Frontend Components)
 */

import { useEffect, useRef } from 'react';
import type { WeaponRefinementItem } from '../weapon-shop/types';
import { TIER_VISUALS } from './tierVisuals';
import { formatAttributeName } from './attributeFormat';

interface RefinementHistoryPopoverProps {
  refinements: WeaponRefinementItem[];
  /**
   * If provided, the row matching this slot index gets a subtle highlight
   * and is scrolled into view on mount. Used when the popover is opened
   * from a click on a specific slot in the SlotBar.
   */
  focusSlotIndex?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Per-tier color classes (text/border) used to accent each row. Mirrors
 * the slot-bar palette so the visual identity stays consistent across
 * surfaces.
 */
const TIER_ROW_ACCENT: Record<WeaponRefinementItem['tier'], string> = {
  hone: 'border-cyan-500/40 text-cyan-300',
  augment: 'border-emerald-500/40 text-emerald-300',
  sharpen: 'border-amber-500/40 text-amber-300',
  forge: 'border-red-500/40 text-red-300',
};

/**
 * Render the per-tier magnitude string used on each row. Hone/Augment
 * surface the attribute name; Sharpen/Forge use fixed copy because their
 * magnitude is implicit.
 */
function describeMagnitude(r: WeaponRefinementItem): string {
  switch (r.tier) {
    case 'hone':
    case 'augment': {
      const attr = r.targetAttribute ? formatAttributeName(r.targetAttribute) : '';
      return `+${r.magnitude} ${attr}`.trim();
    }
    case 'sharpen':
      return '−0.25s cooldown';
    case 'forge':
      return '+1.0 base damage';
  }
}

/** Format a credit amount as `₡<locale-formatted>` for currency display. */
function formatCredits(amount: number): string {
  return `₡${amount.toLocaleString()}`;
}

/** Format an ISO timestamp using the player's locale. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

// ── Component ────────────────────────────────────────────────────────

export function RefinementHistoryPopover({
  refinements,
  focusSlotIndex,
}: RefinementHistoryPopoverProps) {
  // Sort by slotIndex ascending so the order matches the SlotBar.
  const sorted = [...refinements].sort((a, b) => a.slotIndex - b.slotIndex);

  const totalSpend = sorted.reduce((sum, r) => sum + r.costPaid, 0);
  const slotsUsed = sorted.length;

  const focusRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    if (focusSlotIndex !== undefined && focusRef.current) {
      focusRef.current.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [focusSlotIndex]);

  return (
    <div
      role="dialog"
      aria-label="Refinement history"
      data-testid="refinement-history-popover"
      className={
        'bg-surface-elevated border border-secondary/30 rounded-lg shadow-lg ' +
        'p-3 min-w-[280px] max-w-[360px] text-sm animate-fade-in'
      }
    >
      <header className="flex items-center justify-between border-b border-secondary/20 pb-2 mb-2">
        <h3 className="font-semibold text-base">Refinement History</h3>
        <span className="text-xs text-secondary">{slotsUsed} / 5 slots filled</span>
      </header>

      {sorted.length === 0 ? (
        <p className="text-secondary text-xs py-3 text-center">
          No refinements yet. Visit the Weapons Workshop to begin.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto scrollbar-thin">
          {sorted.map((r) => {
            const visual = TIER_VISUALS[r.tier];
            const isFocused = focusSlotIndex === r.slotIndex;
            return (
              <li
                key={r.id}
                ref={isFocused ? focusRef : undefined}
                className={
                  `flex items-start gap-2 border-l-2 pl-2 py-1 rounded ` +
                  `${TIER_ROW_ACCENT[r.tier]} ` +
                  (isFocused ? 'bg-primary/10' : '')
                }
                data-testid={`refinement-row-${r.slotIndex}`}
              >
                <span
                  className={
                    'flex-shrink-0 inline-flex items-center justify-center ' +
                    'w-6 h-6 rounded text-[10px] font-bold uppercase ' +
                    'bg-surface text-secondary border border-secondary/30'
                  }
                  aria-label={`Slot ${r.slotIndex}`}
                >
                  {r.slotIndex}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{visual.label}</span>
                    <span className="text-xs text-secondary">{formatDate(r.createdAt)}</span>
                  </div>
                  <div className="text-xs">{describeMagnitude(r)}</div>
                  <div className="text-xs text-secondary">{formatCredits(r.costPaid)}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="border-t border-secondary/20 pt-2 mt-2 flex items-center justify-between text-xs">
        <span className="text-secondary">Total spend</span>
        <span className="font-semibold">{formatCredits(totalSpend)}</span>
      </footer>
    </div>
  );
}
