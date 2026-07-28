/**
 * SeasonControlPage — Admin_Season_Portal (Spec #45).
 *
 * The only in-app way to inspect and drive the season lifecycle:
 *   - See the current season state (number, phase, cycle progress).
 *   - Preview a rollover (read-only count of what would be archived/purged).
 *   - Execute a rollover behind a typed confirmation (closes Season_Zero,
 *     archives everything, and opens the next season's preparation window).
 *   - Nudge the current season for testing: extend the competitive phase, or
 *     set how many preparation cycles remain.
 *
 * These call the admin-only `/api/admin/seasons/*` endpoints. The rollover is
 * destructive and irreversible, so the button is gated behind a modal that
 * requires typing the exact confirmation phrase.
 *
 * Requirements: 45 (Admin_Season_Portal)
 */
import { useState, useEffect, useCallback } from 'react';
import { AdminPageHeader, AdminStatCard } from '../../components/admin/shared';
import {
  getAdminSeasonState,
  getRolloverPreview,
  executeRollover,
  extendSeason,
  setPreparationCycles,
  type AdminSeasonState,
  type RolloverPreview,
  type RolloverResult,
} from '../../utils/seasonApi';
import { ApiError } from '../../utils/ApiError';

const CONFIRM_PHRASE = 'CONFIRM_ROLLOVER';

const errorMessage = (err: unknown, fallback: string): string =>
  (err instanceof ApiError && err.message) || fallback;

const PHASE_LABEL: Record<AdminSeasonState['phase'], string> = {
  preparation: 'Preparation',
  competitive: 'Competitive',
  completed: 'Completed',
};

const PHASE_COLOR: Record<AdminSeasonState['phase'], 'info' | 'success' | 'warning'> = {
  preparation: 'warning',
  competitive: 'success',
  completed: 'info',
};

