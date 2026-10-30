/**
 * This season of one tournament type: completed, average length, champions
 * who are players, participants per tournament, champion stables and the
 * last five champions.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_FOCUS_RING } from '../shared';
import type { TournamentTypeOverview } from '../../../utils/adminTournamentsApi';
import {
  averageDaysText,
  bracketHref,
  formatCount,
  participantNoun,
  playerChampionsText,
  shortDate,
  stableHref,
  stableName,
  stableTypeLabel,
  typeLabel,
} from '../../../utils/adminTournamentsFormat';

export interface TournamentSeasonPanelProps {
  entry: TournamentTypeOverview;
}

function StableLink({ stableId, name }: { stableId: number | null; name: string }): ReactNode {
  if (stableId === null) return <span className="text-secondary">{name}</span>;
  return <Link to={stableHref(stableId)} className={`text-primary hover:underline ${ADMIN_FOCUS_RING}`}>{name}</Link>;
}

function SizeChart({ entry }: { entry: TournamentTypeOverview }): ReactNode {
  const { sizes } = entry.season;
  if (sizes.length === 0) return <p className="text-sm text-secondary">No tournaments yet this season.</p>;
  const peak = Math.max(1, ...sizes.map((size) => size.participants));
  const noun = participantNoun(entry.type);
  const first = sizes[0];
  const last = sizes[sizes.length - 1];
  return (
    <figure>
      <div className="flex h-20 items-end justify-center gap-1" role="img" aria-label={`${noun} per tournament, oldest first: ${sizes.map((s) => s.participants).join(', ')}`}>
        {sizes.map((size) => (
          <span
            key={size.tournamentId}
            title={`${formatCount(size.participants)} ${noun}${size.current ? ' (running)' : ''}`}
            className={`min-w-0 max-w-7 flex-1 rounded-t-sm ${size.current ? 'bg-primary' : 'bg-tertiary'}`}
            style={{ height: `${Math.max(3, (size.participants / peak) * 100)}%` }}
          />
        ))}
      </div>
      <figcaption className="mt-1 flex justify-between border-t border-tertiary pt-1 text-xs text-secondary">
        <span>{formatCount(first.participants)}</span>
        <span className={last.current ? 'text-primary' : ''}>{formatCount(last.participants)}{last.current ? ' now' : ''}</span>
      </figcaption>
    </figure>
  );
}

export function TournamentSeasonPanel({ entry }: TournamentSeasonPanelProps): ReactNode {
  const { season } = entry;
  const label = typeLabel(entry.type);

  return (
    <section aria-labelledby={`tournament-season-${entry.type}`} className="space-y-5 rounded-lg border border-white/10 bg-surface p-4" data-testid={`tournament-season-${entry.type}`}>
      <h3 id={`tournament-season-${entry.type}`} className="text-sm font-semibold text-white">{label} tournaments</h3>

      <dl className="grid grid-cols-3 gap-3">
        {/* flex-col-reverse: the value reads above its label while dt stays first for screen readers */}
        <div className="flex flex-col-reverse"><dt className="text-xs text-secondary">completed</dt><dd className="text-lg font-semibold text-white">{formatCount(season.completed)}</dd></div>
        <div className="flex flex-col-reverse"><dt className="text-xs text-secondary">days on average</dt><dd className="text-lg font-semibold text-white">{averageDaysText(season.averageDays)}</dd></div>
        <div className="flex flex-col-reverse"><dt className="text-xs text-secondary">won by players</dt><dd className="text-lg font-semibold text-white">{season.completed > 0 ? playerChampionsText(entry) : '—'}</dd></div>
      </dl>

      <div>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-secondary">{participantNoun(entry.type)} per tournament</h4>
        <SizeChart entry={entry} />
      </div>

      <div>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-secondary">Champion stables</h4>
        {season.championStables.length === 0 ? (
          <p className="text-sm text-secondary">No completed {label} tournament yet.</p>
        ) : (
          <ul className="space-y-1.5" aria-label={`${label} champion stables`}>
            {season.championStables.map((stable) => (
              <li key={stable.stableId ?? stableName(stable)} className="grid grid-cols-[minmax(0,1fr)_5rem_4.5rem] items-center gap-3 text-sm">
                <span className="truncate"><StableLink stableId={stable.stableId} name={stableName(stable)} /></span>
                <span className="block h-1.5 overflow-hidden rounded-full bg-surface-elevated" aria-hidden="true">
                  <span className="block h-full rounded-full bg-primary/70" style={{ width: `${(stable.titles / Math.max(1, season.completed)) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums text-white">{stable.titles} of {season.completed}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {season.recentChampions.length > 0 && (
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-secondary">Recent champions</h4>
          <ul className="space-y-1 text-xs" aria-label={`Recent ${label} champions`}>
            {season.recentChampions.map((champion) => (
              <li key={champion.tournamentId} className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-baseline gap-2">
                <Link to={bracketHref(champion.tournamentId)} className={`text-secondary hover:text-white hover:underline ${ADMIN_FOCUS_RING}`}>
                  {champion.name.replace(/^.*?(#\d+)$/, '$1')} · {shortDate(champion.completedAt)}
                </Link>
                <span className="truncate text-white" title={stableTypeLabel(champion.stableType)}>{champion.champion ?? 'Deleted'}</span>
                <span className="truncate text-right"><StableLink stableId={champion.stableId} name={champion.stableName ?? 'Unknown stable'} /></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
