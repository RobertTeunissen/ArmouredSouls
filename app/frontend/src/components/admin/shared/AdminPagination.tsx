/**
 * Previous / Next pagination of admin lists, with "Showing a–b of N" and
 * 44 px touch targets. The buttons are named "Previous page of {noun}" and
 * "Next page of {noun}" for assistive tech.
 */
import type { ReactNode } from 'react';
import { ADMIN_FOCUS_RING } from './focusRing';

export interface AdminPaginationProps {
  page: number;
  total: number;
  pageSize: number;
  loading: boolean;
  onPage: (page: number) => void;
  /** Plural noun of the rows ("battles", "phrases"). */
  noun?: string;
  /** Pages; derived from `total` and `pageSize` when left out. */
  totalPages?: number;
  /** Accessible name of the navigation landmark (default "{Noun} pages"). */
  label?: string;
  /** Render nothing when everything fits on one page. */
  hideSinglePage?: boolean;
  className?: string;
}

const BUTTON = `min-h-11 min-w-11 rounded-md px-4 text-sm text-white transition-colors motion-reduce:transition-none hover:bg-white/10 disabled:cursor-default disabled:text-tertiary disabled:hover:bg-transparent ${ADMIN_FOCUS_RING}`;

export function AdminPagination({
  page,
  total,
  pageSize,
  loading,
  onPage,
  noun = 'rows',
  totalPages,
  label,
  hideSinglePage = false,
  className = '',
}: AdminPaginationProps): ReactNode {
  const pages = totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  if (hideSinglePage && pages <= 1) return null;
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return (
    <nav aria-label={label ?? `${noun.charAt(0).toUpperCase()}${noun.slice(1)} pages`} className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <p className="text-xs text-secondary">
        Showing {first.toLocaleString('en-US')}–{last.toLocaleString('en-US')} of {total.toLocaleString('en-US')} {noun}
      </p>
      <div className="flex gap-2">
        <button type="button" className={`${BUTTON} bg-surface`} disabled={page <= 1 || loading} onClick={() => onPage(page - 1)} aria-label={`Previous page of ${noun}`}>
          Previous
        </button>
        <button type="button" className={`${BUTTON} bg-surface-elevated`} disabled={page >= pages || loading} onClick={() => onPage(page + 1)} aria-label={`Next page of ${noun}`}>
          Next
        </button>
      </div>
    </nav>
  );
}
