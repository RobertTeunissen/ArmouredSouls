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

export function SeasonProgressIndicator({
  compact = false,
  className = '',
}: SeasonProgressIndicatorProps) {
  const season = useSeasonStore(selectSeason);
  const failed = useSeasonStore(selectSeasonFailed);

  if (failed || !season) return null;

  const isPreparing = season.phase === 'preparation';

  // Season 0 has no fixed length, so it advertises no denominator.
  const label = season.isLegacy
    ? compact
      ? `S0 · C${season.seasonCycle}`
      : `Season 0 · Cycle ${season.seasonCycle}`
    : isPreparing
      ? compact
        ? `S${season.seasonNumber} · Prep ${season.preparationDay}`
        : `Season ${season.seasonNumber} · Preparation ${season.preparationDay}`
      : compact
        ? `S${season.seasonNumber} · ${season.seasonCycle}/${season.seasonLengthCycles}`
        : `Season ${season.seasonNumber} · Cycle ${season.seasonCycle} / ${season.seasonLengthCycles}`;

  const title = season.isLegacy
    ? 'Season 0 is the timeline that ran before seasons existed. It has no fixed length.'
    : isPreparing
      ? `Preparation window — no battles are scheduled. ${season.remainingPreparationCycles} cycle(s) remaining.`
      : `${season.remainingCompetitiveCycles} competitive cycle(s) remaining this season.`;

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded px-2 py-1 text-xs font-medium ${
        isPreparing
          ? 'bg-amber-900/40 text-amber-200'
          : 'bg-slate-800/60 text-slate-300'
      } ${className}`}
      title={title}
      data-testid="season-progress-indicator"
      aria-label={title}
    >
      {label}
    </span>
  );
}

export default SeasonProgressIndicator;