function SeasonControlPage() {
  const [state, setState] = useState<AdminSeasonState | null>(null);
  const [preview, setPreview] = useState<RolloverPreview | null>(null);
  const [lastResult, setLastResult] = useState<RolloverResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Rollover confirmation modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // Phase-nudge inputs
  const [extendCycles, setExtendCycles] = useState(1);
  const [prepCycles, setPrepCycles] = useState(2);

  const showMessage = (type: 'success' | 'error', text: string): void => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 6000);
  };

  const loadState = useCallback(async (): Promise<void> => {
    try {
      setState(await getAdminSeasonState());
    } catch (error) {
      showMessage('error', errorMessage(error, 'Failed to load season state'));
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const loadPreview = useCallback(async (): Promise<void> => {
    setPreviewLoading(true);
    try {
      setPreview(await getRolloverPreview());
    } catch (error) {
      showMessage('error', errorMessage(error, 'Failed to load rollover preview'));
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const handleExtend = useCallback(async (): Promise<void> => {
    if (extendCycles < 1) {
      showMessage('error', 'Extend by at least 1 cycle');
      return;
    }
    setLoading(true);
    try {
      await extendSeason(extendCycles);
      showMessage('success', `Extended competitive phase by ${extendCycles} cycle(s)`);
      await loadState();
    } catch (error) {
      showMessage('error', errorMessage(error, 'Failed to extend season'));
    } finally {
      setLoading(false);
    }
  }, [extendCycles, loadState]);

  const handleSetPrep = useCallback(async (): Promise<void> => {
    if (prepCycles < 0) {
      showMessage('error', 'Preparation cycles cannot be negative');
      return;
    }
    setLoading(true);
    try {
      await setPreparationCycles(prepCycles);
      showMessage('success', `Set remaining preparation cycles to ${prepCycles}`);
      await loadState();
    } catch (error) {
      showMessage('error', errorMessage(error, 'Failed to set preparation cycles'));
    } finally {
      setLoading(false);
    }
  }, [prepCycles, loadState]);

  const handleRollover = useCallback(async (): Promise<void> => {
    if (!state) return;
    setLoading(true);
    try {
      const result = await executeRollover(state.seasonNumber);
      setLastResult(result);
      setConfirmOpen(false);
      setConfirmText('');
      setPreview(null);
      showMessage(
        'success',
        `Season ${result.completedSeasonNumber} closed. Season ${result.newSeasonNumber} is now in preparation.`,
      );
      await loadState();
    } catch (error) {
      showMessage('error', errorMessage(error, 'Rollover failed'));
    } finally {
      setLoading(false);
    }
  }, [state, loadState]);

  return (
    <div data-testid="season-control-page" className="space-y-6">
      <AdminPageHeader
        title="Season Control"
        subtitle="Inspect the season lifecycle and trigger a rollover"
        actions={
          <button
            type="button"
            onClick={() => void loadState()}
            className="px-3 py-1.5 text-sm bg-surface-elevated text-secondary hover:text-white rounded transition-colors"
          >
            ↻ Refresh
          </button>
        }
      />

      {message && (
        <div
          className={`p-4 rounded ${message.type === 'success' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}
        >
          {message.text}
        </div>
      )}

      {/* Current season state */}
      <div className="bg-surface rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Current Season</h2>
        {state ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <AdminStatCard
                label="Season"
                value={state.isLegacy ? `${state.seasonNumber} (Legacy)` : state.seasonNumber}
                color="primary"
                icon={<span>🗓️</span>}
              />
              <AdminStatCard
                label="Phase"
                value={PHASE_LABEL[state.phase]}
                color={PHASE_COLOR[state.phase]}
                icon={<span>🚦</span>}
              />
              <AdminStatCard
                label="Season Cycle"
                value={state.phase === 'competitive' ? `${state.seasonCycle} / ${state.seasonLengthCycles}` : '—'}
                color="info"
                icon={<span>🔄</span>}
              />
              <AdminStatCard
                label="Remaining Competitive"
                value={state.phase === 'competitive' ? state.remainingCompetitiveCycles : '—'}
                color="info"
                icon={<span>⏳</span>}
              />
              <AdminStatCard
                label="Preparation Day"
                value={state.phase === 'preparation' ? state.preparationDay : '—'}
                color="warning"
                icon={<span>🛠️</span>}
              />
              <AdminStatCard
                label="Remaining Preparation"
                value={state.phase === 'preparation' ? state.remainingPreparationCycles : '—'}
                color="warning"
                icon={<span>⌛</span>}
              />
              <AdminStatCard
                label="Rollover In Progress"
                value={state.rolloverInProgress ? 'Yes' : 'No'}
                color={state.rolloverInProgress ? 'warning' : 'success'}
                icon={<span>{state.rolloverInProgress ? '⚙️' : '✓'}</span>}
              />
              <AdminStatCard
                label="Balance Changes"
                value={state.balanceChangesAppropriate ? 'Appropriate' : 'Hold'}
                color={state.balanceChangesAppropriate ? 'success' : 'info'}
                icon={<span>⚖️</span>}
              />
            </div>
            {state.isLegacy && (
              <p className="text-sm text-secondary mt-4">
                This is Season 0, the legacy pre-season timeline. Trigger a rollover below to close it and
                open Season 1's preparation window.
              </p>
            )}
          </>
        ) : (
          <p className="text-secondary">Loading season state…</p>
        )}
      </div>

      {/* Rollover */}
      <div className="bg-surface rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-2">Season Rollover</h2>
        <p className="text-sm text-secondary mb-4">
          Archives every stable and robot, purges season-scoped history, deletes generated stables, and
          opens the next season in its preparation phase.{' '}
          <span className="text-error font-semibold">This is irreversible.</span> Preview first.
        </p>

        <div className="flex flex-wrap gap-3 mb-4">
          <button
            type="button"
            onClick={() => void loadPreview()}
            disabled={previewLoading}
            className="bg-primary hover:bg-blue-700 disabled:bg-surface-elevated px-5 py-2.5 rounded font-semibold transition-colors"
          >
            {previewLoading ? 'Loading…' : '🔍 Preview Rollover'}
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmText('');
              setConfirmOpen(true);
            }}
            disabled={loading || !state || state.rolloverInProgress}
            className="bg-red-600 hover:bg-red-700 disabled:bg-surface-elevated px-5 py-2.5 rounded font-semibold transition-colors"
          >
            🚨 Trigger Rollover
          </button>
        </div>

        {preview && (
          <div className="bg-surface-elevated rounded p-4">
            <h3 className="text-lg font-semibold mb-3">Rollover Preview</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <PreviewStat label="Human Stables" value={preview.humanStables} tone="keep" />
              <PreviewStat label="Human Robots" value={preview.humanRobots} tone="keep" />
              <PreviewStat label="Generated Stables" value={preview.generatedStables} tone="delete" />
              <PreviewStat label="Generated Robots" value={preview.generatedRobots} tone="delete" />
              <PreviewStat label="Images Retained" value={preview.imagesRetained} tone="keep" />
              <PreviewStat label="Images Deleted" value={preview.imagesDeleted} tone="delete" />
            </div>
            <h4 className="text-sm font-semibold text-secondary mb-2">Rows to purge</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
              {Object.entries(preview.rowsToPurge).map(([table, count]) => (
                <div key={table} className="flex justify-between border-b border-white/5 py-1">
                  <span className="text-secondary font-mono text-xs">{table}</span>
                  <span className="text-white font-semibold">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {lastResult && (
          <div className="mt-4 bg-green-900/30 border border-green-500/30 rounded p-4">
            <h3 className="text-lg font-semibold mb-2 text-green-200">Last Rollover Result</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <ResultStat label="Closed Season" value={lastResult.completedSeasonNumber} />
              <ResultStat label="New Season" value={lastResult.newSeasonNumber} />
              <ResultStat label="Stables Archived" value={lastResult.stablesArchived} />
              <ResultStat label="Robots Archived" value={lastResult.robotsArchived} />
              <ResultStat label="Snapshot Rows" value={lastResult.snapshotRows} />
              <ResultStat label="Accolade Rows" value={lastResult.accoladeRows} />
              <ResultStat label="Generated Deleted" value={lastResult.generatedStablesDeleted} />
              <ResultStat label="Rows Purged" value={lastResult.totalRowsPurged} />
            </div>
            <p className="text-xs text-secondary mt-3">
              Completed in {(lastResult.durations.totalMs / 1000).toFixed(2)}s (archive{' '}
              {(lastResult.durations.archiveMs / 1000).toFixed(2)}s, purge{' '}
              {(lastResult.durations.purgeMs / 1000).toFixed(2)}s).
            </p>
          </div>
        )}
      </div>

      {/* Phase nudges (testing helpers) */}
      <div className="bg-surface rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-2">Phase Adjustments</h2>
        <p className="text-sm text-secondary mb-4">
          Testing helpers to move the current season along without waiting for cycles to accrue.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-surface-elevated rounded p-4">
            <h3 className="font-semibold mb-1">Extend Competitive Phase</h3>
            <p className="text-xs text-secondary mb-3">Adds cycles to the current season length.</p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="number"
                min="1"
                max="365"
                value={extendCycles}
                onChange={(e) => setExtendCycles(parseInt(e.target.value) || 1)}
                aria-label="Cycles to extend"
                className="bg-surface text-white px-3 py-1.5 rounded w-24"
              />
              <button
                type="button"
                onClick={() => void handleExtend()}
                disabled={loading}
                className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-surface px-4 py-1.5 rounded font-semibold transition-colors"
              >
                Extend
              </button>
            </div>
          </div>

          <div className="bg-surface-elevated rounded p-4">
            <h3 className="font-semibold mb-1">Set Remaining Preparation Cycles</h3>
            <p className="text-xs text-secondary mb-3">Only meaningful during a preparation phase (0–7).</p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="number"
                min="0"
                max="7"
                value={prepCycles}
                onChange={(e) => setPrepCycles(parseInt(e.target.value) || 0)}
                aria-label="Remaining preparation cycles"
                className="bg-surface text-white px-3 py-1.5 rounded w-24"
              />
              <button
                type="button"
                onClick={() => void handleSetPrep()}
                disabled={loading}
                className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-surface px-4 py-1.5 rounded font-semibold transition-colors"
              >
                Set
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Rollover confirmation modal */}
      {confirmOpen && state && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface rounded-lg p-6 max-w-md w-full border border-red-500/30">
            <h3 className="text-lg font-semibold mb-2 text-red-300">Confirm Season Rollover</h3>
            <p className="text-secondary text-sm mb-4">
              This will close <span className="font-semibold text-white">Season {state.seasonNumber}</span>,
              archive all stables, purge season-scoped history, and delete generated stables. This cannot be
              undone.
            </p>
            <p className="text-secondary text-sm mb-2">
              Type <span className="font-mono text-white">{CONFIRM_PHRASE}</span> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              aria-label="Confirmation phrase"
              autoFocus
              className="w-full bg-surface-elevated text-white px-3 py-2 rounded mb-6 font-mono"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText('');
                }}
                className="px-4 py-2 bg-surface-elevated text-secondary hover:text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRollover()}
                disabled={confirmText !== CONFIRM_PHRASE || loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-surface-elevated disabled:text-tertiary text-white rounded font-semibold transition-colors"
              >
                {loading ? 'Rolling over…' : 'Confirm Rollover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function PreviewStat({ label, value, tone }: { label: string; value: number; tone: 'keep' | 'delete' }) {
  return (
    <div className="bg-surface rounded p-3 text-center">
      <p className={`text-lg font-bold ${tone === 'delete' ? 'text-error' : 'text-success'}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-secondary">{label}</p>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface rounded p-2 text-center">
      <p className="text-base font-bold text-white">{value.toLocaleString()}</p>
      <p className="text-xs text-secondary">{label}</p>
    </div>
  );
}

export default SeasonControlPage;
