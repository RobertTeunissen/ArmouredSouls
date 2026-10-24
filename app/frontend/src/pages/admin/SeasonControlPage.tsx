/**
 * SeasonControlPage — Season Control (`/admin/seasons`, Spec #45).
 *
 * Where is the season, when does it roll over, what would a rollover do, and
 * how did earlier rollovers go?
 *
 * Sections: toolbar (times in UTC, last updated, Refresh), season timeline,
 * rollover card (preview, typed confirmation, live stages while one runs),
 * rollover history (persistent, with failed attempts folded) and the
 * collapsed testing tools (extend, remaining preparation cycles). A rollover
 * runs in the background under the scheduler lock; the page polls every 5 s
 * while one is queued or running.
 *
 * Definitions: docs/guides/ADMIN_PANEL_GUIDE.md §Season Control.
 */
import { useEffect, useState } from 'react';
import {
  RolloverCard,
  RolloverConfirmDialog,
  RolloverHistory,
  SeasonTestingTools,
  SeasonTimeline,
} from '../../components/admin/seasons';
import { ConfirmDialog } from '../../components/admin/automatons/ui';
import { ADMIN_FOCUS_RING } from '../../components/admin/shared';
import { useSeasonControl } from '../../hooks/useSeasonControl';
import { formatUtcTime } from '../../utils/adminDashboardFormat';
import { formatDuration } from '../../utils/adminCycleFormat';
import { attemptProblemText, extendEffect, formatCount, latestAttempt } from '../../utils/adminSeasonFormat';

type Pending =
  /** The season the dialog was opened for; confirming rolls over only that one. */
  | { kind: 'rollover'; seasonNumber: number }
  | { kind: 'extend'; cycles: number }
  | { kind: 'preparation'; remaining: number };

interface Message {
  tone: 'success' | 'error';
  text: string;
}

function SeasonControlPage(): React.ReactElement {
  const {
    state, history, preview, now, updatedAt, finished, clearFinished, refresh, loadPreview, startRollover, extend, setPreparation,
  } = useSeasonControl();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const data = state.data;
  const refreshing = state.loading && data !== null;

  // Announce how a rollover this page watched ended, once its history row is in.
  useEffect(() => {
    if (!finished || history.loading || !history.data) return;
    clearFinished();
    const attempt = latestAttempt(history.data);
    if (!attempt) return;
    if (attempt.status === 'success') {
      const rows = attempt.result ? ` · ${formatCount(attempt.result.totalRowsPurged)} rows emptied` : '';
      setMessage({ tone: 'success', text: `Rollover complete in ${formatDuration(attempt.durationMs)}${rows}. The next season is in preparation.` });
    } else {
      setMessage({ tone: 'error', text: `Rollover did not complete. ${attemptProblemText(attempt)}` });
    }
  }, [finished, history.loading, history.data, clearFinished]);

  const close = (): void => {
    setPending(null);
    setDialogError(null);
  };

  const confirm = async (): Promise<void> => {
    if (!pending || !data) return;
    setBusy(true);
    const result = pending.kind === 'rollover'
      ? await startRollover(pending.seasonNumber)
      : pending.kind === 'extend' ? await extend(pending.cycles) : await setPreparation(pending.remaining);
    setBusy(false);
    if (!result.ok) {
      setDialogError(result.message);
      return;
    }
    const text = pending.kind === 'rollover'
      ? `Season ${pending.seasonNumber} rollover started. It runs in the background; this page follows its stages.`
      : pending.kind === 'extend'
        ? `Season ${data.seasonNumber} extended by ${pending.cycles} cycle${pending.cycles === 1 ? '' : 's'}.`
        : `Remaining preparation cycles set to ${pending.remaining}.`;
    close();
    setMessage({ tone: 'success', text });
  };

  return (
    <div data-testid="season-control-page" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-white/10 bg-surface-elevated px-3 py-1 text-xs text-secondary">All times UTC</span>
          <span className="text-xs text-tertiary">Refreshes every 5 s while a rollover runs</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-xs text-secondary" aria-live="polite">
            {refreshing ? 'Refreshing…' : updatedAt ? `Last updated ${formatUtcTime(updatedAt.toISOString(), true)}` : 'Not loaded yet'}
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
            <span className="break-words">{message.text}</span>
            <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss message" className={`min-h-11 min-w-11 rounded text-secondary hover:text-white ${ADMIN_FOCUS_RING}`}>×</button>
          </div>
        )}
      </div>

      <SeasonTimeline state={data} loading={state.loading} error={state.error} now={now} onRetry={refresh} />

      <RolloverCard
        state={data}
        preview={preview}
        now={now}
        onLoadPreview={loadPreview}
        onRollover={() => {
          if (!data) return;
          if (!preview.data && !preview.loading) loadPreview();
          setPending({ kind: 'rollover', seasonNumber: data.seasonNumber });
        }}
      />

      <RolloverHistory
        history={history.data}
        loading={history.loading}
        error={history.error}
        now={now}
        currentSeasonNumber={data?.seasonNumber ?? null}
        onRetry={refresh}
      />

      {data && (
        <SeasonTestingTools
          state={data}
          now={now}
          onExtend={(cycles) => setPending({ kind: 'extend', cycles })}
          onSetPreparation={(remaining) => setPending({ kind: 'preparation', remaining })}
        />
      )}

      {pending?.kind === 'rollover' && data && (
        <RolloverConfirmDialog
          seasonNumber={pending.seasonNumber}
          // The page keeps polling: a settlement or another admin may roll the season over while this is open.
          stale={data.seasonNumber !== pending.seasonNumber || data.activeRollover !== null}
          preview={preview.data}
          busy={busy}
          error={dialogError}
          onConfirm={() => { void confirm(); }}
          onCancel={close}
        />
      )}
      {pending && pending.kind !== 'rollover' && data && (
        <ConfirmDialog
          title={pending.kind === 'extend' ? `Extend Season ${data.seasonNumber} by ${pending.cycles} cycle${pending.cycles === 1 ? '' : 's'}?` : `Set remaining preparation cycles to ${pending.remaining}?`}
          message={(
            <>
              <p>
                {pending.kind === 'extend'
                  ? extendEffect(data, pending.cycles, now)
                  : pending.remaining === 0
                    ? 'The competitive phase starts at the next settlement.'
                    : `The competitive phase starts after ${pending.remaining} more settlement${pending.remaining === 1 ? '' : 's'}.`}
              </p>
              {dialogError && <p role="alert" className="text-error">{dialogError}</p>}
            </>
          )}
          confirmLabel={pending.kind === 'extend' ? 'Extend' : 'Set'}
          busy={busy}
          onConfirm={() => { void confirm(); }}
          onCancel={close}
        />
      )}
    </div>
  );
}

export default SeasonControlPage;
