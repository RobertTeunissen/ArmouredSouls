/**
 * Rollover card. Idle: what a rollover does, the on-demand preview and the
 * button that opens the typed confirmation. While a rollover is queued or
 * running (either trigger): who started it, the elapsed time and the five
 * stages as they progress.
 */
import type { ReactNode } from 'react';
import type { AdminActiveRollover, AdminSeasonState, RolloverPreview } from '../../../utils/seasonApi';
import { elapsedSince, formatClock } from '../../../utils/adminCycleFormat';
import type { Section } from '../../../hooks/useCycleControls';
import { ActionButton } from '../automatons/ui';
import { AdminPanel, PanelError, PanelSkeleton } from '../shared';
import { RolloverPreviewView } from './RolloverPreviewView';
import { RolloverStages } from './RolloverStages';

export interface RolloverCardProps {
  state: AdminSeasonState | null;
  preview: Section<RolloverPreview>;
  now: Date;
  onLoadPreview: () => void;
  /** Opens the confirmation; the page starts the rollover. */
  onRollover: () => void;
}

function startedBy(active: AdminActiveRollover): string {
  if (active.trigger === 'cron') return 'Started by the settlement';
  const who = active.triggeredBy ? active.triggeredBy.username ?? `#${active.triggeredBy.userId}` : null;
  return who ? `Started by ${who}` : 'Started by an admin';
}

function ActiveView({ active, now }: { active: AdminActiveRollover; now: Date }): ReactNode {
  return (
    <div className="space-y-4 p-5" aria-live="polite">
      <p role="status" className="flex items-start gap-2 text-sm text-warning">
        <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-warning motion-reduce:animate-none" />
        <span>
          {active.status === 'queued'
            ? `Queued${active.queuedAt ? ` at ${formatClock(active.queuedAt)} UTC` : ''}, waiting for the running job to finish.`
            : `${startedBy(active)}${active.startedAt ? ` at ${formatClock(active.startedAt)} UTC` : ''} · running for ${elapsedSince(active.startedAt, now)}.`}
        </span>
      </p>
      <p className="text-xs text-secondary">
        It runs in the background under the scheduler&apos;s lock, so scheduled jobs wait for it. You can leave this page; the result appears in the history below.
      </p>
      {active.progress && <RolloverStages progress={active.progress} now={now} describe />}
    </div>
  );
}

export function RolloverCard({ state, preview, now, onLoadPreview, onRollover }: RolloverCardProps): ReactNode {
  const active = state?.activeRollover ?? null;
  const title = active
    ? `Rollover of Season ${active.progress?.seasonNumber ?? state?.seasonNumber ?? ''} ${active.status === 'queued' ? 'queued' : 'running'}`
    : 'Season rollover';

  return (
    <AdminPanel
      title={title}
      loading={!state}
      actions={active ? undefined : <span className="rounded-full border border-error/40 bg-error/10 px-2.5 py-0.5 text-xs text-error">Irreversible</span>}
    >
      {state && (active ? <ActiveView active={active} now={now} /> : (
        <div className="space-y-4 p-5">
          <p className="text-sm text-secondary">
            Closes Season {state.seasonNumber}: archives every stable and robot, deletes generated stables, resets every other stable,
            empties season history and opens Season {state.seasonNumber + 1} in its preparation phase. It stops before deleting
            anything if the archive does not verify.
            {state.phase === 'competitive' && !state.isLegacy && state.remainingCompetitiveCycles > 0 && (
              <> The settlement does this by itself after {state.remainingCompetitiveCycles} more cycle{state.remainingCompetitiveCycles === 1 ? '' : 's'}.</>
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            <ActionButton onClick={onLoadPreview} disabled={preview.loading}>
              {preview.loading ? 'Counting…' : preview.data ? 'Refresh preview' : 'Preview rollover'}
            </ActionButton>
            <ActionButton variant="danger" onClick={onRollover} disabled={state.rolloverInProgress}>
              Roll over Season {state.seasonNumber}…
            </ActionButton>
          </div>
          {preview.error && <PanelError message={preview.error} onRetry={onLoadPreview} />}
          {preview.loading && !preview.data && <PanelSkeleton rows={3} />}
          {preview.data && <RolloverPreviewView preview={preview.data} />}
        </div>
      ))}
    </AdminPanel>
  );
}
