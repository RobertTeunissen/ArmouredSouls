/**
 * Status strip: cycle, last and next settlement, scheduler and queued matches.
 * Five columns from `xl`, a stacked label/value list below.
 */
import type { ReactNode } from 'react';
import type { DashboardStatus } from '../../../utils/adminDashboardApi';
import { deriveStatusCells, type StatusTone } from '../../../utils/adminDashboardFormat';
import { PanelError } from '../shared/AdminPanel';

export interface StatusStripProps {
  status: DashboardStatus | null;
  loading: boolean;
  error: string | null;
  now: Date;
}

const DOT: Readonly<Record<StatusTone, string>> = {
  ok: 'bg-success',
  error: 'bg-error',
  info: 'bg-info',
  muted: 'bg-tertiary',
};

const TONE_WORD: Readonly<Record<StatusTone, string>> = {
  ok: 'OK',
  error: 'Problem',
  info: 'In progress',
  muted: 'Inactive',
};

const LABELS = ['Cycle', 'Last cycle', 'Next cycle', 'Scheduler', 'Queued matches'];

export function StatusStrip({ status, loading, error, now }: StatusStripProps): ReactNode {
  const cells = status ? deriveStatusCells(status, now) : null;

  return (
    <section aria-label="System status" aria-busy={loading || undefined} className="rounded-lg border border-white/10 bg-surface">
      {error && <PanelError message={error} />}
      <dl className="grid grid-cols-1 divide-y divide-white/5 px-4 xl:grid-cols-5 xl:divide-x xl:divide-y-0 xl:px-0 xl:py-4">
        {(cells ?? LABELS.map((label) => ({ key: label, label, value: null, tone: null }))).map((cell) => (
          <div key={cell.key} className="flex items-center justify-between gap-3 py-3 xl:block xl:px-5 xl:py-0">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-secondary">{cell.label}</dt>
            <dd className="flex items-center gap-2 text-right text-sm font-semibold text-white xl:mt-1.5 xl:text-left">
              {cell.value === null ? (
                loading
                  ? <span className="inline-block h-4 w-28 rounded bg-white/5 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
                  : <span className="text-tertiary">—</span>
              ) : (
                <>
                  {cell.tone && (
                    <>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[cell.tone]}`} aria-hidden="true" />
                      <span className="sr-only">{TONE_WORD[cell.tone]}:</span>
                    </>
                  )}
                  <span>{cell.value}</span>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
