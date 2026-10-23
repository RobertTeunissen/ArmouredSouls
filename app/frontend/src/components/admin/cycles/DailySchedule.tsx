/**
 * Daily schedule: the ten slots in time order (UTC), each with its last run
 * (from the persistent history), status, duration, result and a Run button.
 * A table from `md`, a list below it; Run buttons are at least 44 × 44 px.
 */
import type { ReactNode } from 'react';
import type { SchedulerSlot } from '../../../utils/adminCycleApi';
import {
  elapsedSince,
  formatDayTime,
  formatDuration,
  jobLabel,
  runResultText,
  triggerLabel,
} from '../../../utils/adminCycleFormat';
import { AdminPanel, ADMIN_FOCUS_RING } from '../shared';
import { RunStatus } from './RunStatus';

export interface DailyScheduleProps {
  slots: SchedulerSlot[] | null;
  loading: boolean;
  now: Date;
  onRun: (slot: SchedulerSlot) => void;
}

function RunButton({ slot, onRun }: { slot: SchedulerSlot; onRun: (slot: SchedulerSlot) => void }): ReactNode {
  if (slot.activeRun) {
    return <span className="inline-flex min-h-11 items-center text-xs text-warning">{slot.activeRun.status === 'running' ? 'Running' : 'Queued'}</span>;
  }
  return (
    <button
      type="button"
      onClick={() => onRun(slot)}
      aria-label={`Run ${jobLabel(slot.jobName)} now`}
      className={`min-h-11 min-w-14 rounded-md bg-primary/15 px-3 text-sm font-medium text-primary hover:bg-primary/25 ${ADMIN_FOCUS_RING}`}
    >
      Run
    </button>
  );
}

/** What the row shows: the active run when there is one, else the last finished one. */
function shownRun(slot: SchedulerSlot) {
  return slot.activeRun ?? slot.lastRun;
}

export function DailySchedule({ slots, loading, now, onRun }: DailyScheduleProps): ReactNode {
  const todayLabel = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

  return (
    <AdminPanel
      title="Daily schedule"
      actions={<span className="text-xs text-secondary">Today, {todayLabel} · last run per slot</span>}
      loading={loading && !slots}
      skeletonRows={10}
    >
      {slots && (
        <>
          {/* md and up: a table */}
          <div className="hidden px-5 pb-2 md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Scheduler slots with their last run</caption>
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-tertiary">
                  <th scope="col" className="py-3 pr-3 text-left font-semibold">Time</th>
                  <th scope="col" className="py-3 pr-3 text-left font-semibold">Job</th>
                  <th scope="col" className="py-3 pr-3 text-left font-semibold">Last run</th>
                  <th scope="col" className="py-3 pr-3 text-left font-semibold">Status</th>
                  <th scope="col" className="py-3 pr-3 text-right font-semibold">Duration</th>
                  <th scope="col" className="py-3 pr-3 text-left font-semibold">Result</th>
                  <th scope="col" className="py-3 text-right font-semibold"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {slots.map((slot) => {
                  const run = shownRun(slot);
                  const active = slot.activeRun !== null;
                  return (
                    <tr key={slot.jobName} className={`border-b border-white/5 ${active ? 'bg-warning/[0.06]' : ''}`}>
                      <td className="py-1.5 pr-3 font-mono text-secondary">{slot.time ?? slot.schedule}</td>
                      <th scope="row" className={`py-1.5 pr-3 text-left text-white ${active ? 'font-semibold' : 'font-normal'}`}>{jobLabel(slot.jobName)}</th>
                      <td className="py-1.5 pr-3 text-secondary">{run ? `${formatDayTime(run.startedAt ?? run.queuedAt, now)} · ${triggerLabel(run)}` : 'No run recorded yet'}</td>
                      <td className="py-1.5 pr-3">{run ? <RunStatus status={run.status} /> : <span className="text-tertiary">—</span>}</td>
                      <td className={`py-1.5 pr-3 text-right ${active ? 'text-warning' : 'text-white'}`}>
                        {run ? (run.status === 'running' ? `${elapsedSince(run.startedAt, now)}…` : formatDuration(run.durationMs)) : '—'}
                      </td>
                      <td className="max-w-72 truncate py-1.5 pr-3 text-secondary" title={run ? runResultText(run) ?? undefined : undefined}>
                        {run ? runResultText(run) ?? <span className="text-tertiary">—</span> : <span className="text-tertiary">—</span>}
                      </td>
                      <td className="py-1.5 text-right"><RunButton slot={slot} onRun={onRun} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* below md: a list */}
          <ul className="divide-y divide-white/5 md:hidden" aria-label="Scheduler slots with their last run">
            {slots.map((slot) => {
              const run = shownRun(slot);
              const active = slot.activeRun !== null;
              return (
                <li key={slot.jobName} className={`flex items-center gap-3 px-4 py-2.5 ${active ? 'bg-warning/[0.06]' : ''}`}>
                  <span className="w-11 shrink-0 font-mono text-sm text-secondary">{slot.time ?? '—'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{jobLabel(slot.jobName)}</p>
                    <p className="truncate text-xs text-secondary">
                      {run ? (
                        <>
                          <RunStatus status={run.status} />
                          {' · '}
                          {run.status === 'running' ? `${elapsedSince(run.startedAt, now)} so far` : `${formatDayTime(run.startedAt ?? run.queuedAt, now)} · ${formatDuration(run.durationMs)}`}
                          {runResultText(run) && run.status !== 'running' ? ` · ${runResultText(run)}` : ''}
                        </>
                      ) : 'No run recorded yet'}
                    </p>
                  </div>
                  <RunButton slot={slot} onRun={onRun} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </AdminPanel>
  );
}
