/**
 * CycleControlsPage — what is the scheduler doing, did every slot run, and
 * what happened around a deploy?
 *
 * Sections: toolbar (times in UTC, last updated, Refresh), status strip,
 * missed-run banner, daily schedule with a Run button per job, run history
 * (persistent: survives restarts and deploys) and the collapsed testing tools
 * (bulk cycle runner). Manual runs start in the background and the page polls
 * while a job is queued or running.
 *
 * Definitions: docs/guides/ADMIN_PANEL_GUIDE.md §Cycle Controls.
 */
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  CycleStatusStrip,
  DailySchedule,
  MissedRunsBanner,
  RunHistory,
  TestingTools,
} from '../../components/admin/cycles';
import { ConfirmDialog } from '../../components/admin/automatons/ui';
import { ADMIN_FOCUS_RING } from '../../components/admin/shared';
import { useCycleControls } from '../../hooks/useCycleControls';
import { BULK_CYCLES_JOB_NAME, type BulkCycleOptions, type SchedulerJobName, type SchedulerOverview } from '../../utils/adminCycleApi';
import { JOB_DESCRIPTIONS, formatDuration, jobLabel } from '../../utils/adminCycleFormat';
import { formatUtcTime } from '../../utils/adminDashboardFormat';

type PendingAction =
  | { kind: 'job'; jobName: SchedulerJobName }
  | { kind: 'bulk'; options: BulkCycleOptions };

interface Message {
  tone: 'success' | 'error';
  text: string;
}

/** Sum of the last duration of every slot: one cycle, roughly, on this environment. */
function estimateCycleMs(overview: SchedulerOverview | null): number | null {
  if (!overview || overview.slots.length === 0) return null;
  let total = 0;
  for (const slot of overview.slots) {
    if (slot.lastRun?.durationMs === null || slot.lastRun?.durationMs === undefined) return null;
    total += slot.lastRun.durationMs;
  }
  return total;
}

function bulkDescription(options: BulkCycleOptions, estimate: number | null): ReactNode {
  const parts = [
    options.generateUsersPerCycle ? 'generates stables' : 'no stable generation',
    options.includeTournaments ? 'tournaments' : 'no tournaments',
    options.includeKoth ? 'KotH' : 'no KotH',
    options.includeDailyFinances ? 'finances' : 'no finances',
  ];
  return (
    <>
      <p>
        Runs {options.cycles} full cycle{options.cycles === 1 ? '' : 's'} on this environment ({parts.join(', ')}).
        Real stables take part and the cycle counter moves.
      </p>
      {estimate !== null && <p>Estimated {formatDuration(estimate * options.cycles)}. It runs in the background; scheduled jobs wait for it.</p>}
    </>
  );
}

function CycleControlsPage(): React.ReactElement {
  const { overview, history, historyQuery, setHistoryQuery, now, refresh, startRun, startBulk } = useCycleControls();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  const data = overview.data;
  const estimate = estimateCycleMs(data);
  const activeBulkRun = data
    ? [data.running, ...data.queue].find((run) => run !== null && run.jobName === BULK_CYCLES_JOB_NAME) ?? null
    : null;
  const refreshing = overview.loading && data !== null;

  const confirm = async (): Promise<void> => {
    if (!pending) return;
    setStarting(true);
    const result = pending.kind === 'job' ? await startRun(pending.jobName) : await startBulk(pending.options);
    setStarting(false);
    const label = pending.kind === 'job' ? jobLabel(pending.jobName) : 'Bulk cycles';
    setPending(null);
    setMessage(result.ok
      ? { tone: 'success', text: `${label} started. It runs in the background; this page updates while it runs.` }
      : { tone: 'error', text: `${label} did not start: ${result.message}` });
  };

  const showMissedInHistory = (): void => {
    setHistoryQuery({ problemsOnly: true, jobName: undefined, days: data?.missed.windowDays ?? 7 });
    historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    historyRef.current?.focus({ preventScroll: true });
  };

  return (
    <div data-testid="cycle-controls-page" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-white/10 bg-surface-elevated px-3 py-1 text-xs text-secondary">All times UTC</span>
          <span className="text-xs text-tertiary">Refreshes every 10 s while a job runs</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-xs text-secondary" aria-live="polite">
            {refreshing ? 'Refreshing…' : data ? `Last updated ${formatUtcTime(data.timestamp, true)}` : 'Not loaded yet'}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className={`min-h-11 whitespace-nowrap rounded-md border border-white/10 bg-surface-elevated px-3 text-sm text-white hover:bg-white/10 disabled:opacity-60 ${ADMIN_FOCUS_RING}`}
          >
            <span aria-hidden="true">↻ </span>Refresh
          </button>
        </div>
      </div>

      <div aria-live="polite">
        {message && (
          <div
            role={message.tone === 'error' ? 'alert' : 'status'}
            className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${message.tone === 'error' ? 'border-error/40 bg-error/10 text-error' : 'border-success/40 bg-success/10 text-success'}`}
          >
            <span>{message.text}</span>
            <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss message" className={`min-h-11 min-w-11 rounded text-secondary hover:text-white ${ADMIN_FOCUS_RING}`}>×</button>
          </div>
        )}
      </div>

      <CycleStatusStrip overview={data} loading={overview.loading} error={overview.error} now={now} />

      {data && (
        <MissedRunsBanner missed={data.missed.runs} windowDays={data.missed.windowDays} now={now} onShowInHistory={showMissedInHistory} />
      )}

      <DailySchedule
        slots={data?.slots ?? null}
        loading={overview.loading}
        now={now}
        onRun={(slot) => setPending({ kind: 'job', jobName: slot.jobName })}
      />

      <RunHistory
        ref={historyRef}
        page={history.data}
        loading={history.loading}
        error={history.error}
        query={historyQuery}
        now={now}
        onQueryChange={setHistoryQuery}
        onRetry={refresh}
      />

      <TestingTools
        estimatedCycleMs={estimate}
        activeBulkRun={activeBulkRun}
        now={now}
        onStart={(options) => setPending({ kind: 'bulk', options })}
      />

      {pending && (
        <ConfirmDialog
          title={pending.kind === 'job' ? `Run ${jobLabel(pending.jobName)} now?` : `Run ${pending.options.cycles} bulk cycle${pending.options.cycles === 1 ? '' : 's'}?`}
          message={pending.kind === 'job' ? (
            <>
              <p>{JOB_DESCRIPTIONS[pending.jobName]}</p>
              <p>It starts in the background and waits if another job is running.</p>
            </>
          ) : bulkDescription(pending.options, estimate)}
          confirmLabel={pending.kind === 'job' ? 'Run now' : 'Start bulk run'}
          destructive={pending.kind === 'bulk' || pending.jobName === 'settlement'}
          busy={starting}
          onConfirm={() => { void confirm(); }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

export default CycleControlsPage;
