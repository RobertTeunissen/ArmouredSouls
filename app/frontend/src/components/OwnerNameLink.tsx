import { Link } from 'react-router-dom';
import AutomatonBadge from './AutomatonBadge';
import type { StableType } from '../types/stable';

interface OwnerNameLinkProps {
  userId: number;
  displayName: string;
  className?: string;
  /** Spec #55: Stable_Type of the owning stable; `automaton` adds the Automaton_Badge. */
  stableType?: StableType | null;
}

function OwnerNameLink({ userId, displayName, className = '', stableType }: OwnerNameLinkProps) {
  const link = (
    <Link
      to={`/stables/${userId}`}
      className={`text-primary hover:underline transition-colors ${className}`}
    >
      {displayName}
    </Link>
  );

  if (stableType !== 'automaton') return link;

  // The badge sits on the name's line: the wrapper never wraps and the name
  // truncates (min-w-0) before the badge would move to a line of its own.
  return (
    <span className="inline-flex min-w-0 max-w-full flex-nowrap items-center gap-1.5 align-middle">
      <Link
        to={`/stables/${userId}`}
        className={`min-w-0 truncate text-primary hover:underline transition-colors ${className}`}
      >
        {displayName}
      </Link>
      <AutomatonBadge stableType={stableType} />
    </span>
  );
}

export default OwnerNameLink;
