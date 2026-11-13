import { Link } from 'react-router-dom';
import type { StandingsPagination } from '@shared/types';

export interface StandingsPagerProps {
  pagination: StandingsPagination;
  hrefFor: (page: number) => string;
}

const linkClasses = 'inline-flex min-h-[44px] items-center rounded-lg border border-white/10 bg-surface px-4 text-sm text-white hover:bg-surface-elevated';
const disabledClasses = 'inline-flex min-h-[44px] items-center rounded-lg border border-white/5 px-4 text-sm text-tertiary';

/** Previous / page x of y / next, for the whole-tier view (an instance fits one page). */
export function StandingsPager({ pagination, hrefFor }: StandingsPagerProps) {
  const { page, totalPages } = pagination;
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Standings pages" className="mt-4 flex items-center justify-center gap-2" data-testid="standings-pager">
      {page > 1 ? <Link to={hrefFor(page - 1)} className={linkClasses}>Previous</Link> : <span className={disabledClasses} aria-hidden="true">Previous</span>}
      <span className="px-2 text-sm text-secondary">Page {page} of {totalPages}</span>
      {page < totalPages ? <Link to={hrefFor(page + 1)} className={linkClasses}>Next</Link> : <span className={disabledClasses} aria-hidden="true">Next</span>}
    </nav>
  );
}
