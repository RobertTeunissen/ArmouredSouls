/**
 * The running tournament of one type: round and stage, a segmented round bar,
 * size and dates, today's round, first-round byes, schedule status, and links
 * to the player bracket and the tournament battles.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_FOCUS_RING } from '../shared';
import type { TournamentTypeOverview } from '../../../utils/adminTournamentsApi';
import {
  bracketHref,
  currentRoundText,
  firstRoundByesText,
  formatCount,
  participantNoun,
  shortDate,
  statusText,
  tournamentBattlesHref,
  typeLabel,
} from '../../../utils/adminTournamentsFormat';

export interface TournamentNowCardProps {
  entry: TournamentTypeOverview;
  stalledAfterHours: number;
}

const LEVEL_STYLES = {
  ok: { dot: 'bg-success', text: 'text-success', border: 'border-white/10' },
  warning: { dot: 'bg-warning', text: 'text-warning', border: 'border-warning/50' },
  info: { dot: 'bg-secondary', text: 'text-secondary', border: 'border-white/10' },
} as const;

function TypeTag({ entry }: { entry: TournamentTypeOverview }): ReactNode {
  return (
    <span className="rounded bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">{typeLabel(entry.type)}</span>
  );
}

export function TournamentNowCard({ entry, stalledAfterHours }: TournamentNowCardProps): ReactNode {
  const current = entry.current;
  if (!current) {
    return (
      <article className="rounded-lg border border-white/10 bg-surface p-4" data-testid={`tournament-now-${entry.type}`}>
        <div className="flex items-center gap-2"><TypeTag entry={entry} /><h3 className="text-sm font-semibold text-white">No {typeLabel(entry.type)} tournament running</h3></div>
        <p className="mt-2 text-sm text-secondary">
          The next one is created by the {typeLabel(entry.type)} tournament job{entry.jobTime ? ` (${entry.jobTime} UTC)` : ''} once enough {participantNoun(entry.type)} are subscribed.
        </p>
      </article>
    );
  }

  const status = statusText(current, stalledAfterHours);
  const styles = LEVEL_STYLES[current.status.level];
  const noun = participantNoun(entry.type, current.participants);

  return (
    <article className={`flex flex-col rounded-lg border bg-surface p-4 ${styles.border}`} data-testid={`tournament-now-${entry.type}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <TypeTag entry={entry} />
          <h3 className="truncate text-sm font-semibold text-white">{current.name}</h3>
        </div>
        <span className={`flex shrink-0 items-center gap-1.5 text-xs font-medium ${styles.text}`}>
          <span className={`h-2 w-2 rounded-full ${styles.dot}`} aria-hidden="true" />
          {status.label}
        </span>
      </div>

      <p className="mt-3 text-base">
        <span className="font-semibold text-white">Round {current.round} of {current.maxRounds}</span>
        <span className="text-sm text-secondary"> · {current.stage}</span>
      </p>
      <div className="mt-2 flex gap-[3px]" role="img" aria-label={`${current.round - 1} of ${current.maxRounds} rounds done, round ${current.round} next`}>
        {Array.from({ length: current.maxRounds }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-sm ${index < current.round - 1 ? 'bg-success' : index === current.round - 1 ? 'bg-primary' : 'bg-surface-elevated'}`}
          />
        ))}
      </div>

      <dl className="mt-3 space-y-1 text-sm text-secondary">
        <div>
          <dt className="sr-only">Size and dates</dt>
          <dd>
            <span className="text-white">{formatCount(current.participants)}</span> {noun} · started {shortDate(current.startedAt)}
            {current.expectedFinish && <> · finishes <span className="text-white">{shortDate(current.expectedFinish)}</span></>}
          </dd>
        </div>
        <div><dt className="sr-only">Current round</dt><dd>{currentRoundText(current, entry.jobTime)}</dd></div>
        <div><dt className="sr-only">First round</dt><dd>First-round byes: {firstRoundByesText(current)}</dd></div>
      </dl>

      {status.details.length > 0 && (
        <ul className="mt-3 space-y-1 rounded border border-warning/30 bg-warning/[0.08] px-3 py-2 text-xs text-warning" data-testid="tournament-status-details">
          {status.details.map((detail) => <li key={detail}>{detail}</li>)}
        </ul>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/5 pt-1 text-sm">
        <Link to={bracketHref(current.id)} className={`flex min-h-11 items-center text-primary hover:underline ${ADMIN_FOCUS_RING}`}>
          Bracket <span aria-hidden="true">&nbsp;→</span>
        </Link>
        <Link to={tournamentBattlesHref(entry.type)} className={`flex min-h-11 items-center text-primary hover:underline ${ADMIN_FOCUS_RING}`}>
          Tournament battles <span aria-hidden="true">&nbsp;→</span>
        </Link>
      </div>
    </article>
  );
}
