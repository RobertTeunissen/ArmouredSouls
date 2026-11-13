/**
 * Season_Countdown_Banner (Spec #45 R16).
 *
 * Warns players before a season ends, because the reset deletes everything they
 * own. Appears during the final Countdown_Cycles competitive cycles.
 *
 * One notice, styled as the site's warning notification (`DashboardNotification`,
 * warning variant), shown in two places so a player sees it once:
 * - `SeasonCountdownBanner`: below the navigation on every page except the
 *   Dashboard, inside the page container so it lines up with page content;
 * - `SeasonCountdownNotice`: in the Dashboard's notification list.
 *
 * Dismissal lasts for the remainder of the current cycle only — the notice
 * returns on the next cycle, since the warning gets more urgent, not less.
 */

import { Link, useLocation } from 'react-router-dom';
import { useSeasonStore, selectSeason, selectShouldShowCountdown, SEASON_COUNTDOWN_CYCLES } from '../../stores/seasonStore';
import DashboardNotification from '../DashboardNotification';

interface SeasonCountdownProps {
  /** Owner's user id, so the notice can link to their own season history. */
  userId?: number;
  countdownCycles?: number;
}

/** The countdown notice itself, or nothing outside the countdown window or once dismissed this cycle. */
export function SeasonCountdownNotice({
  userId,
  countdownCycles = SEASON_COUNTDOWN_CYCLES,
}: SeasonCountdownProps) {
  const season = useSeasonStore(selectSeason);
  const show = useSeasonStore(selectShouldShowCountdown(countdownCycles));
  const dismissBanner = useSeasonStore((s) => s.dismissBanner);

  if (!show || !season) return null;

  const remaining = season.remainingCompetitiveCycles;
  const cycleWord = remaining === 1 ? 'cycle' : 'cycles';

  return (
    <div role="alert" data-testid="season-countdown-banner">
      {/* Wraps rather than truncating — losing the cycle count would defeat the notice. */}
      <DashboardNotification
        variant="warning"
        icon="⏳"
        message={<span className="break-words">Season {season.seasonNumber} ends in {remaining} {cycleWord}</span>}
        detail={
          <span className="break-words">
            Every robot, weapon, facility, and standing will be archived and reset. Spend credits and finalize builds now.{' '}
            <Link
              to={userId ? `/stables/${userId}#season-history` : '/seasons'}
              className="font-medium underline underline-offset-2 hover:text-white"
            >
              View your season history
            </Link>
          </span>
        }
        onDismiss={dismissBanner}
        dismissLabel="Dismiss season countdown for this cycle"
      />
    </div>
  );
}

/** Site-wide placement below the navigation; the Dashboard shows the notice in its own list. */
function SeasonCountdownBanner(props: SeasonCountdownProps) {
  const location = useLocation();
  const show = useSeasonStore(selectShouldShowCountdown(props.countdownCycles ?? SEASON_COUNTDOWN_CYCLES));

  if (!show || location.pathname === '/dashboard') return null;

  // Full-width site background: pages paint their own, so the strip under the
  // navigation would otherwise show the body colour through the translucent warning.
  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 pt-4">
        <SeasonCountdownNotice {...props} />
      </div>
    </div>
  );
}

export default SeasonCountdownBanner;
