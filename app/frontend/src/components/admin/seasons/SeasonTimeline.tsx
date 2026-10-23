/**
 * Season timeline: where the current season is (phase, cycle, progress), the
 * estimated dates of the countdown, rollover and next competitive phase, and
 * the season configuration this environment runs with.
 */
import type { ReactNode } from 'react';
import type { AdminSeasonState } from '../../../utils/seasonApi';
import { formatDate, formatDateTime, timelineDates } from '../../../utils/adminSeasonFormat';
import { AdminPanel } from '../shared';

export interface SeasonTimelineProps {
  state: AdminSeasonState | null;
  loading: boolean;
  error: string | null;
  now: Date;
  onRetry: () => void;
}

const PHASE: Readonly<Record<AdminSeasonState['phase'], { label: string; tone: string }>> = {
  competitive: { label: 'Competitive', tone: 'border-success/40 bg-success/10 text-success' },
  preparation: { label: 'Preparation', tone: 'border-warning/40 bg-warning/10 text-warning' },
  completed: { label: 'Completed', tone: 'border-white/15 bg-white/5 text-secondary' },
};

function Milestone({ label, value, caption }: { label: string; value: ReactNode; caption?: ReactNode }): ReactNode {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-surface-elevated px-4 py-3">
      <dt className="text-xs text-secondary">{label}</dt>
      <dd className="mt-1 text-base font-semibold text-white">{value}</dd>
      {caption && <dd className="mt-0.5 text-xs text-tertiary">{caption}</dd>}
    </div>
  );
}

function progressOf(state: AdminSeasonState): { done: number; total: number; label: string } | null {
  if (state.isLegacy) return null;
  if (state.phase === 'competitive') {
    const done = state.seasonLengthCycles - state.remainingCompetitiveCycles;
    return { done, total: state.seasonLengthCycles, label: `Cycle ${state.seasonCycle} of ${state.seasonLengthCycles} · ${state.remainingCompetitiveCycles} remaining` };
  }
  if (state.phase === 'preparation') {
    const total = state.config.preparationLengthCycles;
    return { done: total - state.remainingPreparationCycles, total, label: `Preparation day ${state.preparationDay} of ${total} · ${state.remainingPreparationCycles} remaining` };
  }
  return null;
}

export function SeasonTimeline({ state, loading, error, now, onRetry }: SeasonTimelineProps): ReactNode {
  if (!state) {
    return <AdminPanel title="Current season" loading={loading} error={error} onRetry={onRetry} skeletonRows={4} />;
  }

  const phase = PHASE[state.phase];
  const progress = progressOf(state);
  const dates = timelineDates(state);
  const extended = state.seasonLengthCycles !== state.config.seasonLengthCycles;
  const countdownShowing = state.phase === 'competitive' && !state.isLegacy && state.remainingCompetitiveCycles <= state.config.countdownCycles;
  const estimate = (date: Date | null): ReactNode => (date ? `~${formatDate(date, now)}` : '—');
  const nextSeason = state.seasonNumber + 1;

  return (
    <AdminPanel
      title={`Season ${state.seasonNumber}${state.isLegacy ? ' (legacy)' : ''}`}
      error={error}
      onRetry={onRetry}
      actions={<span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${phase.tone}`}>{phase.label}</span>}
    >
      <div className="space-y-4 p-5">
        {state.isLegacy ? (
          <p className="text-sm text-secondary">
            Season 0 is the legacy timeline from before seasons existed. It has no fixed length and never rolls over by itself:
            roll it over below to open Season 1&apos;s preparation window.
          </p>
        ) : progress && (
          <div>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-white">{progress.label}</span>
              {state.startedAt && <span className="text-xs text-tertiary">Opened {formatDate(state.startedAt, now)}</span>}
            </div>
            <div
              role="progressbar"
              aria-label={state.phase === 'competitive' ? 'Competitive cycles completed' : 'Preparation days completed'}
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
              aria-valuetext={progress.label}
              className="h-2 overflow-hidden rounded-full bg-white/10"
            >
              <div
                className={`h-full rounded-full ${state.phase === 'competitive' ? 'bg-primary' : 'bg-warning'}`}
                style={{ width: `${progress.total > 0 ? Math.min(100, (progress.done / progress.total) * 100) : 0}%` }}
              />
            </div>
          </div>
        )}

        {!state.isLegacy && (
          <>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {state.phase === 'competitive' ? (
                <>
                  <Milestone
                    label="Player countdown"
                    value={countdownShowing ? 'Showing now' : estimate(dates.countdownAt)}
                    caption={`Last ${state.config.countdownCycles} cycles`}
                  />
                  <Milestone
                    label="Rollover"
                    value={dates.rolloverAt ? `~${formatDateTime(dates.rolloverAt, now)}` : '—'}
                    caption="At the settlement that closes the last cycle"
                  />
                  <Milestone
                    label={`Season ${nextSeason} competitive`}
                    value={estimate(dates.competitiveAt)}
                    caption={`After ${state.config.preparationLengthCycles} preparation cycles`}
                  />
                </>
              ) : (
                <>
                  <Milestone
                    label="Competitive phase"
                    value={estimate(dates.competitiveAt)}
                    caption={`Battles resume after ${state.remainingPreparationCycles} more settlement${state.remainingPreparationCycles === 1 ? '' : 's'}`}
                  />
                  <Milestone label="Rollover" value={estimate(dates.rolloverAt)} caption={`After ${state.seasonLengthCycles} competitive cycles`} />
                  <Milestone
                    label="Balance changes"
                    value={state.balanceChangesAppropriate ? 'Appropriate now' : 'Hold'}
                    caption="Preparation is the window for balance changes"
                  />
                </>
              )}
            </dl>
            <p className="text-xs text-tertiary">
              {state.nextSettlementAt
                ? `Estimates: one cycle per day from the next settlement (${formatDateTime(state.nextSettlementAt, now)} UTC).`
                : 'No dates: automated scheduling is off on this environment, so cycles only advance when run by hand.'}
            </p>
          </>
        )}

        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-tertiary">Configuration</h3>
          <dl className="flex flex-wrap gap-2 text-xs">
            {[
              ['Season length', extended ? `${state.seasonLengthCycles} cycles (extended from ${state.config.seasonLengthCycles})` : `${state.config.seasonLengthCycles} cycles`],
              ['Preparation', `${state.config.preparationLengthCycles} cycles`],
              ['Countdown', `last ${state.config.countdownCycles} cycles`],
              ['Accolade depth', `top ${state.config.accoladeDepth}`],
              ['Images kept per stable', String(state.config.retainedImagesPerStable)],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-1.5 rounded-full border border-white/10 bg-surface-elevated px-3 py-1">
                <dt className="text-secondary">{label}</dt>
                <dd className="text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </AdminPanel>
  );
}
