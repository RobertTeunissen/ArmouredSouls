/**
 * Section shell of admin pages: a labelled region with a heading, an
 * optional header action, and shared loading / error states.
 */
import { useId } from 'react';
import type { ReactNode } from 'react';
import { ADMIN_FOCUS_RING } from './focusRing';

export interface AdminPanelProps {
  title: string;
  /** Right-aligned header content (a badge, a link, a toggle). */
  actions?: ReactNode;
  loading?: boolean;
  error?: string | null;
  /** Shows a Retry button next to the error. */
  onRetry?: () => void;
  /** Rows of placeholder bars while the first load is in flight. */
  skeletonRows?: number;
  className?: string;
  children?: ReactNode;
}

export function PanelSkeleton({ rows }: { rows: number }): ReactNode {
  return (
    <div className="space-y-3 p-5" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-4 rounded bg-white/5 animate-pulse motion-reduce:animate-none" />
      ))}
    </div>
  );
}

export function PanelError({ message, onRetry }: { message: string; onRetry?: () => void }): ReactNode {
  return (
    <div
      role="alert"
      className="m-5 flex flex-col gap-3 rounded border border-error/40 bg-error/10 px-4 py-3 text-sm text-error sm:flex-row sm:items-center sm:justify-between"
    >
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={`min-h-11 shrink-0 rounded bg-error/20 px-3 text-sm text-error transition-colors motion-reduce:transition-none hover:bg-error/30 ${ADMIN_FOCUS_RING}`}
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function AdminPanel({
  title,
  actions,
  loading = false,
  error = null,
  onRetry,
  skeletonRows = 4,
  className = '',
  children,
}: AdminPanelProps): ReactNode {
  const headingId = useId();
  const showSkeleton = loading && !children;

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={loading || undefined}
      className={`rounded-lg border border-white/10 bg-surface ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-5 py-3.5">
        <h2 id={headingId} className="text-base font-semibold text-white">{title}</h2>
        {actions}
      </div>
      {error && <PanelError message={error} onRetry={onRetry} />}
      {showSkeleton ? <PanelSkeleton rows={skeletonRows} /> : children}
    </section>
  );
}
