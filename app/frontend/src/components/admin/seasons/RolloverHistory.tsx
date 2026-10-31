/**
 * Rollover history: every completed season with the rollover that closed it
 * (when, who or what, how long, what it did) and, folded, the attempts that
 * failed before it. Attempts on the current season that failed come first.
 */
import type { ReactNode } from 'react';
import type { RolloverAttempt, SeasonHistoryEntry, SeasonRolloverHistory } from '../../../utils/seasonApi';
import { formatDuration } from '../../../utils/adminCycleFormat';
import { attemptProblemText, attemptTriggerLabel, formatCount, formatDate, formatDateTime } from '../../../utils/adminSeasonFormat';
import { ADMIN_FOCUS_RING, AdminPanel } from '../shared';
import { RolloverStages } from './RolloverStages';

export interface RolloverHistoryProps {
  history: SeasonRolloverHistory | null;
  loading: boolean;
  error: string | null;
  now: Date;
  currentSeasonNumber: number | null;
  onRetry: () => void;
}

const SUMMARY = `flex min-h-11 cursor-pointer list-none items-center gap-2 rounded px-1 text-sm text-secondary hover:text-white ${ADMIN_FOCUS_RING}`;

function FailedAttempts({ attempts, now }: { attempts: RolloverAttempt[]; now: Date }): ReactNode {
  if (attempts.length === 0) return null;
  return (
    <details className="group mt-2">
      <summary className={SUMMARY}>
        <span aria-hidden="true" className="group-open:rotate-90">▸</span>
        <span className="text-error">{attempts.length} failed attempt{attempts.length === 1 ? '' : 's'}</span>
      </summary>
      <ul className="mt-1 space-y-2 border-l border-error/30 pl-4">
        {attempts.map((attempt) => (
          <li key={`${attempt.source}-${attempt.id}`} className="text-xs">
            <p className="text-secondary">
              {formatDateTime(attempt.at, now)} UTC · {attemptTriggerLabel(attempt)}
              {attempt.durationMs !== null ? ` · ${formatDuration(attempt.durationMs)}` : ''}
            </p>
            <p className="break-words text-error">{attemptProblemText(attempt)}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}

function RolloverLine({ attempt, now }: { attempt: RolloverAttempt; now: Date }): ReactNode {
  const result = attempt.result;
  return (
    <>
      <p className="text-sm text-white">
        <span aria-hidden="true" className="text-success">✓ </span>
        Rolled over {formatDateTime(attempt.at, now)} UTC
        <span className="text-secondary"> · {attemptTriggerLabel(attempt)}{attempt.durationMs !== null ? ` · ${formatDuration(attempt.durationMs)}` : ''}</span>
      </p>
      {result && (
        <p className="mt-0.5 text-xs text-secondary">
          {formatCount(result.stablesArchived)} stables and {formatCount(result.robotsArchived)} robots archived ·{' '}
          {formatCount(result.generatedStablesDeleted)} generated stables deleted ·{' '}
          {result.dormantStablesDeleted !== undefined ? `${formatCount(result.dormantStablesDeleted)} dormant human stables deleted · ` : ''} {formatCount(result.totalRowsPurged)} rows emptied
        </p>
      )}
      {(attempt.stages || result) && (
        <details className="group mt-1">
          <summary className={SUMMARY}>
            <span aria-hidden="true" className="group-open:rotate-90">▸</span>
            Details
          </summary>
          <div className="mt-2 space-y-3">
            {result && (
              <p className="text-xs text-secondary">
                Archive {formatDuration(result.durations.archiveMs)} · purge {formatDuration(result.durations.purgeMs)} · clean-up and
                Automaton turns {formatDuration(result.durations.postMs)} · {formatCount(result.snapshotRows)} standing snapshots ·{' '}
                {formatCount(result.accoladeRows)} accolades
              </p>
            )}
            {attempt.stages && (
              <RolloverStages
                progress={{ seasonNumber: 0, newSeasonNumber: null, stages: attempt.stages, generatedStables: null, result: null }}
                now={now}
              />
            )}
          </div>
        </details>
      )}
    </>
  );
}

function SeasonItem({ season, now }: { season: SeasonHistoryEntry; now: Date }): ReactNode {
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-semibold text-white">Season {season.seasonNumber}{season.isLegacy ? ' (legacy)' : ''}</h3>
        <p className="text-xs text-secondary">
          {formatDate(season.startedAt, now)} – {season.endedAt ? formatDate(season.endedAt, now) : '…'} · {formatCount(season.competitiveCycles)} cycles ·{' '}
          {formatCount(season.humanStableCount)} stables archived · {formatCount(season.generatedStableCount)} generated
        </p>
      </div>
      <div className="mt-2">
        {season.rollover
          ? <RolloverLine attempt={season.rollover} now={now} />
          : <p className="text-xs text-tertiary">Closed before rollovers were recorded{season.endedAt ? ` (${formatDateTime(season.endedAt, now)} UTC)` : ''}.</p>}
        <FailedAttempts attempts={season.failedAttempts} now={now} />
      </div>
    </li>
  );
}

export function RolloverHistory({ history, loading, error, now, currentSeasonNumber, onRetry }: RolloverHistoryProps): ReactNode {
  return (
    <AdminPanel title="Rollover history" loading={loading && !history} error={error} onRetry={onRetry} skeletonRows={3}>
      {history && (
        history.seasons.length === 0 && history.currentSeasonAttempts.length === 0
          ? <p className="p-5 text-sm text-secondary">No season has been rolled over yet.</p>
          : (
            <ul className="divide-y divide-white/10">
              {history.currentSeasonAttempts.length > 0 && (
                <li className="px-5 py-4">
                  <h3 className="text-sm font-semibold text-white">Season {currentSeasonNumber ?? ''} (current)</h3>
                  <FailedAttempts attempts={history.currentSeasonAttempts} now={now} />
                </li>
              )}
              {history.seasons.map((season) => <SeasonItem key={season.seasonNumber} season={season} now={now} />)}
            </ul>
          )
      )}
    </AdminPanel>
  );
}
