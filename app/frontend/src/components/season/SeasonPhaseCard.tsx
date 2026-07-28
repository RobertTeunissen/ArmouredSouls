/**
 * Dashboard season card (Spec #45 R3.8, R4.4, R4.5, R17.4, R22.4).
 *
 * States it renders:
 *  - preparation: no battles scheduled, days remaining, what to do now
 *  - competitive cycle 1: matches scheduled, first battles run next cycle
 *  - competitive: season number, cycle, length, remaining cycles
 *
 * Cycle 1 is a scheduling cycle because every battle job executes previously
 * scheduled matches before scheduling new ones, so cycle 1 finds nothing due.
 * Saying so beats letting a player conclude the game is broken.
 */

import { Link } from 'react-router-dom';
import { useSeasonStore, selectSeason, selectSeasonFailed } from '../../stores/seasonStore';

export function SeasonPhaseCard() {
  const season = useSeasonStore(selectSeason);
  const failed = useSeasonStore(selectSeasonFailed);

  if (failed || !season) return null;

  if (season.phase === 'preparation') {
    return (
      <div
        className="mb-6 rounded-lg border border-amber-700/50 bg-amber-950/40 p-4"
        data-testid="season-preparation-card"
      >
        <h2 className="text-lg font-semibold text-amber-100">
          Season {season.seasonNumber} preparation — day {season.preparationDay}
        </h2>
        <p className="mt-1 text-sm text-amber-200/90">
          No competitive battles are scheduled during preparation.{' '}
          {season.remainingPreparationCycles === 0
            ? 'Competitive play resumes at the next settlement.'
            : `Competitive play resumes in ${season.remainingPreparationCycles} cycle(s).`}
        </p>
        <p className="mt-2 text-sm text-amber-200/80">
          Build your stable now: buy robots and weapons, upgrade facilities, allocate attributes
          and tuning, form teams, and subscribe your robots to events. Subscriptions set now take
          effect on the first competitive cycle.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link to="/changelog" className="text-amber-100 underline hover:text-white">
            What changed this season
          </Link>
          <Link to="/practice-arena" className="text-amber-100 underline hover:text-white">
            Test builds in the Practice Arena
          </Link>
        </div>
      </div>
    );
  }

  // Season 0 is the pre-season-system timeline. There is no season structure to
  // explain yet, so the card renders nothing — the season indicator in the nav
  // already shows "Season 0 · Cycle N" for anyone who cares. Real season framing
  // (preparation, cycle-1 scheduling, countdown) begins at the first rollover.
  if (season.isLegacy) return null;

  const isSchedulingCycle = season.seasonCycle === 1;

  return (
    <div
      className="mb-6 rounded-lg border border-white/10 bg-surface-elevated p-4"
      data-testid="season-phase-card"
    >
      <h2 className="text-lg font-semibold text-white">
        Season {season.seasonNumber} · Cycle {season.seasonCycle} of {season.seasonLengthCycles}
      </h2>
      <p className="mt-1 text-sm text-secondary">
        {season.remainingCompetitiveCycles} competitive cycle
        {season.remainingCompetitiveCycles === 1 ? '' : 's'} remaining before the season is
        archived and reset.
      </p>
      {isSchedulingCycle && (
        <p className="mt-2 text-sm text-amber-200">
          Matches for the season have been scheduled. The first battles run on the next cycle.
        </p>
      )}
    </div>
  );
}

export default SeasonPhaseCard;
