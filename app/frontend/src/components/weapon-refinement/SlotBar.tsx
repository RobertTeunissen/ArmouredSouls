/**
 * SlotBar — Reusable 5-slot indicator for weapon refinement state.
 *
 * Renders a row of five slot boxes that map to the `slotIndex` 1..5 of every
 * `WeaponRefinement` row. Filled slots show a tier glyph + tier color; empty
 * slots show either a lock icon (when the player can't even Hone yet — i.e.
 * Workshop level < 1) or a faded empty box. Filled slots are clickable and
 * fire `onSlotClick(slotIndex)` if a handler is provided.
 *
 * Used everywhere a weapon is displayed: My Inventory tab, equipped slot on
 * the robot detail page, weapon detail in the robot loadout, refinement
 * modal header, battle report header.
 *
 * Spec: 34-weapon-refinement (design.md → Components and Interfaces → Frontend Components)
 *
 * TODO (Asset Checklist A2): replace the inline SVG placeholders below with
 * proper tier glyph icons (16×16 sparkle / plus / arrow / hammer). The
 * placeholders use a circle-with-letter pattern so the slot bar is readable
 * at ship time even without final art.
 */

import type { WeaponRefinementItem } from '../weapon-shop/types';
import type { RefinementTier } from '../../../../shared/utils/weaponRefinement';
import { TIER_VISUALS } from './tierVisuals';
import { formatAttributeName } from './attributeFormat';

interface SlotBarProps {
  refinements: WeaponRefinementItem[];
  workshopLevel: number;
  /** Compact size for tight surfaces (robot detail equipped slot). */
  compact?: boolean;
  /** Fired when the player clicks a filled slot (e.g. to open the history popover). */
  onSlotClick?: (slotIndex: number) => void;
}

// ── Constants ────────────────────────────────────────────────────────

/** Workshop level required to use each tier. Mirrors design.md key decision #3. */
const TIER_WORKSHOP_REQUIREMENT: Record<RefinementTier, number> = {
  hone: 1,
  augment: 3,
  sharpen: 5,
  forge: 8,
};

/**
 * Map the design-system color name from `TIER_VISUALS[tier].color` to the
 * Tailwind utility classes used in the slot box. Keeping this lookup in one
 * place keeps the visual identity centralized — consumers never inline a
 * `bg-cyan-500` literal.
 */
const TIER_COLOR_CLASSES: Record<RefinementTier, { bg: string; border: string; text: string }> = {
  hone:    { bg: 'bg-cyan-500/20',  border: 'border-cyan-500',  text: 'text-cyan-300' },
  augment: { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-300' },
  sharpen: { bg: 'bg-amber-500/20', border: 'border-amber-500', text: 'text-amber-300' },
  forge:   { bg: 'bg-red-500/20',   border: 'border-red-500',   text: 'text-red-300' },
};

// ── Helpers ──────────────────────────────────────────────────────────

/** Build the hover-tooltip text for a filled slot. */
function describeRefinement(r: WeaponRefinementItem): string {
  const label = TIER_VISUALS[r.tier].label;
  const cost = `₡${r.costPaid.toLocaleString()}`;
  switch (r.tier) {
    case 'hone':
    case 'augment': {
      const attr = r.targetAttribute ? formatAttributeName(r.targetAttribute) : '';
      return `${label}: +${r.magnitude} ${attr} · ${cost}`;
    }
    case 'sharpen':
      return `${label}: −0.25s cooldown · ${cost}`;
    case 'forge':
      return `${label}: +1.0 base damage · ${cost}`;
  }
}

/** Build the hover-tooltip text for a workshop-locked empty slot. */
function describeNextLockedTier(workshopLevel: number): string {
  // Find the lowest tier the player has not yet unlocked.
  const tiers: RefinementTier[] = ['hone', 'augment', 'sharpen', 'forge'];
  for (const tier of tiers) {
    if (workshopLevel < TIER_WORKSHOP_REQUIREMENT[tier]) {
      const required = TIER_WORKSHOP_REQUIREMENT[tier];
      return `${TIER_VISUALS[tier].label} unlocks at Weapons Workshop L${required} (current L${workshopLevel}).`;
    }
  }
  return 'Empty refinement slot.';
}

// ── Glyph SVGs (placeholders — see Asset Checklist A2) ───────────────

/**
 * Render a small inline SVG glyph identified by `iconName`. The shapes are
 * intentionally simple — the design system does not currently include a
 * formal icon library, and Asset Checklist A2 tracks replacement with
 * proper tier-glyph artwork. The placeholders use a filled circle with
 * the first letter of the tier name so the slot bar is visually distinct
 * across all four tiers without external assets.
 */
function TierGlyph({ iconName, label, size }: { iconName: string; label: string; size: number }) {
  // Map iconName → first-letter shorthand. Defensive default keeps the SVG
  // valid if a future tier is added without updating this component.
  const letter = iconName === 'spark'
    ? 'H'
    : iconName === 'plus'
      ? 'A'
      : iconName === 'arrow'
        ? 'S'
        : iconName === 'hammer'
          ? 'F'
          : label.charAt(0).toUpperCase();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="7" fill="currentColor" fillOpacity="0.25" />
      <text
        x="8"
        y="11"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill="currentColor"
        fontFamily="inherit"
      >
        {letter}
      </text>
    </svg>
  );
}

