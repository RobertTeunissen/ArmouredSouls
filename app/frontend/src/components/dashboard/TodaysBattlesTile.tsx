/**
 * Todays_Battles_Tile — "has today happened yet, and how did it go?"
 *
 * Spec #48 Requirements 4, 5 and 10. An AGGREGATE only: a stable of seven robots
 * across nine events can fight twenty-plus battles a day, so a per-battle list here
 * would bury the answer. Per-battle detail belongs to the Recent Battles section
 * below.
 */

import React from 'react';
import {
  DashboardTile,
  DashboardTileStat,
  DashboardTileLines,
  DashboardTilePrompt,
  DashboardTileNote,
} from './DashboardTile';
import type { OverviewRowData } from './types';
import { placementReward, ordinal } from './placementFormatting';

/** How many upcoming Battle_Slot times are shown before the `+N more` indicator. */
const SLOTS_SHOWN = 2;

/** Whole hours and minutes until the next settlement boundary. */
function timeUntil(iso: string, now: Date): string {
  const remainingMs = Math.max(0, new Date(iso).getTime() - now.getTime());
  const totalMinutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function TodaysBattlesTile({
  data,
  now = new Date(),
}: {
  data: OverviewRowData;
  now?: Date;
}): React.ReactElement {
  const { cycleProgress, robotCount, isPreparationPhase, isLoading, error } = data;

  // Requirement 10 criterion 7 and 11: the no-robots prompt replaces ALL figure lines.
  if (!isLoading && error === null && robotCount === 0) {
    return (
      <DashboardTile
        title="Today's Battles"
        periodNote="This cycle, compared with last"
        isLoading={false}
        error={null}
        content={
          <DashboardTilePrompt
            message="No robots yet. Build one and it will start picking up matches."
            linkLabel="Create a robot"
            to="/robots/create"
          />
        }
      />
    );
  }

  // Requirement 4 criterion 7: on a failed read this tile shows the shared error
  // state — never a zero fought count, which would read as "the day ran and you did
  // nothing".
  if (isLoading || error !== null || cycleProgress === null) {
    return (
      <DashboardTile
        title="Today's Battles"
        periodNote="This cycle, compared with last"
        isLoading={isLoading}
        error={error ?? (cycleProgress === null ? "Today's figures are unavailable." : null)}
        content={null}
      />
    );
  }

  const {
    battlesFought,
    matchesScheduled,
    winLossBattles,
    placementBattles,
    winLossDraw,
    bestPlacement,
    remainingSlotsUtc,
  } = cycleProgress;

  // Requirement 10 criterion 4: during a Preparation_Phase nothing is scheduled, and
  // that is an explanatory state rather than an error — no retry control.
  const inPreparation = isPreparationPhase && matchesScheduled === 0;

  const hasFought = battlesFought > 0;
  const outcomesTotal = winLossDraw.wins + winLossDraw.losses + winLossDraw.draws;

  // The service guarantees `matchesScheduled >= battlesFought`. This is the safety net
  // for the day that guarantee breaks: render the fought count alone rather than a
  // ratio like `4 of 1`, which is arithmetic nonsense on the face of it and destroys
  // trust in every other figure on the row (Requirement 4 criterion 12).
  const ratioIsCoherent = matchesScheduled >= battlesFought;

  const shownSlots = remainingSlotsUtc.slice(0, SLOTS_SHOWN);
  const extraSlots = remainingSlotsUtc.length - shownSlots.length;
  const slotItems = [
    ...shownSlots.map((t) => `${t} UTC`),
    ...(extraSlots > 0 ? [`+${extraSlots} more`] : []),
  ];

  const content = (
    <>
      {/* Requirement 4 criterion 1 and Requirement 10 criterion 10: a zero fought
          count against a known scheduled count is a value, not an omission. */}
      <DashboardTileStat
        label="Battles fought"
        value={ratioIsCoherent ? `${battlesFought} of ${matchesScheduled}` : `${battlesFought}`}
        signMeaning="no-meaning"
      />

      {/* Requirement 10 criteria 1 and 2: omitted entirely when nothing was fought,
          and omitted independently of the placement line.

          The match count in the label is what makes the tile add up. Without it, a
          record of `2W 0L 0D` under a fought count of 4 reads as two missing battles,
          when in fact the other two were Placement_Mode events reported on the line
          below (Requirement 4 criterion 13). */}
      {hasFought && outcomesTotal > 0 ? (
        <DashboardTileStat
          label={`Wins and losses (${winLossBattles} ${winLossBattles === 1 ? 'match' : 'matches'})`}
          value={`${winLossDraw.wins}W ${winLossDraw.losses}L ${winLossDraw.draws}D`}
            signMeaning="no-meaning"
        />
      ) : null}

      {/* Requirement 5 criteria 3, 5 and 6: a placement is never rendered in the loss
          or error colour, and a reward-earning finish carries a trophy the others do
          not. `signMeaning: 'no-meaning'` with no delta is what guarantees the colour.

          Labelled with its own count for the same reason as the line above, and named
          "Placement events" rather than "Best finish" so that a new player can see that
          KotH and Grand Melee resolve by finishing position instead of by win or loss —
          which is the only way the 4 = 2 + 2 split is inferable from the tile. */}
      {bestPlacement !== null ? (
        <DashboardTileStat
          label={`Placement events (${placementBattles})`}
          value={`${placementReward(bestPlacement.position) !== 'none' ? '🏆 ' : ''}best ${ordinal(
            bestPlacement.position,
          )} of ${bestPlacement.fieldSize}`}
            signMeaning="no-meaning"
        />
      ) : null}

      {inPreparation ? (
        <DashboardTileNote message="No matches are scheduled during the season preparation window." />
      ) : slotItems.length > 0 ? (
        <DashboardTileLines label="Next up" items={slotItems} />
      ) : (
        // Requirement 10 criterion 3: every scheduled match is fought, so the slot
        // line is replaced by the countdown to settlement.
        <DashboardTileNote
          message={`All scheduled matches fought. Settlement in ${timeUntil(
            cycleProgress.nextSettlementAt,
            now,
          )}.`}
        />
      )}
    </>
  );

  return (
    <DashboardTile
      title="Today's Battles"
      periodNote="This cycle, compared with last"
      isLoading={false}
      error={null}
      content={content}
    />
  );
}
