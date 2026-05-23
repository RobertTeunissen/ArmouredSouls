/**
 * tierVisuals — Source-of-truth constants mapping refinement tier → visual identity.
 *
 * Imported by SlotBar, RankPrefix, RefinementHistoryPopover, RefinementModal, TierCard,
 * and inventory-row updates. No inline color literals or icon names should appear in any
 * of those consumers — every visual lookup goes through TIER_VISUALS.
 *
 * Spec: 34-weapon-refinement (design.md → Components and Interfaces → Frontend Components)
 */

// TODO: Switch to `import type { RefinementTier } from '../../../../shared/utils/weaponRefinement';`
// once Task 3 of spec 34-weapon-refinement lands. The two values are identical by design —
// the shared module is the eventual single source of truth for the tier union.
type RefinementTier = 'hone' | 'augment' | 'sharpen' | 'forge';

/**
 * Visual identity for a single refinement tier.
 *
 * - `icon`: identifier string consumed by the SlotBar (and other UI) to resolve a glyph at
 *   render time. The project does not use a formal icon library (no Heroicons / Lucide), so
 *   these are semantic identifiers — the consuming component maps them to inline SVGs,
 *   emoji, or sprite IDs as appropriate.
 * - `color`: design-system color name. The semantic tokens defined in `app/frontend/src/index.css`
 *   (`--color-success`, `--color-warning`, `--color-error`, etc.) cover three of the four
 *   tiers; the fourth (cyan) uses the standard Tailwind palette which is fully available
 *   under Tailwind v4. Note: `red-orange` is NOT a Tailwind class — it's the design-system
 *   label for Forge. Consuming components map these names to concrete classes.
 * - `hex`: raw hex value, used when inline styles are unavoidable (e.g., dynamically
 *   colored SVG strokes that can't be expressed via Tailwind utilities).
 * - `label`: human-readable tier name for UI display.
 */
export interface TierVisual {
  /** Icon identifier ('spark' | 'plus' | 'arrow' | 'hammer'). */
  icon: string;
  /** Design-system color name (Tailwind palette name or semantic token label). */
  color: string;
  /** Raw hex value, fallback for inline styles. */
  hex: string;
  /** Human-readable tier label. */
  label: string;
}

/**
 * Tier visual mapping per design.md.
 *
 * Icon mapping rationale (from tasks.md Task 15):
 *   hone    → 'spark'  — sparkle/spark glyph; reinforces an attribute the weapon already has.
 *   augment → 'plus'   — plus glyph; adds a new attribute the weapon did not have.
 *   sharpen → 'arrow'  — arrow/bolt glyph; cooldown reduction → speed.
 *   forge   → 'hammer' — hammer/forge glyph; raw damage increase → power.
 */
export const TIER_VISUALS: Record<RefinementTier, TierVisual> = {
  hone:    { icon: 'spark',  color: 'cyan',       hex: '#06b6d4', label: 'Hone' },
  augment: { icon: 'plus',   color: 'green',      hex: '#10b981', label: 'Augment' },
  sharpen: { icon: 'arrow',  color: 'amber',      hex: '#f59e0b', label: 'Sharpen' },
  forge:   { icon: 'hammer', color: 'red-orange', hex: '#ef4444', label: 'Forge' },
};
