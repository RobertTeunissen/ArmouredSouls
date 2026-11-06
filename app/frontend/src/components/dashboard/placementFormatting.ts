/**
 * Placement helpers for the Todays_Battles_Tile — Spec #48 Requirement 5.
 *
 * Kept out of the component file so that file exports components only (the
 * `react-refresh/only-export-components` rule), and so these pure functions can
 * be property-tested without rendering anything.
 */

/** The two placement-resolved modes. */
export type PlacementMode = 'koth' | 'grand_melee';

/** Highest finishing position that earns prestige, per mode (#576: Grand Melee pays the top 10). */
const PRESTIGE_PLACES: Readonly<Record<PlacementMode, number>> = {
  koth: 3,
  grand_melee: 10,
};

/** Highest finishing position that earns LP and fame, in both modes. */
const REWARDED_PLACES = 10;

/**
 * Which reward band a Placement_Mode finish falls in, at EVERY field size.
 *
 * KotH: prestige to the top 3, LP and fame to the top 10. Grand Melee: prestige,
 * LP and fame to the top 10 (#576). Nothing beyond 10th in either mode.
 */
export function placementReward(position: number, mode: PlacementMode): 'prestige' | 'lp-and-fame' | 'none' {
  if (position <= PRESTIGE_PLACES[mode]) return 'prestige';
  if (position <= REWARDED_PLACES) return 'lp-and-fame';
  return 'none';
}

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
