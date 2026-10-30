/**
 * Matchups: the row's win chance against the column at equal strength, by
 * range band, loadout or between the most used archetypes. Single-robot
 * comparisons only (1v1 and Free-for-all), so team modes have none.
 */
import { ADMIN_FOCUS_RING } from '../shared';
import type { ColumnMatchups, MatchupView } from './types';
import { MATCHUP_VIEW_OPTIONS, effectCellClass, formatWinRate, matchupEstimate, matchupLabel } from '../../../utils/adminWeaponsFormat';
import { formatCount } from '../../../utils/adminAttributesFormat';

export interface MatchupGridProps {
  matchups: ColumnMatchups | null;
  view: MatchupView;
  onViewChange: (view: MatchupView) => void;
}

export function MatchupGrid({ matchups, view, onViewChange }: MatchupGridProps): React.ReactElement {
  if (!matchups) {
    return (
      <p className="p-5 text-sm text-secondary">
        Matchups compare single robots, so they exist for 1v1 and Free-for-all battles only. Pick another mode to see them.
      </p>
    );
  }
  const grid = matchups.views[view];
  return (
    <div className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-secondary">Row&apos;s win % against the column at equal strength · {formatCount(matchups.comparisons)} single-robot comparisons</p>
        <div role="group" aria-label="Matchups by" className="flex flex-wrap gap-1">
          {MATCHUP_VIEW_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={view === o.key}
              onClick={() => onViewChange(o.key)}
              className={`min-h-11 rounded-md px-3 text-xs ${ADMIN_FOCUS_RING} ${view === o.key ? 'bg-surface-elevated text-white' : 'text-secondary hover:text-white'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {grid.labels.length < 2 ? (
        <p className="text-sm text-secondary">Too few archetypes fought in this window.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-separate border-spacing-1 text-sm">
            <caption className="sr-only">Win chance of each row against each column at equal strength.</caption>
            <thead>
              <tr>
                <td className="w-16 sm:w-24" />
                {grid.labels.map((label) => (
                  <th key={label} scope="col" className="pb-1 text-center text-[11px] font-normal leading-tight text-secondary">
                    vs {matchupLabel(view, label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.labels.map((label, i) => (
                <tr key={label}>
                  <th scope="row" className="pr-1 text-left text-xs font-normal leading-tight text-secondary sm:text-sm">{matchupLabel(view, label)}</th>
                  {grid.cells[i].map((cell, j) => {
                    if (i === j) {
                      return <td key={grid.labels[j]} className="h-10 rounded-md bg-background text-center text-tertiary"><span aria-hidden="true">—</span><span className="sr-only">same</span></td>;
                    }
                    const estimate = matchupEstimate(cell.winRate, cell.se, cell.significant);
                    return (
                      <td
                        key={grid.labels[j]}
                        title={`${matchupLabel(view, label)} vs ${matchupLabel(view, grid.labels[j])}: ${formatCount(cell.comparisons)} comparisons`}
                        className={`h-10 rounded-md text-center align-middle tabular-nums ${effectCellClass(estimate)}`}
                      >
                        {cell.winRate === null ? (
                          <span className="text-xs text-tertiary">too few</span>
                        ) : (
                          <span className={cell.significant ? 'font-semibold' : ''}>
                            {formatWinRate(cell.winRate)}
                            {!cell.significant && <span className="sr-only"> (not significant)</span>}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
