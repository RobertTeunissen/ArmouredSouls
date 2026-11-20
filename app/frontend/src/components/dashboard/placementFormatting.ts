/**
 * Placement helpers for the Todays_Battles_Tile — Spec #48 Requirement 5.
 *
 * Kept out of the component file so that file exports components only (the
 * `react-refresh/only-export-components` rule), and so these pure functions can
 * be property-tested without rendering anything.
 */

/** Highest finishing position that earns LP and fame, in both modes. */
const REWARDED_PLACES = 10;

/** Whether a finish earns any placement reward; the same top 10 in both modes. */
export function earnsPlacementReward(position: number): boolean {
  return position <= REWARDED_PLACES;
}

/** `1st`, `2nd`, `3rd`, `4th`, `11th`, `21st`… */
export function ordinal(position: number): string {
  const mod100 = position % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${position}th`;
  switch (position % 10) {
    case 1: return `${position}st`;
    case 2: return `${position}nd`;
    case 3: return `${position}rd`;
    default: return `${position}th`;
  }
}
