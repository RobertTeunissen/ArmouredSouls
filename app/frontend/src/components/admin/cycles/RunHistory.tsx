/**
 * Run history: runs, "Backend restarted" markers and missed runs, newest
 * first, from the persistent history (survives deploys). Filters: job,
 * problems only, window. A table from `md`, a list below it.
 */
import { useId } from 'react';
import type { ReactNode, Ref } from 'react';
import {
  BULK_CYCLES_JOB_NAME,
  SCHEDULER_JOB_NAMES,
  type SchedulerHistoryEntry,
  type SchedulerHistoryJobName,
  type SchedulerHistoryPage,
  type SchedulerHistoryQuery,
} from '../../../utils/adminCycleApi';
import {
  elapsedSince,
  formatClock,
  formatDayTime,
  formatDuration,
  jobLabel,
  runResultText,
  triggerLabel,
} from '../../../utils/adminCycleFormat';
import { AdminPanel, ADMIN_FOCUS_RING } from '../shared';
import { SearchAnalyticsPagination } from '../search-analytics/SearchAnalyticsPagination';
import { RunStatus } from './RunStatus';

export interface RunHistoryProps {
  page: SchedulerHistoryPage | null;
  loading: boolean;
  error: string | null;
  query: SchedulerHistoryQuery;
  now: Date;
  onQueryChange: (patch: Partial<SchedulerHistoryQuery>) => void;
  onRetry: () => void;
  /** The wrapper, focused by "Show in history". */
  ref?: Ref<HTMLDivElement>;
}

const DAY_OPTIONS = [1, 7, 14, 30] as const;
const SELECT = `min-h-11 rounded-md border border-white/10 bg-surface-elevated px-3 text-sm text-white ${ADMIN_FOCUS_RING}`;

interface Row {
  key: string;
  at: string;
  job: string;
  trigger: string;
  status: ReactNode;
  duration: string;
  result: string | null;
  tone: 'none' | 'restart' | 'missed' | 'problem' | 'active';
}

function toRow(entry: SchedulerHistoryEntry, now: Date): Row {
  if (entry.kind === 'restart') {
    const { restart } = entry;
    const down = restart.downSince
      ? `Down ${formatClock(restart.downSince)}–${formatClock(entry.at)}`
      : 'History tracking started';
    return {
      key: `restart-${restart.processId}`,
      at: entry.at,
      job: '↻ Backend restarted',
      trigger: restart.deployTag ?? (restart.schedulerEnabled ? 'Scheduler active' : 'Scheduler disabled'),
      status: <span className="text-tertiary">—</span>,
      duration: '—',
      result: down,
      tone: 'restart',
    };
  }
  if (entry.kind === 'missed') {
    const { missed } = entry;
    return {
      key: `missed-${missed.jobName}-${missed.expectedAt}`,
      at: entry.at,
      job: jobLabel(missed.jobName),
      trigger: 'Cron (expected)',
      status: <RunStatus status="missed" />,
      duration: '—',
      result: missed.downtime
        ? `No run recorded; backend down ${formatClock(missed.downtime.from)}–${formatClock(missed.downtime.to)}`
        : 'No run recorded at this slot',
      tone: 'missed',
    };
  }
  const { run } = entry;
  const active = run.status === 'running' || run.status === 'queued';
  return {
    key: `run-${run.id}`,
    at: run.startedAt ?? run.queuedAt,
    job: jobLabel(run.jobName),
    trigger: triggerLabel(run),
    status: <RunStatus status={run.status} />,
    duration: run.status === 'running' ? `${elapsedSince(run.startedAt, now)}…` : formatDuration(run.durationMs),
    result: runResultText(run),
    tone: active ? 'active' : run.status === 'failed' || run.status === 'interrupted' ? 'problem' : 'none',
  };
}

const TONE_BG: Readonly<Record<Row['tone'], string>> = {
  none: '',
  restart: 'bg-info/[0.07]',
  missed: 'bg-warning/[0.07]',
  problem: 'bg-error/[0.06]',
  active: 'bg-warning/[0.06]',
};

