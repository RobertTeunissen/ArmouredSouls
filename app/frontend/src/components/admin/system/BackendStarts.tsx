/**
 * Backend starts of the last 7 days (`scheduler_processes`), newest first. A
 * start is a Deploy when it carries a new deploy tag; anything else (crash
 * restart, host reboot, or a start before deploy tags existed) is a Restart.
 */
import type { ReactNode } from 'react';
import { formatDayTime } from '../../../utils/adminCycleFormat';
import { AdminPanel } from '../shared';
import type { SystemStart } from '@shared/types';

export interface BackendStartsProps {
  starts: SystemStart[] | null;
  now: Date;
  loading: boolean;
}

function startNote(start: SystemStart): string {
  if (start.kind === 'deploy') return start.deployTag ?? '';
  return start.deployTag ? `same release (${start.deployTag})` : 'no deploy tag recorded';
}

export function BackendStarts({ starts, now, loading }: BackendStartsProps): ReactNode {
  return (
    <AdminPanel
      title="Backend starts"
      loading={loading && !starts}
      skeletonRows={3}
      actions={<span className="text-xs text-secondary">last 7 days</span>}
    >
      {starts && (
        <div className="p-4 sm:p-5">
          {starts.length === 0 ? (
            <p className="text-sm text-secondary">No backend start in the last 7 days.</p>
          ) : (
            <ul className="space-y-2" aria-label="Backend starts, newest first">
              {starts.map((start) => (
                <li key={start.at} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="w-32 shrink-0 tabular-nums text-white">{formatDayTime(start.at, now)}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs ${start.kind === 'deploy' ? 'bg-primary/15 text-primary' : 'bg-white/10 text-secondary'}`}
                  >
                    {start.kind === 'deploy' ? 'Deploy' : 'Restart'}
                  </span>
                  <span className="min-w-0 break-all text-xs text-secondary">{startNote(start)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </AdminPanel>
  );
}
