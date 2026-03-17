/**
 * Weapon Range Classification Utility
 *
 * Frontend mirror of the backend rangeBands.getWeaponOptimalRange() logic.
 * Maps weapons to their optimal range band based on weaponType, handsRequired, and name.
 *
 * Requirement: 18.1
 */

/** Range band classification */
export type RangeBand = 'melee' | 'short' | 'mid' | 'long';

/** Minimal weapon shape needed for range classification */
export interface WeaponLike {
  weaponType: string;
  handsRequired: string;
  name: string;
}

/** Named long-range specialist weapons */
const LONG_RANGE_WEAPONS = ['Sniper Rifle', 'Railgun', 'Ion Beam'];

/**
 * Determine a weapon's optimal range band.
 *
 * - melee / shield → melee
 * - Sniper Rifle / Railgun / Ion Beam → long
 * - Two-handed ranged → mid
 * - One-handed energy/ballistic → short
 */
export function getWeaponOptimalRange(weapon: WeaponLike): RangeBand {
  if (weapon.weaponType === 'melee') return 'melee';
  if (weapon.weaponType === 'shield') return 'melee';
  if (LONG_RANGE_WEAPONS.includes(weapon.name)) return 'long';
  if (weapon.handsRequired === 'two') return 'mid';
  return 'short';
}

/** Color class for each range band (Tailwind) */
export function getRangeBandColor(band: RangeBand): string {
  switch (band) {
    case 'melee': return 'text-red-400';
    case 'short': return 'text-yellow-400';
    case 'mid': return 'text-green-400';
    case 'long': return 'text-blue-400';
  }
}

/** Background color class for range band badges */
export function getRangeBandBgColor(band: RangeBand): string {
  switch (band) {
    case 'melee': return 'bg-red-900/40 border-red-600';
    case 'short': return 'bg-yellow-900/40 border-yellow-600';
    case 'mid': return 'bg-green-900/40 border-green-600';
    case 'long': return 'bg-blue-900/40 border-blue-600';
  }
}

/** Human-readable label for a range band */
export function getRangeBandLabel(band: RangeBand): string {
  switch (band) {
    case 'melee': return 'Melee';
    case 'short': return 'Short';
    case 'mid': return 'Mid';
    case 'long': return 'Long';
  }
}
