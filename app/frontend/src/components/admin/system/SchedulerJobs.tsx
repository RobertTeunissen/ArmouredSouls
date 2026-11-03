/**
 * Scheduler jobs: how long each job held the scheduler lock over the last 8
 * UTC days (last run, median of successful runs, slowest), the last 8 runs as
 * a strip, and the lock time per day. Practice Arena refuses battles while a
 * job holds the lock, so long runs matter to players too.
 */
import type { ReactNode } from 'react';
import type { SystemOverview } from '../../../utils/adminSystemApi';
import { formatDuration, jobLabel } from '../../../utils/adminCycleFormat';
import { shortDate } from '../../../utils/adminPracticeArenaFormat';
import { isSlowOutlier, jobNote, summarizeLock } from '../../../utils/adminSystemFormat';
import { AdminPanel } from '../shared';
import { MiniBars } from './MiniBars';

export interface SchedulerJobsProps {
  jobs: SystemOverview['jobs'] | null;
  loading: boolean;
}

const STRIP_RUNS = 8;

function RunStrip({ job }: { job: SystemOverview['jobs']['rows'][number] }): ReactNode {
  const runs = job.runs.slice(-STRIP_RUNS);
  return (
    <>
      <MiniBars
        values={runs.map((run) => run.durationMs)}
        muted={runs.map((run) => run.status !== 'success')}
        tone="primary"
        className="h-7 w-32"
      />
      <span className="sr-only">
        Last {runs.length} runs: {runs.map((run) => `${shortDate(run.startedAt.slice(0, 10))} ${formatDuration(run.durationMs)}${run.status === 'success' ? '' : ` (${run.status})`}`).join(', ')}
      </span>
    </>
  );
}

function LockPerDay({ days }: { days: SystemOverview['jobs']['lockPerDay'] }): ReactNode {
  const summary = summarizeLock(days);
  if (!summary) return null;
  if (summary.maxMs === 0) {
    return (
      <p className="border-t border-white/10 pt-3 text-sm text-secondary">
        <span className="font-medium text-white">Lock held per day</span> · no job held the lock {summary.range}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 pt-3 text-sm">
      <span className="font-medium text-white">Lock held per day</span>
      <span className="text-xs text-secondary">
        {formatDuration(summary.minMs)} – {formatDuration(summary.maxMs)} (median {formatDuration(summary.medianMs)})
      </span>
      <MiniBars values={days.map((day) => day.ms)} tone="warning" className="h-7 w-48" />
      <span className="text-xs text-secondary">{summary.range}</span>
      <span className="sr-only">
        Per day: {days.map((day) => `${shortDate(day.day)} ${formatDuration(day.ms)}`).join(', ')}
      </span>
    </div>
  );
}

export function SchedulerJobs({ jobs, loading }: SchedulerJobsProps): ReactNode {
  return (
    <AdminPanel
      title="Scheduler jobs"
      loading={loading && !jobs}
      skeletonRows={5}
      actions={<span className="text-xs text-secondary">how long each job held the lock · last {jobs?.windowDays ?? 8} days</span>}
    >
      {jobs && (
        <div className="space-y-3 p-4 sm:p-5">
          {jobs.rows.length === 0 ? (
            <p className="text-sm text-secondary">No finished runs in the last {jobs.windowDays} days.</p>
          ) : (
            <>
              <ul className="divide-y divide-white/10 md:hidden" aria-label="Scheduler jobs">
                {jobs.rows.map((job) => (
                  <li key={job.jobName} className="space-y-1 py-2.5 text-sm">
                    <p className="font-medium text-white">{jobLabel(job.jobName)}</p>
                    <p className="text-secondary">
                      Last {formatDuration(job.last?.durationMs)} · median {formatDuration(job.medianMs)} · slowest{' '}
                      <span className={isSlowOutlier(job) ? 'text-warning' : ''}>{formatDuration(job.slowest?.durationMs)}</span>
                    </p>
                    {jobNote(job) && <p className="text-xs text-secondary">{jobNote(job)}</p>}
                  </li>
                ))}
              </ul>
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <caption className="sr-only">Scheduler job durations over the last {jobs.windowDays} days</caption>
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-secondary">
                      <th scope="col" className="py-2 text-left font-semibold">Job</th>
                      <th scope="col" className="py-2 text-right font-semibold">Last run</th>
                      <th scope="col" className="py-2 text-right font-semibold">Median</th>
                      <th scope="col" className="py-2 text-right font-semibold">Slowest</th>
                      <th scope="col" className="py-2 pl-4 text-left font-semibold"><span className="sr-only">Notes</span></th>
                      <th scope="col" className="py-2 text-right font-semibold">Last {STRIP_RUNS} runs</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {jobs.rows.map((job) => (
                      <tr key={job.jobName} className="border-b border-white/5">
                        <th scope="row" className="py-2 text-left font-normal text-white">{jobLabel(job.jobName)}</th>
                        <td className="py-2 text-right text-white">{formatDuration(job.last?.durationMs)}</td>
                        <td className="py-2 text-right text-white">{formatDuration(job.medianMs)}</td>
                        <td className={`py-2 text-right ${isSlowOutlier(job) ? 'text-warning' : 'text-white'}`}>{formatDuration(job.slowest?.durationMs)}</td>
                        <td className="py-2 pl-4 text-xs text-secondary">{jobNote(job)}</td>
                        <td className="py-2">
                          <div className="flex justify-end"><RunStrip job={job} /></div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <LockPerDay days={jobs.lockPerDay} />
          <p className="text-xs text-secondary">
            Median of successful runs. Slowest in amber when over 1.5× the median. Grey bars: failed or interrupted runs.
          </p>
        </div>
      )}
    </AdminPanel>
  );
}
