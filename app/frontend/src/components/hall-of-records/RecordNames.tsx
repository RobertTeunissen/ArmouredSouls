import { Link } from 'react-router-dom';
import OwnerNameLink from '../OwnerNameLink';
import { RecordStableName } from './RecordStableName';
import { robotPath } from '../../utils/robotRoutes';
import type { RecordHolder, RecordStableRef } from './types';

/**
 * The stable behind a record: a link to its profile when the id is known,
 * plain text otherwise. An Automaton stable carries its badge either way
 * (Spec #55 decision 42).
 */
export function RecordStable({ stable, className = '' }: { stable: RecordStableRef; className?: string }) {
  const name = stable.userId != null
    ? <OwnerNameLink userId={stable.userId} displayName={stable.name} stableType={stable.stableType} className={className} />
    : <RecordStableName name={stable.name} stableType={stable.stableType} />;
  if (stable.stableType !== 'generated') return name;
  // Generated_Stables carry the same "bot" chip as in the Season Archive, so a
  // player can tell a system stable from another player (never the Automaton_Badge).
  return (
    <span className="inline-flex min-w-0 max-w-full flex-nowrap items-baseline gap-1.5" data-testid="record-bot-stable">
      {name}
      <span className="shrink-0 rounded bg-surface-elevated px-1 text-[10px] uppercase leading-4 text-secondary">bot</span>
    </span>
  );
}

interface RecordSubjectProps {
  holder: RecordHolder;
  /** The logged-in player's id: their own robots open the Workshop. */
  viewerId: number | null;
  className?: string;
}

/** The robot, team or line-up that holds a record. Robots link to their page. */
export function RecordSubject({ holder, viewerId, className = '' }: RecordSubjectProps) {
  if (!holder.subjectName) return null;
  if (holder.robotId != null) {
    const isOwner = viewerId != null && holder.stable.userId === viewerId;
    return (
      <Link to={robotPath(holder.robotId, isOwner)} className={`text-primary hover:underline ${className}`}>
        {holder.subjectName}
      </Link>
    );
  }
  return <span className={`text-white ${className}`}>{holder.subjectName}</span>;
}

/**
 * "Robot · Stable" on one wrapping line, or just the stable for stable records.
 * The line wraps between the two names rather than truncating either.
 */
export function RecordHolderLine({ holder, viewerId }: { holder: RecordHolder; viewerId: number | null }) {
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
      {holder.subjectName && (
        <>
          <RecordSubject holder={holder} viewerId={viewerId} className="break-words" />
          <span className="text-tertiary" aria-hidden="true">·</span>
        </>
      )}
      <span className={holder.subjectName ? 'text-secondary' : ''}>
        <RecordStable stable={holder.stable} />
      </span>
    </span>
  );
}
