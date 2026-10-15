/**
 * Copy for the unequip confirmation on the Battle Config tab (rule 10).
 *
 * A robot without a main weapon forfeits its booked matches; one with an
 * incomplete dual-wield or weapon-and-shield loadout fights them with a single
 * weapon. Unequipping stays allowed; this text only states the consequence.
 */

/** Main weapon: booked matches are forfeited unless the robot is re-armed. */
export function buildUnequipForfeitWarning(robotName: string, eventLabels: string[]): string {
  return `${robotName} has booked matches (${eventLabels.join(', ')}). Without a main weapon it will forfeit them unless re-armed before they run.`;
}

/** Offhand: booked matches are fought with a single weapon. */
export function buildUnequipSingleFallbackWarning(robotName: string, eventLabels: string[]): string {
  return `${robotName} has booked matches (${eventLabels.join(', ')}). Without an offhand it will fight them with a single weapon.`;
}
