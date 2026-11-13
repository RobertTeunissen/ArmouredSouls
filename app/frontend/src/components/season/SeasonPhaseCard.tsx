/**
 * Dashboard season notice (Spec #45 R3.8, R4.4, R4.5, R17.4, R22.4).
 *
 * States it renders:
 *  - preparation: no battles scheduled, cycles remaining, what to do now
 *  - competitive cycle 1: matches scheduled, first battles run next cycle
 *  - otherwise nothing (the navigation already shows "Season N · Cycle X / Y")
 *
 * Styled as the site's notification (`DashboardNotification`, info variant) and
 * rendered at the top of the Dashboard's notification list, so it matches every
 * other notice a player sees instead of carrying its own palette.
 *
 * Cycle 1 is a scheduling cycle because every battle job executes previously
 * scheduled matches before scheduling new ones, so cycle 1 finds nothing due.
 * Saying so beats letting a player conclude the game is broken.
 */

import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { useSeasonStore, selectSeason, selectSeasonFailed } from '../../stores/seasonStore';
import DashboardNotification from '../DashboardNotification';

const LINK_CLASS = 'font-medium underline underline-offset-2 hover:text-white';

function cycles(count: number): string {
  return `${count} ${count === 1 ? 'cycle' : 'cycles'}`;
}

function SeasonPhaseCard(): JSX.Element | null {
  const season = useSeasonStore(selectSeason);
  const failed = useSeasonStore(selectSeasonFailed);

  if (failed || !season) return null;

  if (season.phase === 'preparation') {
    const resumes = season.remainingPreparationCycles === 0
      ? 'Competitive play resumes at the next settlement.'
      : `Competitive play resumes in ${cycles(season.remainingPreparationCycles)}.`;

    return (
      <div data-testid="season-preparation-card">
        <DashboardNotification
          variant="info"
          icon="🛠️"
          message={
            <span className="break-words">
              Season {season.seasonNumber} preparation · day {season.preparationDay}
            </span>
          }
          detail={
            <span className="break-words">
              No competitive battles are scheduled during preparation. {resumes} Build your
              stable now: buy robots and weapons, upgrade facilities, allocate attributes and
              tuning, form teams, and subscribe your robots to events. Subscriptions set now take
              effect on the first competitive cycle.
              <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                <Link to="/changelog" className={LINK_CLASS}>
                  What changed this season
                </Link>
                <Link to="/practice-arena" className={LINK_CLASS}>
                  Test builds in the Practice Arena
                </Link>
              </span>
            </span>
          }
        />
      </div>
    );
  }

  // Season 0 is the pre-season-system timeline. There is no season structure to
  // explain yet, so nothing renders — the season indicator in the nav already
  // shows "Season 0 · Cycle N" for anyone who cares. Real season framing
  // (preparation, cycle-1 scheduling, countdown) begins at the first rollover.
  if (season.isLegacy) return null;

  // From cycle 2 onward the navbar already shows "Season N · Cycle X / Y", so
  // repeating it here is redundant. Only show during cycle 1 (scheduling
  // notice) — preparation is handled above.
  if (season.seasonCycle !== 1) return null;

  return (
    <div data-testid="season-phase-card">
      <DashboardNotification
        variant="info"
        icon="📅"
        message={
          <span className="break-words">
            Season {season.seasonNumber} · Cycle 1 of {season.seasonLengthCycles}
          </span>
        }
        detail={
          <span className="break-words">
            Matches for the season have been scheduled. The first battles run on the next cycle.{' '}
            {cycles(season.remainingCompetitiveCycles)} of competitive play remain before the
            season is archived and reset.
          </span>
        }
      />
    </div>
  );
}

export default SeasonPhaseCard;