export function RunHistory({ page, loading, error, query, now, onQueryChange, onRetry, ref }: RunHistoryProps): ReactNode {
  const jobId = useId();
  const daysId = useId();
  const rows = page ? page.entries.map((entry) => toRow(entry, now)) : null;

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={jobId} className="sr-only">Job</label>
      <select
        id={jobId}
        value={query.jobName ?? ''}
        onChange={(event) => onQueryChange({ jobName: (event.target.value || undefined) as SchedulerHistoryJobName | undefined })}
        className={SELECT}
      >
        <option value="">All jobs</option>
        {[...SCHEDULER_JOB_NAMES, BULK_CYCLES_JOB_NAME].map((name) => <option key={name} value={name}>{jobLabel(name)}</option>)}
      </select>
      <button
        type="button"
        aria-pressed={query.problemsOnly === true}
        onClick={() => onQueryChange({ problemsOnly: !query.problemsOnly })}
        className={`min-h-11 rounded-md border px-3 text-sm ${query.problemsOnly ? 'border-warning/60 bg-warning/15 text-white' : 'border-white/10 bg-surface-elevated text-secondary hover:text-white'} ${ADMIN_FOCUS_RING}`}
      >
        Problems only
      </button>
      <label htmlFor={daysId} className="sr-only">Period</label>
      <select id={daysId} value={query.days ?? 7} onChange={(event) => onQueryChange({ days: Number(event.target.value) })} className={SELECT}>
        {DAY_OPTIONS.map((days) => <option key={days} value={days}>{days === 1 ? 'Last 24 hours' : `Last ${days} days`}</option>)}
      </select>
    </div>
  );

  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      <AdminPanel title="Run history" actions={filters} loading={loading && !rows} error={error} onRetry={onRetry} skeletonRows={8}>
        {rows && (rows.length === 0 ? (
          <p className="p-5 text-sm text-secondary">
            {query.problemsOnly ? 'No problems in this period.' : 'No runs recorded in this period.'}
          </p>
        ) : (
          <>
            <div className="hidden px-5 pb-2 md:block">
              <table className="w-full text-sm">
                <caption className="sr-only">Scheduler runs, restarts and missed runs, newest first</caption>
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-tertiary">
                    <th scope="col" className="py-3 pr-3 text-left font-semibold">Started</th>
                    <th scope="col" className="py-3 pr-3 text-left font-semibold">Job</th>
                    <th scope="col" className="py-3 pr-3 text-left font-semibold">Trigger</th>
                    <th scope="col" className="py-3 pr-3 text-left font-semibold">Status</th>
                    <th scope="col" className="py-3 pr-3 text-right font-semibold">Duration</th>
                    <th scope="col" className="py-3 text-left font-semibold">Result / error</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {rows.map((row) => (
                    <tr key={row.key} className={`border-b border-white/5 ${TONE_BG[row.tone]}`}>
                      <td className="whitespace-nowrap py-2 pr-3 text-secondary">{formatDayTime(row.at, now)}</td>
                      <th scope="row" className={`py-2 pr-3 text-left ${row.tone === 'restart' ? 'font-semibold text-info' : 'font-normal text-white'}`}>{row.job}</th>
                      <td className="py-2 pr-3 text-secondary">{row.trigger}</td>
                      <td className="py-2 pr-3">{row.status}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-right text-white">{row.duration}</td>
                      <td className="max-w-md break-words py-2 text-secondary">{row.result ?? <span className="text-tertiary">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-white/5 md:hidden" aria-label="Scheduler runs, restarts and missed runs, newest first">
              {rows.map((row) => (
                <li key={row.key} className={`px-4 py-2.5 text-sm ${TONE_BG[row.tone]}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={`min-w-0 truncate font-semibold ${row.tone === 'restart' ? 'text-info' : 'text-white'}`}>{row.job}</span>
                    <span className="shrink-0 text-xs">{row.status}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-secondary">
                    {formatDayTime(row.at, now)} · {row.trigger}{row.duration !== '—' ? ` · ${row.duration}` : ''}
                  </p>
                  {row.result && <p className="mt-0.5 break-words text-xs text-secondary">{row.result}</p>}
                </li>
              ))}
            </ul>
          </>
        ))}
        {page && (
          <SearchAnalyticsPagination
            page={page.page}
            total={page.total}
            limit={page.limit}
            loading={loading}
            onPageChange={(next) => onQueryChange({ page: next })}
            itemLabel="entries"
            label="Run history pagination"
          />
        )}
      </AdminPanel>
    </div>
  );
}
