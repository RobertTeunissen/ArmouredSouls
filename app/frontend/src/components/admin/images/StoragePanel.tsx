/**
 * Storage: orphan files (no robot, archived season or player library uses
 * them) and references to files that are gone. "Preview cleanup" lists what
 * would change; "Clean up" deletes the orphans and clears the broken
 * references (robots and archived seasons then show the default frame).
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ADMIN_FOCUS_RING, AdminPanel } from '../shared';
import { ApiError } from '../../../utils/ApiError';
import { getCleanupPreview, runImageCleanup } from '../../../utils/adminImagesApi';
import { bytesText } from '../../../utils/adminImagesFormat';
import { formatCount } from '../../../utils/adminDashboardFormat';
import type { CleanupPreview, CleanupResult, ImagesOverview } from '@shared/types';

export interface StoragePanelProps {
  overview: ImagesOverview;
  /** Called after a cleanup ran so the page can refresh. */
  onCleaned: () => void;
}

function nothingToDo(preview: CleanupPreview): boolean {
  return preview.orphanCount === 0 && preview.missing.robots === 0 && preview.missing.archived === 0;
}

export function StoragePanel({ overview, onCleaned }: StoragePanelProps): ReactNode {
  const { storage } = overview;
  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [busy, setBusy] = useState<'preview' | 'clean' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const missing = storage.missing.robots + storage.missing.archived;

  const loadPreview = async (): Promise<void> => {
    setBusy('preview');
    setError(null);
    setResult(null);
    try {
      setPreview(await getCleanupPreview());
    } catch (err) {
      setError((err instanceof ApiError && err.message) || 'Could not preview the cleanup.');
    } finally {
      setBusy(null);
    }
  };

  const clean = async (): Promise<void> => {
    setBusy('clean');
    setError(null);
    try {
      setResult(await runImageCleanup());
      setPreview(null);
      onCleaned();
    } catch (err) {
      setError((err instanceof ApiError && err.message) || 'The cleanup failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminPanel title="Storage">
      <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
        <div className="space-y-1">
          <p className="text-sm text-white">Orphan files: <span className="font-semibold tabular-nums" data-testid="orphan-count">{formatCount(storage.orphanFiles)}</span></p>
          <p className="text-xs text-secondary">Files no robot, archived season or player library uses. The season rollover sweeps them too.</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-white">
            Missing files: <span className={`font-semibold tabular-nums ${missing > 0 ? 'text-warning' : ''}`} data-testid="missing-count">{formatCount(missing)}</span>
            {missing > 0 && <span className="text-secondary"> ({formatCount(storage.missing.robots)} on robots, {formatCount(storage.missing.archived)} in archived seasons)</span>}
          </p>
          <p className="text-xs text-secondary">References whose file is gone. Clearing them shows the default frame instead of a broken image; the files cannot be restored.</p>
        </div>
      </div>

      <div className="space-y-3 border-t border-white/10 px-5 py-4">
        <button
          type="button"
          onClick={() => { void loadPreview(); }}
          disabled={busy !== null}
          className={`min-h-11 rounded-md bg-surface-elevated px-4 text-sm text-white hover:bg-white/10 disabled:opacity-60 ${ADMIN_FOCUS_RING}`}
        >
          {busy === 'preview' ? 'Checking…' : 'Preview cleanup'}
        </button>

        {error && <p role="alert" className="text-sm text-error">{error}</p>}

        {preview && (
          <div className="space-y-3 rounded-md border border-white/10 bg-surface-elevated/50 p-3 text-sm" data-testid="cleanup-preview">
            {nothingToDo(preview) ? (
              <p className="text-white">Nothing to clean up.</p>
            ) : (
              <>
                <p className="text-white">
                  Would delete {formatCount(preview.orphanCount)} orphan {preview.orphanCount === 1 ? 'file' : 'files'} ({bytesText(preview.orphanBytes)}) and clear {formatCount(preview.missing.robots)} robot and {formatCount(preview.missing.archived)} archived references to missing files.
                </p>
                {(preview.orphanFiles.length > 0 || preview.missing.paths.length > 0) && (
                  <details className="text-xs text-secondary">
                    <summary className={`cursor-pointer ${ADMIN_FOCUS_RING}`}>Show the paths</summary>
                    <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto font-mono">
                      {preview.orphanFiles.map((f) => <li key={f.imageUrl}>delete {f.imageUrl}</li>)}
                      {preview.missing.paths.map((p) => <li key={p}>clear {p}</li>)}
                    </ul>
                  </details>
                )}
                <button
                  type="button"
                  onClick={() => { void clean(); }}
                  disabled={busy !== null}
                  className={`min-h-11 rounded-md border border-warning/60 bg-warning/15 px-4 text-sm text-warning hover:bg-warning/25 disabled:opacity-60 ${ADMIN_FOCUS_RING}`}
                >
                  {busy === 'clean' ? 'Cleaning up…' : 'Clean up'}
                </button>
              </>
            )}
          </div>
        )}

        {result && (
          <p role="status" className={`text-sm ${result.errors.length > 0 ? 'text-error' : 'text-success'}`} data-testid="cleanup-result">
            Deleted {formatCount(result.filesDeleted)} {result.filesDeleted === 1 ? 'file' : 'files'} ({bytesText(result.bytesReclaimed)}), cleared {formatCount(result.referencesCleared.robots)} robot and {formatCount(result.referencesCleared.archived)} archived references.
            {result.errors.length > 0 && ` ${result.errors.length} ${result.errors.length === 1 ? 'file' : 'files'} could not be deleted; see the server log.`}
          </p>
        )}
      </div>
    </AdminPanel>
  );
}
