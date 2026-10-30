/**
 * TournamentsPage — are the three tournaments (1v1, 2v2, 3v3) on schedule,
 * when do they finish, and who wins them this season (`/admin/tournaments`).
 *
 * Sections: toolbar (UTC, Refresh), "Now" (one card per type with round,
 * schedule status and expected finish), "This season" (one panel per type:
 * completed, average length, participants per tournament, champion stables,
 * recent champions) and a balance note when one stable holds most titles.
 * Brackets live on the player tournament page; battles on Battles.
 * Data: `GET /api/admin/tournaments/overview`.
 *
 * Definitions: docs/guides/ADMIN_PANEL_GUIDE.md §Tournaments.
 */
import { Link } from 'react-router-dom';
import { TournamentNowCard, TournamentSeasonPanel } from '../../components/admin/tournaments';
import { ADMIN_FOCUS_RING, PanelError, PanelSkeleton } from '../../components/admin/shared';
import { useTournamentOverview } from '../../hooks/useTournamentOverview';
import { formatUtcTime } from '../../utils/adminDashboardFormat';
import { dominanceNote, stableHref } from '../../utils/adminTournamentsFormat';

function TournamentsPage(): React.ReactElement {
  const { data, loading, error, reload } = useTournamentOverview();
  const refreshing = loading && data !== null;
  const note = data ? dominanceNote(data.types) : null;

  return (
    <div data-testid="admin-tournaments-page" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-white/10 bg-surface-elevated px-3 py-1 text-xs text-secondary">All times UTC</span>
          <span className="text-xs text-tertiary">One round per daily cycle · emptied at season rollover</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-xs text-secondary" aria-live="polite">
            {refreshing ? 'Refreshing…' : data ? `Last updated ${formatUtcTime(data.generatedAt, true)}` : 'Not loaded yet'}
          </span>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className={`min-h-11 whitespace-nowrap rounded-md border border-white/10 bg-surface-elevated px-3 text-sm text-white hover:bg-white/10 disabled:opacity-60 ${ADMIN_FOCUS_RING}`}
          >
            <span aria-hidden="true">↻ </span>Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-white/10 bg-surface">
          <PanelError message={data ? `${error} Showing the data from ${formatUtcTime(data.generatedAt, true)}.` : error} onRetry={reload} />
        </div>
      )}

      {!data && loading && (
        <div className="rounded-lg border border-white/10 bg-surface"><PanelSkeleton rows={6} /></div>
      )}

      {data && (
        <>
          <section aria-labelledby="tournaments-now-heading" className="space-y-3">
            <h2 id="tournaments-now-heading" className="text-base font-semibold text-white">Now</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {data.types.map((entry) => (
                <TournamentNowCard key={entry.type} entry={entry} stalledAfterHours={data.thresholds.stalledAfterHours} />
              ))}
            </div>
          </section>

          <section aria-labelledby="tournaments-season-heading" className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 id="tournaments-season-heading" className="text-base font-semibold text-white">This season</h2>
              <p className="text-xs text-secondary">Completed tournaments · champions link to the player detail</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {data.types.map((entry) => <TournamentSeasonPanel key={entry.type} entry={entry} />)}
            </div>
          </section>

          {note && (
            <aside className="flex gap-3 rounded-lg border border-warning/35 bg-warning/[0.08] px-4 py-3" data-testid="tournament-dominance-note">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-white">{note.stables.length === 1 ? 'One stable wins most titles' : 'A few stables win most titles'}</p>
                <p className="text-sm text-secondary">
                  {note.stables.map((stable, index) => (
                    <span key={stable.stableId ?? stable.stableName}>
                      {index > 0 && '; '}
                      {stable.stableId !== null
                        ? <Link to={stableHref(stable.stableId)} className={`text-primary hover:underline ${ADMIN_FOCUS_RING}`}>{stable.stableName}</Link>
                        : stable.stableName}
                      {' '}won {stable.parts.join(' and ')}
                    </span>
                  ))}
                  {' '}tournaments this season{note.playersOnly ? '; no generated or Automaton stable has won any' : ''}. A note for balance, not an action item.
                </p>
              </div>
            </aside>
          )}

          <p className="text-xs text-secondary">
            Finish dates assume one round per daily cycle. "On schedule": a match finished within the last {data.thresholds.stalledAfterHours} hours
            (or the tournament started then) and no match of an earlier round is left behind; otherwise the card turns amber with the reason.
            Brackets are on the player tournament page; tournament battles on Battles.
          </p>
        </>
      )}
    </div>
  );
}

export default TournamentsPage;