/** Lock icon for empty-but-locked slots. Inline SVG, currentColor stroke. */
function LockIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3.5" y="7" width="9" height="6.5" rx="1" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

// ── Slot variants ────────────────────────────────────────────────────

interface SlotBoxProps {
  size: number;
  className?: string;
  title: string;
  ariaLabel: string;
  clickable?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

/**
 * Visual shell for every slot. Adds focus / hover affordances when
 * `clickable` is true. Keyboard activation is wired so refinement slots are
 * navigable for assistive tech users.
 */
function SlotBox({ size, className, title, ariaLabel, clickable, onClick, children }: SlotBoxProps) {
  const base = 'flex items-center justify-center rounded border transition-colors';
  const interactive = clickable
    ? 'cursor-pointer hover:brightness-125 focus:outline-none focus:ring-2 focus:ring-primary'
    : '';

  if (clickable && onClick) {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        title={title}
        aria-label={ariaLabel}
        style={{ width: size, height: size }}
        className={`${base} ${interactive} ${className ?? ''}`}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      title={title}
      aria-label={ariaLabel}
      style={{ width: size, height: size }}
      className={`${base} ${className ?? ''}`}
    >
      {children}
    </span>
  );
}

// ── Component ────────────────────────────────────────────────────────

export function SlotBar({ refinements, workshopLevel, compact = false, onSlotClick }: SlotBarProps) {
  const slotSize = compact ? 18 : 26;
  const glyphSize = compact ? 12 : 16;

  // Index refinements by slotIndex (1..5) for O(1) lookup per slot.
  const bySlot = new Map<number, WeaponRefinementItem>();
  for (const r of refinements) bySlot.set(r.slotIndex, r);

  // The only "empty slot is workshop-locked" case is when the player can't
  // even Hone (workshopLevel < 1). Once Hone is available, every empty slot
  // is fillable — Augment/Sharpen/Forge unlocks just expand the choice set.
  const emptyLocked = workshopLevel < TIER_WORKSHOP_REQUIREMENT.hone;
  const lockTooltip = describeNextLockedTier(workshopLevel);

  return (
    <div
      className={`inline-flex items-center ${compact ? 'gap-1' : 'gap-1.5'}`}
      data-testid="slot-bar"
      aria-label={`${refinements.length} of 5 refinement slots filled`}
    >
      {[1, 2, 3, 4, 5].map((slotIndex) => {
        const refinement = bySlot.get(slotIndex);

        if (refinement) {
          const colors = TIER_COLOR_CLASSES[refinement.tier];
          const visual = TIER_VISUALS[refinement.tier];
          const tooltip = describeRefinement(refinement);
          return (
            <SlotBox
              key={slotIndex}
              size={slotSize}
              className={`${colors.bg} ${colors.border} ${colors.text}`}
              title={tooltip}
              ariaLabel={`Slot ${slotIndex}: ${tooltip}`}
              clickable={Boolean(onSlotClick)}
              onClick={onSlotClick ? () => onSlotClick(slotIndex) : undefined}
            >
              <TierGlyph iconName={visual.icon} label={visual.label} size={glyphSize} />
            </SlotBox>
          );
        }

        if (emptyLocked) {
          return (
            <SlotBox
              key={slotIndex}
              size={slotSize}
              className="bg-surface-elevated/40 border-secondary/40 text-secondary/60"
              title={lockTooltip}
              ariaLabel={`Slot ${slotIndex} locked: ${lockTooltip}`}
            >
              <LockIcon size={glyphSize} />
            </SlotBox>
          );
        }

        return (
          <SlotBox
            key={slotIndex}
            size={slotSize}
            className="bg-surface-elevated/30 border-dashed border-secondary/30"
            title={`Slot ${slotIndex} — empty.`}
            ariaLabel={`Slot ${slotIndex} empty`}
          >
            <span aria-hidden="true" className="block w-1 h-1 rounded-full bg-secondary/40" />
          </SlotBox>
        );
      })}
    </div>
  );
}
