/**
 * PlacementModesRecordNote
 *
 * #532: "Battles" shows the all-modes count (totalBattles + KotH + Grand Melee),
 * while Record and Win Rate only cover win/loss modes. This one-line muted note
 * explains the gap, and renders only when the two counts actually differ.
 *
 * Shared by the robot detail page and the public robot card so the wording and
 * the show/hide rule live in one place.
 */

export const PLACEMENT_MODES_RECORD_NOTE =
  'Record and win rate exclude KotH and Grand Melee, which are placement events.';

interface PlacementModesRecordNoteProps {
  /** All-modes battle count; null/undefined when the payload does not carry it. */
  allModesBattleCount: number | null | undefined;
  /** Win/loss-mode battle count, the Record and Win Rate denominator. */
  totalBattles: number;
  className?: string;
}

function PlacementModesRecordNote({
  allModesBattleCount,
  totalBattles,
  className = 'text-xs text-secondary',
}: PlacementModesRecordNoteProps) {
  if (allModesBattleCount == null || allModesBattleCount === totalBattles) return null;
  return <p className={className}>{PLACEMENT_MODES_RECORD_NOTE}</p>;
}

export default PlacementModesRecordNote;
