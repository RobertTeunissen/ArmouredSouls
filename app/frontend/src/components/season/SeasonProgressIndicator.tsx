/**
 * Season_Progress_Indicator (Spec #45 R17).
 *
 * Persistent statement of which season is running and how far into it we are,
 * so a player never has to count days. Rendered in the navigation on every
 * authenticated page.
 *
 * Reads every value from the season endpoint. When that read fails the
 * indicator hides itself — a stale cycle number is worse than none.
 */

import { useSeasonStore, selectSeason, selectSeasonFailed } from '../../stores/seasonStore';

interface SeasonProgressIndicatorProps {
  /** Compact rendering for viewports below 1024px. */
  compact?: boolean;
  className?: string;
}

function SeasonProgressIndicator({
  compact = false,
  className = '',
}: SeasonProgressIndicatorProps) {
  const season = useSeasonStore(selectSeason);
  const failed = useSeasonStore(selectSeasonFailed);

  if (failed || !season) return null;

  const isPreparing = season.phase === 'preparation';

  // Season 0 has no fixed length, so it advertises no denominator.
  const shortLabel = season.isLegacy
    ? `S0 · C${season.seasonCycle}`
    : isPreparing
      ? `S${season.seasonNumber} · Prep ${season.preparationDay}`
      : `S${season.seasonNumber} · ${season.seasonCycle}/${season.seasonLengthCycles}`;
  const longLabel = season.isLegacy
    ? `Season 0 · Cycle ${season.seasonCycle}`
    : isPreparing
      ? `Season ${season.seasonNumber} · Preparation ${season.preparationDay}`
      : `Season ${season.seasonNumber} · Cycle ${season.seasonCycle} / ${season.seasonLengthCycles}`;

  const title = season.isLegacy
    ? 'Season 0 is the timeline that ran before seasons existed. It has no fixed length.'
    : isPreparing
      ? `Preparation window — no battles are scheduled. ${season.remainingPreparationCycles} cycle(s) remaining.`
      : `${season.remainingCompetitiveCycles} competitive cycle(s) remaining this season.`;

  // Same chip as the credits display next to it (surface fill, white/10 border,
  // matching size per layout). Preparation is marked by a warning-token dot,
  // not by recolouring the chip (issue #602: the raw amber/slate palette
  // didn't match the rest of the site).
  const size = compact ? 'gap-1.5 px-1.5 py-1 sm:px-2' : 'gap-2 px-3 py-2';

  return (
    <span
      className={`inline-flex min-w-0 items-center whitespace-nowrap rounded-md border border-white/10 bg-surface text-sm font-medium text-secondary ${size} ${className}`}
      title={title}
      data-testid="season-progress-indicator"
      data-phase={isPreparing ? 'preparation' : 'competitive'}
      aria-label={title}
    >
      {isPreparing && (
        <span aria-hidden="true" data-testid="season-preparation-dot" className="h-2 w-2 shrink-0 rounded-full bg-warning" />
      )}
      {compact ? (
        <span className="truncate">{shortLabel}</span>
      ) : (
        // The desktop bar only has room for the long label from 1440 px: at
        // 1280 px it pushed Logout off the screen (E2E overflow check).
        <>
          <span className="truncate min-[1440px]:hidden">{shortLabel}</span>
          <span className="hidden truncate min-[1440px]:inline">{longLabel}</span>
        </>
      )}
    </span>
  );
}

export default SeasonProgressIndicator;
