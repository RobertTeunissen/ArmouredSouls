/**
 * Status strip: season and cycle, scheduler state (since when this backend
 * runs), the running job with its elapsed time, the queue, and the next slot.
 */
import type { ReactNode } from 'react';
import type { SchedulerOverview } from '../../../utils/adminCycleApi';
import { elapsedSince, formatClock, formatCountdown, formatDayTime, jobLabel } from '../../../utils/adminCycleFormat';
import { PanelError } from '../shared';

export interface CycleStatusStripProps {
  overview: SchedulerOverview | null;
  loading: boolean;
  error: string | null;
  now: Date;
}

function Tile({ label, value, caption, tone = 'neutral', live = false }: {
  label: string;
  value: ReactNode;
  caption: ReactNode;
  tone?: 'neutral' | 'running';
  live?: boolean;
}): ReactNode {
  const box = tone === 'running' ? 'border-warning/50 bg-warning/[0.08]' : 'border-white/10 bg-surface';
  return (
    <div className={`min-w-0 rounded-lg border px-4 py-3 ${box}`} aria-live={live ? 'polite' : undefined}>
      <dt className={`text-xs ${tone === 'running' ? 'text-warning' : 'text-secondary'}`}>{label}</dt>
      <dd className="mt-1 truncate text-lg font-semibold text-white">{value}</dd>
      <dd className="mt-0.5 truncate text-xs text-tertiary">{caption}</dd>
    </div>
  );
}

export function CycleStatusStrip({ overview, loading, error, now }: CycleStatusStripProps): ReactNode {
  if (!overview) {
    return (
      <section aria-label="Scheduler status" aria-busy={loading || undefined} className="rounded-lg border border-white/10 bg-surface">
        {error ? <PanelError message={error} /> : <div className="h-24 animate-pulse rounded-lg bg-white/5 motion-reduce:animate-none" aria-hidden="true" />}
      </section>
    );
  }

  const { season, cycle, scheduler, running, queue, next } = overview;
  const process = scheduler.process;
  const phase = season ? (season.phase === 'preparation' ? 'Preparation' : season.phase === 'competitive' ? 'Competitive' : season.phase) : null;

  return (
    <section aria-label="Scheduler status">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Tile
          label="Season"
          value={season ? `S${season.number} · Cycle ${cycle.number}` : `Cycle ${cycle.number}`}
          caption={phase ? `${phase}${season && season.phase === 'competitive' ? ` · day ${season.seasonCycle}` : ''}` : 'Season unavailable'}
        />
        <Tile
          label="Scheduler"
          value={(
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${scheduler.active ? 'bg-success' : 'bg-error'}`} />
              {scheduler.active ? 'Active' : 'Disabled'}
            </span>
          )}
          caption={process
            ? `Up since ${formatDayTime(process.startedAt, now)}${process.deployTag ? ` (${process.deployTag})` : ''}`
            : 'Run history unavailable'}
        />
        <div className="col-span-2 md:col-span-1">
          <Tile
            label="Running now"
            tone={running ? 'running' : 'neutral'}
            live
            value={running ? (
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="h-2.5 w-2.5 animate-pulse rounded-full bg-warning motion-reduce:animate-none" />
                {jobLabel(running.jobName)}
              </span>
            ) : 'Nothing'}
            caption={running ? `Started ${formatClock(running.startedAt ?? running.queuedAt)} · ${elapsedSince(running.startedAt, now)} so far` : 'No job is running'}
          />
        </div>
        <Tile
          label="Queue"
          value={queue.length === 0 ? 'Empty' : queue.map((run) => jobLabel(run.jobName)).join(', ')}
          caption={queue.length === 0 ? 'Manual runs wait here' : `${queue.length} waiting for the lock`}
        />
        <Tile
          label="Next"
          value={next ? jobLabel(next.jobName) : '—'}
          caption={next
            ? `${formatClock(next.at)} · ${running ? 'after the running job' : formatCountdown(next.at, now)}`
            : scheduler.active ? 'No upcoming slot' : 'Automated scheduling is off'}
        />
      </dl>
    </section>
  );
}
