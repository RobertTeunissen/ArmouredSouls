/**
 * Shared attribute-name formatter for refinement UI.
 *
 * Used by `SlotBar` (slot-tooltip text) and `RefinementHistoryPopover`
 * (per-row magnitude labels) to keep the camelCase → display-name conversion
 * in one place. Co-located with the refinement components so the rest of
 * the app keeps using its own `ATTRIBUTE_LABELS` mapping.
 */

/**
 * Convert a camelCase attribute identifier (e.g. `combatPower`) into a
 * display-friendly label (e.g. `Combat Power`). Works for every member of
 * `ROBOT_ATTRIBUTES` without a hardcoded lookup table — refinement is
 * targeted at attribute names by id, not by label, so a deterministic
 * transform avoids drift between source and UI.
 */
export function formatAttributeName(attribute: string): string {
  return attribute
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
