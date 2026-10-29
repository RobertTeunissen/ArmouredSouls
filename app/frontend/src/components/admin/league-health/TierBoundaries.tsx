/**
 * Tier boundaries this season: promoted, demoted, and how many promotions
 * bounced back (demoted back across the same boundary within the window).
 * A table from md up, one card per boundary below.
 */
import type { ReactNode } from 'react';
import type { LeagueSeasonOverview, SeasonBoundary } from '../../../utils/adminLeagueHealthApi';
import {
  bounceFractionText,
  bounceNote,
  bounceShareText,
  boundaryLabel,
  formatCount,
} from '../../../utils/adminLeagueHealthFormat';

export interface TierBoundariesProps {
  season: LeagueSeasonOverview;
  /** "robots" or "teams". */
  noun: string;
}

function ShareBar({ boundary, className = '' }: { boundary: SeasonBoundary; className?: string }): ReactNode {
  if (boundary.share === null) return null;
  return (
    <span className={`block h-1.5 overflow-hidden rounded-full bg-surface-elevated ${className}`} aria-hidden="true">
      <span
        className={`block h-full rounded-full ${boundary.noted ? 'bg-warning' : 'bg-tertiary'}`}
        style={{ width: `${Math.min(100, boundary.share * 100)}%` }}
      />
    </span>
  );
}

export function TierBoundaries({ season, noun }: TierBoundariesProps): ReactNode {
  const judgedNote = season.judgedThroughCycle === null
    ? `of promotions at least ${season.window} cycles old`
    : `of promotions up to cycle ${season.judgedThroughCycle}`;

  return (
    <div data-testid="season-boundaries">
      <table className="hidden w-full text-sm md:table">
        <caption className="sr-only">Tier boundaries this season: promotions, demotions and bounce-back within {season.window} cycles</caption>
        <thead>
          <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wide text-secondary">
            <th scope="col" className="px-3 py-2">Boundary</th>
            <th scope="col" className="px-3 py-2 text-right">Promoted</th>
            <th scope="col" className="px-3 py-2 text-right">Demoted</th>
            <th scope="col" className="px-3 py-2 text-right" colSpan={2}>
              Back within {season.window} cycles
              <span className="block font-normal normal-case tracking-normal">{judgedNote}</span>
            </th>
            <th scope="col" className="px-3 py-2">Note</th>
          </tr>
        </thead>
        <tbody>
          {season.boundaries.map((boundary) => {
            const note = bounceNote(boundary, season, noun);
            return (
              <tr key={boundary.lower} className="border-b border-white/5" data-testid={`season-boundary-${boundary.lower}`}>
                <th scope="row" className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-white">{boundaryLabel(boundary)}</th>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatCount(boundary.promoted)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatCount(boundary.demoted)}</td>
                <td className="w-32 px-3 py-2.5"><ShareBar boundary={boundary} /></td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  <span className={`block font-semibold tabular-nums ${boundary.noted ? 'text-warning' : boundary.share === null ? 'text-tertiary' : 'text-white'}`}>
                    {bounceShareText(boundary)}
                  </span>
                  <span className="block text-xs text-secondary">{bounceFractionText(boundary)}</span>
                </td>
                <td className={`px-3 py-2.5 text-sm ${boundary.noted ? 'text-warning' : 'text-secondary'}`}>{note ?? ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="space-y-2.5 md:hidden" aria-label="Tier boundaries">
        <li className="text-xs text-secondary">Back within {season.window} cycles, {judgedNote}</li>
        {season.boundaries.map((boundary) => {
          const note = bounceNote(boundary, season, noun);
          return (
            <li key={boundary.lower} className="rounded-md bg-background p-3" data-testid={`season-boundary-card-${boundary.lower}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-white">{boundaryLabel(boundary)}</span>
                <span className={`text-sm font-semibold tabular-nums ${boundary.noted ? 'text-warning' : boundary.share === null ? 'text-tertiary' : 'text-white'}`}>
                  {bounceShareText(boundary)}
                </span>
              </div>
              <p className="mt-1 text-xs text-secondary">
                {formatCount(boundary.promoted)} promoted · {formatCount(boundary.demoted)} demoted · {bounceFractionText(boundary)}
              </p>
              <ShareBar boundary={boundary} className="mt-2" />
              {note && <p className={`mt-2 text-xs ${boundary.noted ? 'text-warning' : 'text-secondary'}`}>{note}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
