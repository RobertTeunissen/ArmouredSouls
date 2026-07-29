/**
 * Image_Library UI (Spec #45 R30).
 *
 * A player's own uploaded robot artwork survives the season reset, so this is
 * where they re-apply it to a new season's robots. Shows the usage cost of each
 * image before deletion, because deleting one that an archived season references
 * changes that history to a default silhouette.
 *
 * Only ever lists the signed-in player's own uploads — the backend scopes the
 * request, and there is no affordance anywhere to copy another player's image.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { createLogger } from '../../utils/logger';

const log = createLogger('ImageLibrary');

interface RetainedImage {
  path: string;
  uploadedAt: string;
  currentRobotCount: number;
  archivedSeasonCount: number;
}

interface ImageLibraryResponse {
  images: RetainedImage[];
  retained: number;
  limit: number;
}

interface DeleteImpact {
  path: string;
  affectedRobotNames: string[];
  affectedSeasonNumbers: number[];
}

interface ImageLibraryProps {
  /** Called with the chosen image path when the player selects one. */
  onSelect?: (path: string) => void;
  selectedPath?: string | null;
}

function filenameOf(path: string): string {
  return path.split('/').pop() ?? path;
}

export function ImageLibrary({ onSelect, selectedPath }: ImageLibraryProps) {
  const [data, setData] = useState<ImageLibraryResponse | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DeleteImpact | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      setData(await api.get<ImageLibraryResponse>('/api/images'));
    } catch (error) {
      log.error('Failed to load image library', error);
      setData({ images: [], retained: 0, limit: 20 });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const requestDelete = async (path: string): Promise<void> => {
    try {
      const impact = await api.get<DeleteImpact>(`/api/images/${filenameOf(path)}/impact`);
      setPendingDelete(impact);
    } catch (error) {
      log.error('Failed to read delete impact', error);
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await api.delete(`/api/images/${filenameOf(pendingDelete.path)}?confirm=true`);
      setPendingDelete(null);
      await load();
    } catch (error) {
      log.error('Failed to delete image', error);
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return <p className="text-sm text-secondary">Loading your images…</p>;
  }

  const atLimit = data.retained >= data.limit;

  return (
    <section data-testid="image-library" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-white">Your saved images</h3>
        <span className={`text-xs ${atLimit ? 'text-warning' : 'text-secondary'}`}>
          {data.retained} of {data.limit} saved
        </span>
      </div>

      <p className="text-xs text-secondary">
        Your uploads survive the season reset, so you can put the same artwork on a new robot
        next season.
        {atLimit && ' You are at the limit — delete one before uploading another.'}
      </p>

      {data.images.length === 0 ? (
        <p className="text-sm text-secondary">
          You have not uploaded any robot images yet.
        </p>
      ) : (
        // 2 columns at 320px, more as space allows.
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {data.images.map((image) => {
            const isSelected = selectedPath === image.path;
            return (
              <li
                key={image.path}
                className={`rounded border p-2 ${
                  isSelected ? 'border-primary bg-primary/10' : 'border-white/10 bg-surface'
                }`}
              >
                <img
                  src={image.path}
                  alt=""
                  className="mb-2 aspect-square w-full rounded object-cover"
                />
                <p className="mb-2 text-[11px] leading-tight text-secondary">
                  {image.currentRobotCount > 0 && (
                    <span className="block">
                      Used by {image.currentRobotCount} robot
                      {image.currentRobotCount === 1 ? '' : 's'}
                    </span>
                  )}
                  {image.archivedSeasonCount > 0 && (
                    <span className="block">
                      In {image.archivedSeasonCount} archived season
                      {image.archivedSeasonCount === 1 ? '' : 's'}
                    </span>
                  )}
                  {image.currentRobotCount === 0 && image.archivedSeasonCount === 0 && (
                    <span className="block">Unused</span>
                  )}
                </p>
                <div className="flex flex-col gap-1">
                  {onSelect && (
                    <button
                      type="button"
                      onClick={() => onSelect(image.path)}
                      className="min-h-[44px] rounded bg-primary/20 text-xs font-medium text-primary hover:bg-primary/30"
                    >
                      {isSelected ? 'Selected' : 'Use this'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void requestDelete(image.path)}
                    className="min-h-[44px] rounded border border-error/30 text-xs text-error hover:bg-error/10"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="image-delete-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3"
        >
          <div className="w-full max-w-sm rounded-lg border border-white/10 bg-surface-elevated p-4">
            <h4 id="image-delete-title" className="font-semibold text-white">
              Delete this image permanently?
            </h4>

            {pendingDelete.affectedRobotNames.length > 0 && (
              <p className="mt-2 text-sm text-secondary">
                These robots will fall back to the default icon:{' '}
                <span className="text-white">
                  {pendingDelete.affectedRobotNames.join(', ')}
                </span>
              </p>
            )}

            {pendingDelete.affectedSeasonNumbers.length > 0 && (
              <p className="mt-2 text-sm text-warning">
                {pendingDelete.affectedSeasonNumbers.length} archived season
                {pendingDelete.affectedSeasonNumbers.length === 1 ? '' : 's'} reference
                {pendingDelete.affectedSeasonNumbers.length === 1 ? 's' : ''} this image
                (season {pendingDelete.affectedSeasonNumbers.join(', ')}). Those robots will
                show a default silhouette in your history. Every other archived value stays
                unchanged.
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="min-h-[44px] rounded border border-white/20 px-4 text-sm text-white hover:bg-white/5"
              >
                Keep it
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmDelete()}
                className="min-h-[44px] rounded bg-error px-4 text-sm font-medium text-white hover:bg-error/80 disabled:opacity-50"
              >
                {busy ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ImageLibrary;
