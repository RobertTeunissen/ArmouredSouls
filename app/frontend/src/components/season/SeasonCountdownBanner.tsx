/**
 * Season_Countdown_Banner (Spec #45 R16).
 *
 * Warns players before a season ends, because the reset deletes everything they
 * own. Appears during the final Countdown_Cycles competitive cycles.
 *
 * Dismissal lasts for the remainder of the current cycle only — the banner
 * returns on the next cycle, since the warning gets more urgent, not less.
 */

import { Link } from 'react-router-dom';
import { useSeasonStore, selectSeason } from '../../stores/seasonStore';

/** Mirrors the backend `COUNTDOWN_CYCLES` default. */
const DEFAULT_COUNTDOWN_CYCLES = 7;

interface SeasonCountdownBannerProps {
  /** Owner's user id, so the banner can link to their own season history. */
  userId?: number;
  countdownCycles?: number;
}

export function SeasonCountdownBanner({
  userId,
  countdownCycles = DEFAULT_COUNTDOWN_CYCLES,
}: SeasonCountdownBannerProps) {
  const season = useSeasonStore(selectSeason);
  const dismissed = useSeasonStore((s) => s.dismissedBanner);
  const dismissBanner = useSeasonStore((s) => s.dismissBanner);

  if (!season || season.phase !== 'competitive' || season.isLegacy) return null;
  if (season.remainingCompetitiveCycles > countdownCycles) return null;
  if (
    dismissed &&
    dismissed.seasonNumber === season.seasonNumber &&
    dismissed.seasonCycle === season.seasonCycle
  ) {
    return null;
  }

  const remaining = season.remainingCompetitiveCycles;
  const cycleWord = remaining === 1 ? 'cycle' : 'cycles';

  return (
    <div
      role="alert"
      data-testid="season-countdown-banner"
      className="flex flex-col gap-2 border-b border-amber-700/60 bg-amber-950/70 px-4 py-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between"
    >
      {/* Wraps rather than truncating — losing the cycle count would defeat the banner. */}
      <p className="break-words">
        <span className="font-semibold">Season {season.seasonNumber} ends in {remaining} {cycleWord}.</span>{' '}
        Every robot, weapon, facility, and standing will be archived and reset.{' '}
        <Link
          to={userId ? `/stables/${userId}#season-history` : '/seasons'}
          className="underline underline-offset-2 hover:text-white"
        >
          View your season history
        </Link>
      </p>
      <button
        type="button"
        onClick={dismissBanner}
        // 44px minimum touch target.
        className="min-h-[44px] min-w-[44px] shrink-0 self-start rounded px-3 py-2 text-amber-200 hover:bg-amber-900/60 hover:text-white sm:self-auto"
        aria-label="Dismiss season countdown for this cycle"
      >
        Dismiss
      </button>
    </div>
  );
}

export default SeasonCountdownBanner;
