/**
 * Promotions (up) and demotions (down) per cycle this season, on one scale.
 * A cycle in which the mode recorded no moves at all gets a dashed marker; the
 * list under the chart links those cycles to Cycle Controls' run history.
 * Screen readers get the same numbers as a table.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_FOCUS_RING } from '../shared';
import type { LeagueSeasonOverview } from '../../../utils/adminLeagueHealthApi';
import { formatCount, joinList } from '../../../utils/adminLeagueHealthFormat';

export interface SeasonTrendProps {
  season: LeagueSeasonOverview;
  label: string;
}

/** Height of the promotion area at the season's busiest cycle. */
const UP_PX = 144;
const LABEL_EVERY = 10;

export function SeasonTrend({ season, label }: SeasonTrendProps): ReactNode {
  const peakUp = Math.max(1, ...season.cycles.map((c) => c.promoted));
  const peakDown = Math.max(0, ...season.cycles.map((c) => c.demoted));
  // One scale for both directions, so demotions look as big as they are.
  const scale = UP_PX / peakUp;
  const downPx = Math.max(12, Math.round(peakDown * scale));
  const quiet = new Set(season.quietCycles);

  return (
    <figure className="space-y-2" aria-label={label}>
      <div className="flex gap-2">
        <div className="flex w-8 shrink-0 flex-col justify-between text-right text-[10px] text-secondary tabular-nums" aria-hidden="true">
          <span style={{ height: UP_PX }} className="flex flex-col justify-between">
            <span>{formatCount(peakUp)}</span>
            <span>0</span>
          </span>
          <span style={{ height: downPx }} className="flex items-end justify-end">{peakDown > 0 ? formatCount(peakDown) : ''}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex gap-px" aria-hidden="true" data-testid="season-trend-bars">
            {season.cycles.map((cycle) => {
              const isQuiet = quiet.has(cycle.cycle);
              return (
                <div
                  key={cycle.cycle}
                  className={`relative flex min-w-0 flex-1 flex-col ${isQuiet ? 'border-l border-dashed border-warning' : ''}`}
                  title={isQuiet ? `Cycle ${cycle.cycle}: no moves recorded` : `Cycle ${cycle.cycle}: ${cycle.promoted} promoted, ${cycle.demoted} demoted`}
                  data-quiet={isQuiet || undefined}
                >
                  {isQuiet && <span className="absolute -left-[3px] -top-1 h-1.5 w-1.5 rounded-full bg-warning" />}
                  <div className="flex items-end" style={{ height: UP_PX }}>
                    <div className="w-full bg-success/80" style={{ height: cycle.promoted * scale }} />
                  </div>
                  <div className="h-px bg-tertiary" />
                  <div className="flex items-start" style={{ height: downPx }}>
                    <div className="w-full bg-error/75" style={{ height: cycle.demoted * scale }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex gap-px text-[10px] text-secondary" aria-hidden="true">
            {season.cycles.map((cycle) => (
              <div key={cycle.cycle} className="relative min-w-0 flex-1">
                {cycle.cycle % LABEL_EVERY === 0 && (
                  <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap tabular-nums">{cycle.cycle}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-xs text-secondary">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success" aria-hidden="true" />Promotions</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-error" aria-hidden="true" />Demotions</span>
        {season.quietCycles.length > 0 && (
          <span className="flex items-center gap-1.5" data-testid="season-quiet-cycles">
            <span className="h-2.5 w-2.5 rounded-full bg-warning" aria-hidden="true" />
            <span>
              No moves recorded in {season.quietCycles.length === 1 ? 'cycle' : 'cycles'} {joinList(season.quietCycles.map(String))}
              {' · '}
              <Link to="/admin/cycles" className={`text-primary hover:underline ${ADMIN_FOCUS_RING}`}>
                Run history in Cycle Controls <span aria-hidden="true">→</span>
              </Link>
            </span>
          </span>
        )}
      </figcaption>

      {/* sr-only on the wrapper: a table ignores width and overflow, so it would widen the page. */}
      <div className="sr-only">
      <table>
        <caption>{label}, promotions and demotions per cycle</caption>
        <thead><tr><th scope="col">Cycle</th><th scope="col">Promotions</th><th scope="col">Demotions</th></tr></thead>
        <tbody>
          {season.cycles.map((cycle) => (
            <tr key={cycle.cycle}>
              <th scope="row">{cycle.cycle}</th>
              <td>{quiet.has(cycle.cycle) ? 'no moves recorded' : cycle.promoted}</td>
              <td>{quiet.has(cycle.cycle) ? '' : cycle.demoted}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
