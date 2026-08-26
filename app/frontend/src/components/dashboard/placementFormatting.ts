/**
 * Placement helpers for the Todays_Battles_Tile — Spec #48 Requirement 5.
 *
 * Kept out of the component file so that file exports components only (the
 * `react-refresh/only-export-components` rule), and so these two pure functions can
 * be property-tested without rendering anything.
 */

/**
 * Which reward band a Placement_Mode finish falls in.
 *
 * Requirement 5 criteria 6 and 7. The same bands apply to `koth` and `grand_melee`
 * and to EVERY field size: prestige to the top 3, LP and fame to the top 10, nothing
 * beyond. A 4th of 6 in KotH and a 4th of 20 in Grand Melee are both 'lp-and-fame'.
 */
export function placementReward(position: number): 'prestige' | 'lp-and-fame' | 'none' {
  if (position <= 3) return 'prestige';
  if (position <= 10) return 'lp-and-fame';
  return 'none';
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
