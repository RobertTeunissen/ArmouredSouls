/**
 * Banner for slots that did not run in the last 7 days, with the downtime
 * (usually a deploy) when the backend was down at the slot.
 */
import type { ReactNode } from 'react';
import type { MissedRun } from '../../../utils/adminCycleApi';
import { describeMissed } from '../../../utils/adminCycleFormat';
import { ADMIN_FOCUS_RING } from '../shared';

export interface MissedRunsBannerProps {
  missed: MissedRun[];
  windowDays: number;
  now: Date;
  onShowInHistory: () => void;
}

export function MissedRunsBanner({ missed, windowDays, now, onShowInHistory }: MissedRunsBannerProps): ReactNode {
  if (missed.length === 0) return null;
  const shown = missed.slice(0, 3);
  return (
    <section
      aria-label="Missed runs"
      className="flex flex-col gap-2 rounded-lg border border-warning/45 bg-warning/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="font-semibold text-warning">
          <span aria-hidden="true">⚠ </span>
          {missed.length} missed run{missed.length === 1 ? '' : 's'} in the last {windowDays} days
        </p>
        <ul className="mt-1 space-y-0.5 text-white">
          {shown.map((run) => <li key={`${run.jobName}-${run.expectedAt}`}>{describeMissed(run, now)}</li>)}
          {missed.length > shown.length && <li className="text-secondary">and {missed.length - shown.length} more</li>}
        </ul>
      </div>
      <button
        type="button"
        onClick={onShowInHistory}
        className={`min-h-11 shrink-0 self-start rounded-md px-3 text-sm text-primary hover:bg-primary/10 sm:self-auto ${ADMIN_FOCUS_RING}`}
      >
        Show in history →
      </button>
    </section>
  );
}
